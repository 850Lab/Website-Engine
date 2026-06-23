import {
  listQueueItems as listSchemaQueueItems,
  getQueueItem as getSchemaQueueItem,
  listQueueItemsForCampaign as listSchemaQueueItemsForCampaign,
  saveQueueItem as saveSchemaQueueItem,
  getOpenQueueItemForOpportunity as getOpenQueueItemForOpportunitySchema,
} from "../schema/queue-item.js";

const OPEN_STATES = ["available", "active", "follow_up"];

export async function listQueueItems(filters = {}) {
  let rows = await listSchemaQueueItems();
  if (filters.campaignId) {
    rows = rows.filter((row) => row.campaignId === filters.campaignId);
  }
  if (filters.businessId) {
    rows = rows.filter((row) => row.businessId === filters.businessId);
  }
  if (filters.opportunityId) {
    rows = rows.filter((row) => row.opportunityId === filters.opportunityId);
  }
  if (filters.states?.length) {
    const allowed = new Set(filters.states);
    rows = rows.filter((row) => allowed.has(row.state));
  }
  if (filters.openOnly) {
    rows = rows.filter((row) => OPEN_STATES.includes(row.state));
  }
  return rows;
}

export async function getQueueItem(id) {
  return getSchemaQueueItem(id);
}

export async function listOpenQueueItemsForCampaign(campaignId) {
  return listSchemaQueueItemsForCampaign(campaignId).then((rows) =>
    rows.filter((row) => OPEN_STATES.includes(row.state)),
  );
}

export async function saveQueueItem(input = {}) {
  return saveSchemaQueueItem(input);
}

export async function getOpenQueueItemForOpportunity(opportunityId) {
  return getOpenQueueItemForOpportunitySchema(opportunityId);
}
