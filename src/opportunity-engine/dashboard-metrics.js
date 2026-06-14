import { listDiscoveryRuns, listQualifiedBusinesses } from "../stage1/qualified-business-store.js";
import { buildDatabaseSummary } from "../stage1/qualified-business-store.js";
import { getOpportunityEngineConfig } from "./discovery-campaign.js";
import { listDiscoveryCampaigns } from "./campaign-store.js";

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date = new Date()) {
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function groupQualifiedCount(rows, field) {
  const map = {};
  for (const row of rows.filter((entry) => entry.qualificationStatus === "qualified")) {
    const key = String(row[field] ?? "Unknown").trim() || "Unknown";
    map[key] = (map[key] ?? 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

export async function buildOpportunityDashboard() {
  const records = await listQualifiedBusinesses();
  const summary = await buildDatabaseSummary(records);
  const runs = await listDiscoveryRuns();
  const campaigns = await listDiscoveryCampaigns();
  const qualified = records.filter((row) => row.qualificationStatus === "qualified");
  const todayStart = startOfDay().getTime();
  const weekStart = startOfWeek().getTime();

  const addedToday = records.filter((row) => new Date(row.dateFound).getTime() >= todayStart);
  const addedThisWeek = records.filter((row) => new Date(row.dateFound).getTime() >= weekStart);

  const recentDiscoveries = records.slice(0, 12).map((row) => ({
    id: row.id,
    businessName: row.businessName,
    city: row.city,
    industry: row.industry,
    qualificationStatus: row.qualificationStatus,
    websiteStatus: row.websiteStatus,
    dateFound: row.dateFound,
  }));

  const mostRecentDiscoveryRun = runs[0] ?? null;
  const mostRecentCampaign = campaigns[0] ?? null;

  return {
    engine: getOpportunityEngineConfig(),
    database: {
      totalBusinesses: summary.businessesFound,
      opportunitiesFoundToday: summary.opportunitiesFoundToday,
      qualifiedBusinesses: summary.qualifiedBusinesses,
      noWebsite: summary.noWebsite,
      poorWebsite: summary.poorWebsite,
      textFirst: summary.textFirst,
      emailFirst: summary.emailFirst,
      projectsGenerated: summary.projectsGenerated,
      previewsReady: summary.previewsReady,
      readyForOutreach: summary.readyForOutreach,
      citiesCovered: summary.citiesCovered,
      industriesCovered: summary.industriesCovered,
      qualifiedPercent: summary.businessesFound
        ? Math.round((summary.qualifiedBusinesses / summary.businessesFound) * 1000) / 10
        : 0,
    },
    growth: {
      databaseGrowth: summary.businessesFound,
      opportunitiesAddedToday: addedToday.length,
      opportunitiesAddedThisWeek: addedThisWeek.length,
      qualifiedAddedToday: addedToday.filter((row) => row.qualificationStatus === "qualified").length,
      qualifiedAddedThisWeek: addedThisWeek.filter((row) => row.qualificationStatus === "qualified").length,
    },
    topOpportunityCities: summary.topOpportunityCities,
    topOpportunityIndustries: summary.topOpportunityIndustries,
    topCities: groupQualifiedCount(records, "city").slice(0, 10),
    topIndustries: groupQualifiedCount(records, "industry").slice(0, 10),
    recentDiscoveries,
    mostRecentDiscoveryRun,
    mostRecentCampaign,
    countsByCity: summary.byCity,
    countsByIndustry: summary.byIndustry,
  };
}
