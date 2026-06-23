import {
  listAttempts as listSchemaAttempts,
  getAttempt as getSchemaAttempt,
  listAttemptsForCampaign as listSchemaAttemptsForCampaign,
  listAttemptsForOpportunity as listSchemaAttemptsForOpportunity,
  appendAttempt as appendSchemaAttempt,
} from "../schema/attempt.js";

export async function listAttempts(filters = {}) {
  let rows = await listSchemaAttempts();
  if (filters.campaignId) {
    rows = rows.filter((row) => row.campaignId === filters.campaignId);
  }
  if (filters.opportunityId) {
    rows = rows.filter((row) => row.opportunityId === filters.opportunityId);
  }
  if (filters.businessId) {
    rows = rows.filter((row) => row.businessId === filters.businessId);
  }
  return rows;
}

export async function getAttempt(id) {
  return getSchemaAttempt(id);
}

export async function saveAttempt(input = {}) {
  return appendSchemaAttempt(input);
}
