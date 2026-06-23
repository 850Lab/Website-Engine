import { cleanText, nowIso } from "../stage1/shared.js";
import { CAMPAIGN_CHANNELS, QUEUE_ITEM_STATES } from "./constants.js";
import { readCollection, upsertRecord, getRecordById, listRecords } from "./collection.js";
import { newQueueItemId } from "./ids.js";
import { QUEUE_ITEMS_FILE } from "./paths.js";
import { assertOpenQueueItemUnique, validateQueueItem } from "./validate.js";

const COLLECTION_KEY = "queueItems";

export function buildQueueItem(input = {}) {
  const stamp = nowIso();

  return {
    id: cleanText(input.id) || newQueueItemId(),
    opportunityId: cleanText(input.opportunityId),
    campaignId: cleanText(input.campaignId),
    businessId: cleanText(input.businessId),
    state: QUEUE_ITEM_STATES.includes(input.state) ? input.state : "available",
    priority: input.priority == null ? 0 : Number(input.priority) || 0,
    priorityLabel: cleanText(input.priorityLabel) || null,
    offer: cleanText(input.offer),
    buyer: cleanText(input.buyer),
    region: cleanText(input.region),
    channel: CAMPAIGN_CHANNELS.includes(input.channel) ? input.channel : "Phone",
    recommendedAngle: cleanText(input.recommendedAngle) || null,
    recommendedScript: cleanText(input.recommendedScript) || null,
    dueAt: input.dueAt || null,
    promotedAt: input.promotedAt || null,
    assignedOperatorId: cleanText(input.assignedOperatorId) || null,
    createdAt: input.createdAt || stamp,
    updatedAt: stamp,
  };
}

export async function listQueueItems() {
  return listRecords(QUEUE_ITEMS_FILE, COLLECTION_KEY);
}

export async function getQueueItem(id) {
  return getRecordById(QUEUE_ITEMS_FILE, id, COLLECTION_KEY);
}

export async function listQueueItemsForCampaign(campaignId, { state = null } = {}) {
  const items = await listQueueItems();
  return items.filter((row) => {
    if (row.campaignId !== campaignId) return false;
    if (state && row.state !== state) return false;
    return true;
  });
}

export async function getOpenQueueItemForOpportunity(opportunityId) {
  const items = await listQueueItems();
  return (
    items.find(
      (row) =>
        row.opportunityId === opportunityId &&
        ["available", "active", "follow_up"].includes(row.state),
    ) ?? null
  );
}

export async function saveQueueItem(input = {}) {
  const existing = input.id ? await getQueueItem(input.id) : null;
  const record = buildQueueItem({ ...existing, ...input, updatedAt: nowIso() });
  validateQueueItem(record);

  if (["available", "active", "follow_up"].includes(record.state)) {
    const records = await readCollection(QUEUE_ITEMS_FILE, COLLECTION_KEY);
    assertOpenQueueItemUnique(records, record.opportunityId, record.id);
  }

  return upsertRecord(QUEUE_ITEMS_FILE, record, {
    collectionKey: COLLECTION_KEY,
    validate: validateQueueItem,
  });
}
