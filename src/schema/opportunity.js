import { cleanText, nowIso } from "../stage1/shared.js";
import { CAMPAIGN_CHANNELS, OPPORTUNITY_STATUSES } from "./constants.js";
import { readCollection, upsertRecord, getRecordById, listRecords } from "./collection.js";
import { newOpportunityId } from "./ids.js";
import { OPPORTUNITIES_FILE } from "./paths.js";
import { assertOpportunityPairUnique, validateOpportunity } from "./validate.js";

const COLLECTION_KEY = "opportunities";

export function buildOpportunity(input = {}) {
  const stamp = nowIso();

  return {
    id: cleanText(input.id) || newOpportunityId(),
    campaignId: cleanText(input.campaignId),
    businessId: cleanText(input.businessId),
    status: OPPORTUNITY_STATUSES.includes(input.status) ? input.status : "pending",
    qualificationReason: cleanText(input.qualificationReason) || null,
    score: input.score == null ? null : Number(input.score),
    priorityLabel: cleanText(input.priorityLabel) || null,
    recommendedAngle: cleanText(input.recommendedAngle) || null,
    recommendedScript: cleanText(input.recommendedScript) || null,
    recommendedOffer: cleanText(input.recommendedOffer) || null,
    outreachStatus: cleanText(input.outreachStatus) || "not_contacted",
    offerId: cleanText(input.offerId),
    offer: cleanText(input.offer),
    buyer: cleanText(input.buyer),
    region: cleanText(input.region),
    channel: CAMPAIGN_CHANNELS.includes(input.channel) ? input.channel : "Phone",
    campaignConfigVersion: cleanText(input.campaignConfigVersion) || "1",
    assignedOperatorId: cleanText(input.assignedOperatorId) || null,
    lastContactedAt: input.lastContactedAt || null,
    nextFollowUpAt: input.nextFollowUpAt || null,
    closedAt: input.closedAt || null,
    closedReason: cleanText(input.closedReason) || null,
    createdAt: input.createdAt || stamp,
    updatedAt: stamp,
  };
}

export async function listOpportunities() {
  return listRecords(OPPORTUNITIES_FILE, COLLECTION_KEY);
}

export async function getOpportunity(id) {
  return getRecordById(OPPORTUNITIES_FILE, id, COLLECTION_KEY);
}

export async function getOpportunityForPair(campaignId, businessId) {
  const opportunities = await listOpportunities();
  return (
    opportunities.find(
      (row) => row.campaignId === campaignId && row.businessId === businessId,
    ) ?? null
  );
}

export async function listOpportunitiesForCampaign(campaignId) {
  const opportunities = await listOpportunities();
  return opportunities.filter((row) => row.campaignId === campaignId);
}

export async function listOpportunitiesForBusiness(businessId) {
  const opportunities = await listOpportunities();
  return opportunities.filter((row) => row.businessId === businessId);
}

export async function saveOpportunity(input = {}) {
  const existing = input.id ? await getOpportunity(input.id) : null;
  const record = buildOpportunity({ ...existing, ...input, updatedAt: nowIso() });
  validateOpportunity(record);

  const records = await readCollection(OPPORTUNITIES_FILE, COLLECTION_KEY);
  assertOpportunityPairUnique(records, record.campaignId, record.businessId, record.id);

  return upsertRecord(OPPORTUNITIES_FILE, record, {
    collectionKey: COLLECTION_KEY,
    validate: validateOpportunity,
  });
}
