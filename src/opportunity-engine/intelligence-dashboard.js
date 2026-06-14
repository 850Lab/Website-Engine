import { listDiscoveryRuns, listQualifiedBusinesses, buildDatabaseSummary } from "../stage1/qualified-business-store.js";
import { listDiscoveryCampaigns } from "./campaign-store.js";
import { buildCampaignProgress, enrichCampaignView } from "./campaign-progress.js";
import { buildContactAuditReport } from "./reports/contact-audit.js";
import { buildCoverageAnalysisReport } from "./reports/coverage-analysis.js";
import { buildDataQualityReport } from "./reports/data-quality.js";
import { getBestResumableCampaign } from "./campaign-store.js";
import { getActiveCampaignId, getLiveCampaign } from "./discovery-campaign.js";
import { buildSourceAgnosticMetrics } from "./source-metrics.js";
import { getIdentityMigrationStatus } from "../identity/migrate-identities.js";

function growthOverTime(records) {
  const byDay = {};
  let cumulative = 0;
  const sorted = [...records].sort((a, b) => String(a.dateFound).localeCompare(String(b.dateFound)));
  for (const record of sorted) {
    const day = String(record.dateFound ?? "").slice(0, 10);
    if (!day) continue;
    byDay[day] = (byDay[day] ?? 0) + 1;
  }
  const days = Object.keys(byDay).sort();
  return days.map((day) => {
    cumulative += byDay[day];
    return { day, added: byDay[day], cumulative };
  });
}

export async function buildIntelligenceDashboard() {
  const records = await listQualifiedBusinesses();
  const summary = await buildDatabaseSummary(records);
  const runs = await listDiscoveryRuns();
  const campaigns = await listDiscoveryCampaigns();
  const resumable = await getBestResumableCampaign();
  const activeId = getActiveCampaignId();
  const activeCampaign = activeId ? getLiveCampaign(activeId) : null;
  const sourceMetrics = await buildSourceAgnosticMetrics(records);
  const identityStatus = await getIdentityMigrationStatus();

  return {
    metrics: {
      totalBusinesses: summary.businessesFound,
      qualifiedOpportunities: summary.qualifiedBusinesses,
      qualificationPercent: summary.businessesFound
        ? Math.round((summary.qualifiedBusinesses / summary.businessesFound) * 1000) / 10
        : 0,
      noWebsite: summary.noWebsite,
      poorWebsite: summary.poorWebsite,
      goodWebsite: summary.goodWebsite,
      phoneAvailable: summary.phoneAvailable,
      emailAvailable: summary.emailAvailable,
      textFirst: summary.textFirst,
      emailFirst: summary.emailFirst,
      projectsGenerated: summary.projectsGenerated,
      previewsReady: summary.previewsReady,
      readyForOutreach: summary.readyForOutreach,
      citiesCovered: summary.citiesCovered,
      industriesCovered: summary.industriesCovered,
      businessesWithFacebook: sourceMetrics.businessesWithFacebook,
      businessesWithInstagram: sourceMetrics.businessesWithInstagram,
      businessesWithLinkedin: sourceMetrics.businessesWithLinkedin,
      businessesWithEmail: sourceMetrics.businessesWithEmail,
      businessesWithMultipleSources: sourceMetrics.businessesWithMultipleSources,
      averageSourcesPerBusiness: sourceMetrics.averageSourcesPerBusiness,
    },
    sourceMetrics,
    identityStatus,
    adapterRegistry: sourceMetrics.adapters,
    topCities: summary.topOpportunityCities ?? summary.byCity?.slice(0, 10) ?? [],
    topIndustries: summary.topOpportunityIndustries ?? summary.byIndustry?.slice(0, 10) ?? [],
    growthOverTime: growthOverTime(records),
    recentDiscoveryActivity: {
      runs: runs.slice(0, 12).map((run) => ({
        id: run.id,
        industry: run.industry,
        city: run.city,
        status: run.status,
        businessesFound: run.businessesFound,
        qualifiedCount: run.qualifiedCount,
        finishedAt: run.finishedAt ?? run.startedAt,
      })),
      recentBusinesses: records.slice(0, 12).map((r) => ({
        id: r.id,
        businessName: r.businessName,
        city: r.city,
        industry: r.industry,
        qualificationStatus: r.qualificationStatus,
        dateFound: r.dateFound,
      })),
    },
    campaign: {
      active: activeCampaign ? enrichCampaignView(activeCampaign) : null,
      resumable: resumable ? enrichCampaignView(resumable) : null,
      recent: campaigns.slice(0, 5).map(enrichCampaignView),
    },
    contactAudit: await buildContactAuditReport(),
    coverageAnalysis: await buildCoverageAnalysisReport(),
    dataQuality: await buildDataQualityReport(),
  };
}
