/**
 * Locked Outreach OS schema — source of truth.
 * Entities: Offer, Campaign, Business, Contact, Opportunity, QueueItem, Attempt, LearningReport
 * Do not add entities without approval.
 */

export { SCHEMA_VERSION, NORMALIZED_OUTCOMES, CAMPAIGN_CHANNELS } from "./constants.js";
export * from "./constants.js";

export * from "./ids.js";
export * from "./paths.js";
export * from "./validate.js";
export { ensureSchemaFiles, SCHEMA_FILES } from "./init.js";

export * from "./offer.js";
export * from "./campaign.js";
export * from "./campaign-match.js";
export * from "./business.js";
export * from "./contact.js";
export * from "./opportunity.js";
export * from "./queue-item.js";
export * from "./attempt.js";
export * from "./learning-report.js";

export {
  listRecords,
  getRecordById,
  readCollection,
  writeCollection,
} from "./collection.js";
