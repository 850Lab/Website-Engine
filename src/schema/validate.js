import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_CONFIG_KEYS,
  CAMPAIGN_STATUSES,
  CONTACT_TYPES,
  LEARNING_REPORT_SCOPE_TYPES,
  NORMALIZED_OUTCOMES,
  OFFER_STATUSES,
  OPPORTUNITY_STATUSES,
  QUEUE_ITEM_STATES,
} from "./constants.js";

function requireString(record, field, entity) {
  const value = record[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${entity}.${field} is required`);
  }
}

function requireEnum(record, field, allowed, entity) {
  requireString(record, field, entity);
  if (!allowed.includes(record[field])) {
    throw new Error(`${entity}.${field} must be one of: ${allowed.join(", ")}`);
  }
}

function requireObject(record, field, entity) {
  const value = record[field];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${entity}.${field} must be an object`);
  }
}

function requireIsoDate(record, field, entity) {
  requireString(record, field, entity);
  if (Number.isNaN(Date.parse(record[field]))) {
    throw new Error(`${entity}.${field} must be a valid ISO datetime`);
  }
}

export function validateOffer(record) {
  requireString(record, "id", "Offer");
  requireString(record, "name", "Offer");
  requireString(record, "slug", "Offer");
  requireEnum(record, "status", OFFER_STATUSES, "Offer");
  requireIsoDate(record, "createdAt", "Offer");
  requireIsoDate(record, "updatedAt", "Offer");
}

export function validateCampaign(record) {
  requireString(record, "id", "Campaign");
  requireString(record, "offerId", "Campaign");
  requireString(record, "buyer", "Campaign");
  requireString(record, "region", "Campaign");
  requireEnum(record, "channel", CAMPAIGN_CHANNELS, "Campaign");
  requireEnum(record, "status", CAMPAIGN_STATUSES, "Campaign");
  requireString(record, "configVersion", "Campaign");
  requireObject(record, "config", "Campaign");
  requireIsoDate(record, "createdAt", "Campaign");
  requireIsoDate(record, "updatedAt", "Campaign");

  for (const key of CAMPAIGN_CONFIG_KEYS) {
    if (!(key in record.config)) {
      throw new Error(`Campaign.config.${key} is required`);
    }
  }
}

export function validateBusiness(record) {
  requireString(record, "id", "Business");
  requireString(record, "name", "Business");
  requireString(record, "region", "Business");
  requireString(record, "dedupKey", "Business");
  requireObject(record, "signals", "Business");
  requireIsoDate(record, "createdAt", "Business");
  requireIsoDate(record, "updatedAt", "Business");
}

export function validateContact(record) {
  requireString(record, "id", "Contact");
  requireString(record, "businessId", "Contact");
  requireEnum(record, "type", CONTACT_TYPES, "Contact");
  requireString(record, "value", "Contact");
  requireString(record, "normalizedValue", "Contact");
  if (typeof record.isPrimary !== "boolean") {
    throw new Error("Contact.isPrimary must be a boolean");
  }
  if (typeof record.isCallable !== "boolean") {
    throw new Error("Contact.isCallable must be a boolean");
  }
  requireIsoDate(record, "createdAt", "Contact");
  requireIsoDate(record, "updatedAt", "Contact");
}

export function validateOpportunity(record) {
  requireString(record, "id", "Opportunity");
  requireString(record, "campaignId", "Opportunity");
  requireString(record, "businessId", "Opportunity");
  requireEnum(record, "status", OPPORTUNITY_STATUSES, "Opportunity");
  requireString(record, "outreachStatus", "Opportunity");
  requireString(record, "offerId", "Opportunity");
  requireString(record, "offer", "Opportunity");
  requireString(record, "buyer", "Opportunity");
  requireString(record, "region", "Opportunity");
  requireEnum(record, "channel", CAMPAIGN_CHANNELS, "Opportunity");
  requireIsoDate(record, "createdAt", "Opportunity");
  requireIsoDate(record, "updatedAt", "Opportunity");
}

export function validateQueueItem(record) {
  requireString(record, "id", "QueueItem");
  requireString(record, "opportunityId", "QueueItem");
  requireString(record, "campaignId", "QueueItem");
  requireString(record, "businessId", "QueueItem");
  requireEnum(record, "state", QUEUE_ITEM_STATES, "QueueItem");
  if (typeof record.priority !== "number" || Number.isNaN(record.priority)) {
    throw new Error("QueueItem.priority must be a number");
  }
  requireString(record, "offer", "QueueItem");
  requireString(record, "buyer", "QueueItem");
  requireString(record, "region", "QueueItem");
  requireEnum(record, "channel", CAMPAIGN_CHANNELS, "QueueItem");
  requireIsoDate(record, "createdAt", "QueueItem");
  requireIsoDate(record, "updatedAt", "QueueItem");
}

export function validateAttempt(record) {
  requireString(record, "id", "Attempt");
  requireString(record, "opportunityId", "Attempt");
  requireString(record, "campaignId", "Attempt");
  requireString(record, "businessId", "Attempt");
  requireString(record, "operatorId", "Attempt");
  requireEnum(record, "channel", CAMPAIGN_CHANNELS, "Attempt");
  requireString(record, "outcomeId", "Attempt");
  requireEnum(record, "normalizedOutcome", NORMALIZED_OUTCOMES, "Attempt");
  requireString(record, "offerId", "Attempt");
  requireString(record, "offer", "Attempt");
  requireString(record, "buyer", "Attempt");
  requireString(record, "region", "Attempt");
  requireIsoDate(record, "at", "Attempt");
  requireIsoDate(record, "createdAt", "Attempt");
}

export function validateLearningReport(record) {
  requireString(record, "id", "LearningReport");
  requireEnum(record, "scopeType", LEARNING_REPORT_SCOPE_TYPES, "LearningReport");
  requireIsoDate(record, "periodFrom", "LearningReport");
  requireIsoDate(record, "periodTo", "LearningReport");
  requireObject(record, "aggregates", "LearningReport");
  requireIsoDate(record, "generatedAt", "LearningReport");
}

export function assertOpportunityPairUnique(records, campaignId, businessId, excludeId = null) {
  const conflict = records.find(
    (row) =>
      row.id !== excludeId &&
      row.campaignId === campaignId &&
      row.businessId === businessId,
  );
  if (conflict) {
    throw new Error(
      `Opportunity already exists for campaign ${campaignId} and business ${businessId}`,
    );
  }
}

export function assertOpenQueueItemUnique(records, opportunityId, excludeId = null) {
  const conflict = records.find(
    (row) =>
      row.id !== excludeId &&
      row.opportunityId === opportunityId &&
      ["available", "active", "follow_up"].includes(row.state),
  );
  if (conflict) {
    throw new Error(`Open queue item already exists for opportunity ${opportunityId}`);
  }
}
