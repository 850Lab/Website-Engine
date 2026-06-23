/** Locked Outreach OS schema — do not add entities without approval. */

export const SCHEMA_VERSION = 1;

export const OFFER_STATUSES = ["active", "archived"];

export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "archived"];

export const CAMPAIGN_CHANNELS = ["Phone", "SMS", "Email", "In Person", "DM"];

export const OPPORTUNITY_STATUSES = [
  "pending",
  "qualified",
  "rejected",
  "queued",
  "in_progress",
  "closed",
];

export const QUEUE_ITEM_STATES = ["available", "active", "follow_up", "completed", "suppressed"];

export const CONTACT_TYPES = ["phone", "email", "sms", "person"];

export const NORMALIZED_OUTCOMES = [
  "attempted",
  "conversation",
  "interested",
  "proposal",
  "appointment",
  "sale",
  "closed_lost",
  "follow_up",
];

export const LEARNING_REPORT_SCOPE_TYPES = ["global", "offer", "campaign", "region"];

/** Required keys inside Campaign.config */
export const CAMPAIGN_CONFIG_KEYS = [
  "discovery",
  "qualificationRules",
  "scoringRules",
  "contactRules",
  "scripts",
  "outcomeLabels",
];

/** Queue states that imply an open (non-terminal) queue item per opportunity. */
export const OPEN_QUEUE_ITEM_STATES = new Set(["available", "active", "follow_up"]);
