import { cleanText, nowIso } from "../stage1/shared.js";
import { CAMPAIGN_CHANNELS, NORMALIZED_OUTCOMES } from "./constants.js";
import { getRecordById, listRecords, upsertRecord } from "./collection.js";
import { newAttemptId } from "./ids.js";
import { ATTEMPTS_FILE } from "./paths.js";
import { validateAttempt } from "./validate.js";

const COLLECTION_KEY = "attempts";

export function buildAttempt(input = {}) {
  const stamp = nowIso();
  const at = input.at || stamp;

  return {
    id: cleanText(input.id) || newAttemptId(),
    opportunityId: cleanText(input.opportunityId),
    campaignId: cleanText(input.campaignId),
    businessId: cleanText(input.businessId),
    contactId: cleanText(input.contactId) || null,
    queueItemId: cleanText(input.queueItemId) || null,
    operatorId: cleanText(input.operatorId),
    channel: CAMPAIGN_CHANNELS.includes(input.channel) ? input.channel : "Phone",
    outcomeId: cleanText(input.outcomeId),
    normalizedOutcome: NORMALIZED_OUTCOMES.includes(input.normalizedOutcome)
      ? input.normalizedOutcome
      : "attempted",
    scriptUsed: cleanText(input.scriptUsed) || null,
    messageUsed: cleanText(input.messageUsed) || null,
    notes: cleanText(input.notes) || null,
    durationSeconds: input.durationSeconds == null ? null : Number(input.durationSeconds) || 0,
    recordingUrl: cleanText(input.recordingUrl) || null,
    offerId: cleanText(input.offerId),
    offer: cleanText(input.offer),
    buyer: cleanText(input.buyer),
    region: cleanText(input.region),
    campaignChannel: CAMPAIGN_CHANNELS.includes(input.campaignChannel)
      ? input.campaignChannel
      : null,
    campaignConfigVersion: cleanText(input.campaignConfigVersion) || "1",
    businessIndustry: cleanText(input.businessIndustry) || null,
    at,
    createdAt: input.createdAt || stamp,
  };
}

export async function listAttempts() {
  return listRecords(ATTEMPTS_FILE, COLLECTION_KEY);
}

export async function getAttempt(id) {
  return getRecordById(ATTEMPTS_FILE, id, COLLECTION_KEY);
}

export async function listAttemptsForCampaign(campaignId) {
  const attempts = await listAttempts();
  return attempts.filter((row) => row.campaignId === campaignId);
}

export async function listAttemptsForOpportunity(opportunityId) {
  const attempts = await listAttempts();
  return attempts.filter((row) => row.opportunityId === opportunityId);
}

/** Append-only: creates a new attempt; does not update existing records. */
export async function appendAttempt(input = {}) {
  const record = buildAttempt(input);
  validateAttempt(record);
  return upsertRecord(ATTEMPTS_FILE, record, {
    collectionKey: COLLECTION_KEY,
    validate: validateAttempt,
  });
}
