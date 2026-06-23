/**
 * Schema service layer — routes and legacy modules should import from here,
 * not from src/schema/* directly.
 */

export { listBusinesses, getBusiness, getBusinessByLegacyId } from "./businesses.js";
export { listContacts, getContact, listContactsForBusiness } from "./contacts.js";
export { listCampaigns, getCampaign, getCampaignByOfferSlug } from "./campaigns.js";
export {
  listOpportunities,
  getOpportunity,
  listOpportunitiesForCampaign,
  listOpportunitiesForBusiness,
  saveOpportunity,
} from "./opportunities.js";
export { listQueueItems, getQueueItem, listOpenQueueItemsForCampaign, saveQueueItem, getOpenQueueItemForOpportunity } from "./queue-items.js";
export { listAttempts, getAttempt, saveAttempt } from "./attempts.js";
export { useSchemaQueueReads, useSchemaOutcomeWrites, dualReadValidationEnabled } from "./feature-flags.js";
export {
  clearIdMapCache,
  loadIdMapEntries,
  isLegacyBusinessId,
  isSchemaBusinessId,
  resolveLegacyToBusinessId,
  resolveLegacyToOpportunityId,
  resolveBusinessToLegacyIds,
  resolvePrimaryLegacyId,
  resolveLegacyLeadId,
  resolveSchemaLeadContext,
  resolveLegacyToSchemaContext,
} from "./id-bridge.js";
export {
  recordWebsiteOutcomeWrite,
  recordWebsiteNoteWrite,
  recordPwStatusWrite,
  recordPwNoteWrite,
  getSchemaWriteSnapshot,
} from "./schema-outcomes/record-write.js";
