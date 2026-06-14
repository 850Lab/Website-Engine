import { cleanText } from "../stage1/shared.js";
import { buildCampaignPairs } from "./region-presets.js";

const AVG_SECONDS_PER_SEARCH = 75;

export function pairKey(city, industry, adapterId = "") {
  return `${cleanText(city).toLowerCase()}|${cleanText(industry).toLowerCase()}|${cleanText(adapterId).toLowerCase()}`;
}

export function getCompletedPairKeys(campaign) {
  return new Set(
    (campaign.pairResults ?? [])
      .filter((result) => result.status === "completed")
      .map((result) => pairKey(result.city, result.industry, result.adapterId)),
  );
}

export function getRemainingPairs(campaign) {
  const allPairs = buildCampaignPairs(campaign.cities ?? [], campaign.industries ?? []);
  const completed = getCompletedPairKeys(campaign);
  return allPairs.filter((pair) => !completed.has(pairKey(pair.city, pair.industry)));
}

export function estimateAverageSecondsPerSearch(campaign) {
  const durations = [];
  for (const result of campaign.pairResults ?? []) {
    if (result.status !== "completed" || !result.finishedAt || !result.startedAt) continue;
    const ms = new Date(result.finishedAt).getTime() - new Date(result.startedAt).getTime();
    if (ms > 0) durations.push(ms / 1000);
  }
  if (!durations.length) return AVG_SECONDS_PER_SEARCH;
  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
}

export function buildCampaignProgress(campaign) {
  const totalPairs = campaign.totalPairs ?? buildCampaignPairs(campaign.cities ?? [], campaign.industries ?? []).length;
  const completedPairs = getCompletedPairKeys(campaign).size;
  const remainingPairs = Math.max(0, totalPairs - completedPairs);
  const avgSeconds = estimateAverageSecondsPerSearch(campaign);
  const estimatedSecondsRemaining = Math.round(remainingPairs * avgSeconds);

  return {
    totalPairs,
    completedPairs,
    remainingPairs,
    percentComplete: totalPairs ? Math.round((completedPairs / totalPairs) * 1000) / 10 : 0,
    estimatedSecondsRemaining,
    estimatedMinutesRemaining: Math.ceil(estimatedSecondsRemaining / 60),
    estimatedHoursRemaining: Math.round((estimatedSecondsRemaining / 3600) * 10) / 10,
    averageSecondsPerSearch: Math.round(avgSeconds),
  };
}

export function enrichCampaignView(campaign) {
  const progress = buildCampaignProgress(campaign);
  return {
    ...campaign,
    progress,
    completedSearches: progress.completedPairs,
    remainingSearches: progress.remainingPairs,
    estimatedTimeRemaining: progress.estimatedSecondsRemaining,
  };
}
