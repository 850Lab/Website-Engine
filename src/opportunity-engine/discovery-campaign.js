import { nowIso } from "../stage1/shared.js";
import {
  getRegionPreset,
  normalizeCampaignSelection,
} from "./region-presets.js";
import {
  findResumableCampaign,
  getDiscoveryCampaign,
  newCampaignId,
  saveDiscoveryCampaign,
} from "./campaign-store.js";
import { enrichCampaignView } from "./campaign-progress.js";
import { getEnabledAdapters } from "../discovery-adapters/registry.js";
import {
  enqueueDiscoveryJobs,
  getCampaignJobStats,
  refreshCampaignFromJobs,
  requeueIncompleteCampaignJobs,
} from "./distributed-job-store.js";

const liveCampaigns = new Map();
const campaignQueue = new Map();

function appendLog(campaign, message) {
  campaign.logs.push({ at: nowIso(), message });
  if (campaign.logs.length > 1000) campaign.logs.shift();
}

function buildStackPairs(cities = [], industries = [], adapterStack = []) {
  const pairs = [];
  for (const city of cities) {
    const cityStack = Array.isArray(adapterStack)
      ? adapterStack.filter((entry) => cleanEntry(entry).city.toLowerCase() === String(city).toLowerCase())
      : [];
    const effectiveAdapters = cityStack.length
      ? cityStack.map((entry) => cleanEntry(entry).adapterId).filter(Boolean)
      : getEnabledAdapters().map((adapter) => adapter.id);
    for (const industry of industries) {
      for (const adapterId of effectiveAdapters) {
        pairs.push({ city, industry, adapterId });
      }
    }
  }
  return pairs;
}

function cleanEntry(entry = {}) {
  return {
    city: String(entry.city ?? "").trim(),
    adapterId: String(entry.adapterId ?? "").trim(),
  };
}

export function getLiveCampaign(campaignId) {
  return liveCampaigns.get(campaignId) ?? campaignQueue.get(campaignId) ?? null;
}

export function setLiveCampaign(campaign) {
  if (!campaign?.id) return;
  const view = enrichCampaignView(campaign);
  liveCampaigns.set(campaign.id, view);
  campaignQueue.set(campaign.id, view);
}

export function getActiveCampaignId() {
  return null;
}

function assertCampaignSlot(campaignId) {
  return campaignId;
}

export async function executeDiscoveryCampaign(config, { campaignId: providedId, onProgress, resume = false } = {}) {
  if (resume && providedId) {
    return resumeDiscoveryCampaign(providedId, { onProgress });
  }

  const selection = normalizeCampaignSelection(config);
  const maxBusinessesPerSearch = Math.min(
    200,
    Math.max(1, Number(config.maxBusinessesPerSearch ?? config.maxBusinesses) || 25),
  );
  const adapterStack = Array.isArray(config.adapterStack) ? config.adapterStack : [];
  const pairs = buildStackPairs(selection.cities, selection.industries, adapterStack);

  if (!pairs.length) {
    throw new Error("Discovery campaign requires at least one city and one industry.");
  }

  const existing = await findResumableCampaign(selection.regionId);
  if (existing && !config.forceNew) {
    throw new Error(
      `Incomplete campaign ${existing.id} already exists (${existing.completedPairs}/${existing.totalPairs} done). Resume it instead of starting a new one.`,
    );
  }

  const campaignId = providedId || newCampaignId();
  assertCampaignSlot(campaignId);

  const campaign = {
    id: campaignId,
    type: "discovery_campaign",
    regionId: selection.regionId,
    regionName: selection.regionName,
    state: selection.state,
    cities: selection.cities,
    industries: selection.industries,
    adapterStack,
    maxBusinessesPerSearch,
    status: "queued",
    startedAt: nowIso(),
    finishedAt: null,
    totalPairs: pairs.length,
    completedPairs: 0,
    currentPair: null,
    pairResults: [],
    totals: {
      businessesFound: 0,
      qualifiedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
    },
    logs: [],
    error: null,
    executionMode: "distributed_jobs",
  };

  await saveDiscoveryCampaign(campaign);
  liveCampaigns.set(campaignId, campaign);
  appendLog(
    campaign,
    `Queued distributed discovery campaign: ${pairs.length} city×industry×adapter jobs`,
  );
  await saveDiscoveryCampaign(campaign);
  await enqueueDiscoveryJobs(campaign, pairs);
  const synced = await refreshCampaignFromJobs(campaignId);
  const view = enrichCampaignView(synced ?? campaign);
  liveCampaigns.set(campaignId, view);
  campaignQueue.set(campaignId, view);
  onProgress?.(view);
  return view;
}

export async function resumeDiscoveryCampaign(campaignId, { onProgress } = {}) {
  const saved = await getDiscoveryCampaign(campaignId);
  if (!saved) throw new Error("Discovery campaign not found.");
  await requeueIncompleteCampaignJobs(campaignId);
  const jobStats = await getCampaignJobStats(campaignId);
  const campaign = {
    ...saved,
    status: jobStats.status,
    totalPairs: jobStats.totalPairs || saved.totalPairs,
    completedPairs: jobStats.completedPairs,
    currentPair: jobStats.currentPair,
    pairResults: jobStats.pairResults,
    totals: jobStats.totals,
    error: jobStats.error,
    finishedAt: null,
  };
  appendLog(
    campaign,
    `Resumed campaign in distributed mode (${jobStats.remainingPairs} jobs remaining)`,
  );
  await saveDiscoveryCampaign(campaign);
  const view = enrichCampaignView(campaign);
  liveCampaigns.set(campaignId, view);
  campaignQueue.set(campaignId, view);
  onProgress?.(view);
  return view;
}

export function getOpportunityEngineConfig() {
  const preset = getRegionPreset("southeast-texas");
  return {
    activeRegion: preset,
    regions: [preset],
    industries: preset.industries,
    cities: preset.cities,
    funnel: [
      "Qualified Business Database",
      "Opportunity Project",
      "Preview",
      "Launch",
      "Dashboard",
    ],
  };
}

export { campaignQueue };
