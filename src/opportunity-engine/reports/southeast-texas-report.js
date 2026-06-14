import { listQualifiedBusinesses } from "../../stage1/qualified-business-store.js";
import { buildContactAuditReport } from "./contact-audit.js";
import { buildCoverageAnalysisReport } from "./coverage-analysis.js";
import { buildDataQualityReport } from "./data-quality.js";
import { getBestResumableCampaign } from "../campaign-store.js";

function pct(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function growthProjection(records) {
  const byDay = {};
  for (const record of records) {
    const day = String(record.dateFound ?? "").slice(0, 10);
    if (!day) continue;
    byDay[day] = (byDay[day] ?? 0) + 1;
  }
  const days = Object.keys(byDay).sort();
  const dailyCounts = days.map((day) => byDay[day]);
  const avgPerDay = dailyCounts.length
    ? dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length
    : 0;

  return {
    growthByDay: days.map((day) => ({ day, count: byDay[day] })),
    averageBusinessesPerDay: Math.round(avgPerDay * 10) / 10,
    projected30DayTotal: Math.round(records.length + avgPerDay * 30),
    projected90DayTotal: Math.round(records.length + avgPerDay * 90),
  };
}

export async function buildSoutheastTexasOpportunityReport() {
  const records = await listQualifiedBusinesses();
  const qualified = records.filter((r) => r.qualificationStatus === "qualified");
  const total = records.length;
  const contact = await buildContactAuditReport();
  const coverage = await buildCoverageAnalysisReport();
  const quality = await buildDataQualityReport();
  const resumable = await getBestResumableCampaign();

  const textFirst = qualified.filter((r) => r.contactMethodCategory === "text_first").length;
  const emailFirst = qualified.filter((r) => r.contactMethodCategory === "email_first").length;
  const noWebsite = records.filter((r) => r.websiteStatus === "no_website").length;
  const poorWebsite = records.filter((r) => r.websiteStatus === "poor_website").length;
  const goodWebsite = records.filter((r) => r.websiteStatus === "good_website").length;

  return {
    reportTitle: "Southeast Texas Opportunity Report",
    generatedAt: new Date().toISOString(),
    region: "Southeast Texas",
    summary: {
      totalBusinessesDiscovered: total,
      totalQualifiedOpportunities: qualified.length,
      qualificationRate: pct(qualified.length, total),
      textFirstOpportunities: textFirst,
      emailFirstOpportunities: emailFirst,
      noWebsiteOpportunities: records.filter(
        (r) => r.qualificationStatus === "qualified" && r.websiteStatus === "no_website",
      ).length,
      poorWebsiteOpportunities: records.filter(
        (r) => r.qualificationStatus === "qualified" && r.websiteStatus === "poor_website",
      ).length,
      noWebsiteTotal: noWebsite,
      poorWebsiteTotal: poorWebsite,
      goodWebsiteTotal: goodWebsite,
    },
    top10Cities: coverage.topCitiesByQualified.slice(0, 10),
    top10Industries: coverage.topIndustriesByQualified.slice(0, 10),
    growthProjections: growthProjection(records),
    remainingGaps: {
      matrixPercentComplete: quality.matrixCoverage.percentComplete,
      remainingSearches: quality.matrixCoverage.remainingSearches,
      missingCities: coverage.coverage.missingCities,
      missingIndustries: coverage.coverage.missingIndustries,
      resumableCampaignId: resumable?.id ?? null,
    },
    contactAudit: contact,
    coverageAnalysis: coverage,
    dataQuality: quality,
  };
}
