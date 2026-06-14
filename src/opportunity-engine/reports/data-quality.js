import { listDiscoveryRuns, listQualifiedBusinesses } from "../../stage1/qualified-business-store.js";
import { listDiscoveryCampaigns } from "../campaign-store.js";
import { getCompletedPairKeys, pairKey } from "../campaign-progress.js";
import { buildCampaignPairs, SOUTHEAST_TEXAS_CITIES, DEFAULT_INDUSTRIES } from "../region-presets.js";
import { cleanText } from "../../stage1/shared.js";

function pct(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

export async function buildDataQualityReport() {
  const records = await listQualifiedBusinesses();
  const runs = await listDiscoveryRuns();
  const campaigns = await listDiscoveryCampaigns();
  const total = records.length;

  const duplicatesRemoved = campaigns.reduce(
    (sum, campaign) => sum + (campaign.totals?.duplicateCount ?? 0),
    0,
  );
  const rejected = records.filter((r) => r.qualificationStatus === "rejected");
  const missingWebsite = records.filter((r) => !cleanText(r.websiteUrl)).length;
  const missingPhone = records.filter((r) => !cleanText(r.phone) && !cleanText(r.normalizedPhone)).length;
  const missingEmail = records.filter((r) => !cleanText(r.email)).length;
  const scoringErrors = records.filter(
    (r) => r.websiteScore == null && r.websiteStatus !== "no_website",
  ).length;
  const discoveryErrors = runs.filter((r) => r.status === "failed").length;

  const allPairs = buildCampaignPairs(SOUTHEAST_TEXAS_CITIES, DEFAULT_INDUSTRIES);
  const completedKeys = new Set();
  for (const campaign of campaigns) {
    for (const key of getCompletedPairKeys(campaign)) {
      completedKeys.add(key);
    }
  }
  const remainingMatrix = allPairs.filter(
    (pair) => !completedKeys.has(pairKey(pair.city, pair.industry)),
  );

  const gapsByCity = {};
  const gapsByIndustry = {};
  for (const pair of remainingMatrix) {
    gapsByCity[pair.city] = (gapsByCity[pair.city] ?? 0) + 1;
    gapsByIndustry[pair.industry] = (gapsByIndustry[pair.industry] ?? 0) + 1;
  }

  const weaknesses = [];
  if (missingEmail / total > 0.85) {
    weaknesses.push("Email extraction captures fewer than 15% of businesses — primary weakness.");
  }
  if (remainingMatrix.length > 0) {
    weaknesses.push(`${remainingMatrix.length} city×industry searches incomplete (${pct(completedKeys.size, allPairs.length)}% matrix coverage).`);
  }
  if (discoveryErrors > 0) {
    weaknesses.push(`${discoveryErrors} discovery runs failed — often network interruptions during Maps scrape.`);
  }
  if (campaigns.filter((c) => c.status === "failed").length > 1) {
    weaknesses.push("Multiple parallel campaigns were started — caused duplicate skipping and wasted scrape time.");
  }

  return {
    duplicatesRemoved,
    businessesRejected: rejected.length,
    businessesRejectedPercent: pct(rejected.length, total),
    missingWebsite: { count: missingWebsite, percent: pct(missingWebsite, total) },
    missingPhone: { count: missingPhone, percent: pct(missingPhone, total) },
    missingEmail: { count: missingEmail, percent: pct(missingEmail, total) },
    scoringErrors,
    discoveryErrors,
    failedCampaigns: campaigns.filter((c) => c.status === "failed").length,
    matrixCoverage: {
      totalSearches: allPairs.length,
      completedSearches: completedKeys.size,
      remainingSearches: remainingMatrix.length,
      percentComplete: pct(completedKeys.size, allPairs.length),
    },
    coverageGaps: {
      remainingPairs: remainingMatrix.slice(0, 50),
      remainingCount: remainingMatrix.length,
      byCity: Object.entries(gapsByCity).sort((a, b) => b[1] - a[1]),
      byIndustry: Object.entries(gapsByIndustry).sort((a, b) => b[1] - a[1]),
    },
    weaknesses,
  };
}
