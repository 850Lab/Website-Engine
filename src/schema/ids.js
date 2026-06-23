import { randomUUID } from "node:crypto";

export function newOfferId() {
  return `offer_${randomUUID().slice(0, 8)}`;
}

export function newCampaignId() {
  return `camp_${randomUUID().slice(0, 8)}`;
}

export function newBusinessId() {
  return `biz_${randomUUID().slice(0, 8)}`;
}

export function newContactId() {
  return `con_${randomUUID().slice(0, 8)}`;
}

export function newOpportunityId() {
  return `opp_${randomUUID().slice(0, 8)}`;
}

export function newQueueItemId() {
  return `q_${randomUUID().slice(0, 8)}`;
}

export function newAttemptId() {
  return `att_${randomUUID().slice(0, 8)}`;
}

export function newLearningReportId() {
  return `lr_${randomUUID().slice(0, 8)}`;
}
