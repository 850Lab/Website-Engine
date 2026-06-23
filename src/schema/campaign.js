import { cleanText, nowIso } from "../stage1/shared.js";
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES } from "./constants.js";
import { getRecordById, listRecords, upsertRecord } from "./collection.js";
import { newCampaignId } from "./ids.js";
import { CAMPAIGNS_FILE } from "./paths.js";
import { validateCampaign } from "./validate.js";

const COLLECTION_KEY = "campaigns";

export function emptyCampaignConfig() {
  return {
    discovery: {
      adapterId: "google_maps",
      searchTargets: [],
      buyerMatchRules: { industryPatterns: [], namePatterns: [], excludePatterns: [] },
    },
    qualificationRules: [],
    scoringRules: [],
    contactRules: { preferredMethods: [], requireCallablePhone: false },
    scripts: {
      openingLine: "",
      followUpLine: "",
      goldenQuestion: "",
      discoveryQuestions: [],
      offerPitch: "",
    },
    outcomeLabels: [],
    learningGoals: { calls: 0, conversations: 0, appointments: 0, sales: 0 },
  };
}

export function buildCampaign(input = {}) {
  const stamp = nowIso();
  const config = {
    ...emptyCampaignConfig(),
    ...(input.config && typeof input.config === "object" ? input.config : {}),
  };

  return {
    id: cleanText(input.id) || newCampaignId(),
    offerId: cleanText(input.offerId),
    buyer: cleanText(input.buyer),
    region: cleanText(input.region),
    channel: CAMPAIGN_CHANNELS.includes(input.channel) ? input.channel : "Phone",
    goal: cleanText(input.goal) || null,
    status: CAMPAIGN_STATUSES.includes(input.status) ? input.status : "draft",
    dailyTarget: input.dailyTarget == null ? null : Number(input.dailyTarget) || 0,
    configVersion: cleanText(input.configVersion) || "1",
    config,
    offerName: cleanText(input.offerName) || null,
    startedAt: input.startedAt || null,
    endedAt: input.endedAt || null,
    createdBy: cleanText(input.createdBy) || null,
    createdAt: input.createdAt || stamp,
    updatedAt: stamp,
  };
}

export async function listCampaigns() {
  return listRecords(CAMPAIGNS_FILE, COLLECTION_KEY);
}

export async function getCampaign(id) {
  return getRecordById(CAMPAIGNS_FILE, id, COLLECTION_KEY);
}

export async function listCampaignsByOffer(offerId) {
  const campaigns = await listCampaigns();
  return campaigns.filter((row) => row.offerId === offerId);
}

export async function listCampaignsByStatus(status) {
  const campaigns = await listCampaigns();
  return campaigns.filter((row) => row.status === status);
}

export async function saveCampaign(input = {}) {
  const existing = input.id ? await getCampaign(input.id) : null;
  const record = buildCampaign({
    ...existing,
    ...input,
    config: { ...(existing?.config ?? {}), ...(input.config ?? {}) },
    updatedAt: nowIso(),
  });
  validateCampaign(record);
  return upsertRecord(CAMPAIGNS_FILE, record, {
    collectionKey: COLLECTION_KEY,
    validate: validateCampaign,
  });
}
