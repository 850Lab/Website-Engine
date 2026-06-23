import { blobPersistenceEnabled, persistenceBackendLabel } from "../persistence/json-document-store.js";
import { useSchemaQueueReads, useSchemaOutcomeWrites } from "./feature-flags.js";
import { readCollection } from "../schema/collection.js";
import {
  ATTEMPTS_FILE,
  BUSINESSES_FILE,
  OPPORTUNITIES_FILE,
  QUEUE_ITEMS_FILE,
} from "../schema/paths.js";
import { QUALIFIED_BUSINESSES_FILE } from "../stage1/qualified-business-store.js";
import { join } from "node:path";
import { DATA_DIR } from "../storage.js";
import { readJsonDocument } from "../persistence/json-document-store.js";
import { getCampaignByOfferSlug } from "./campaigns.js";
import {
  resolveLegacyToBusinessId,
  resolveLegacyToOpportunityId,
} from "./id-bridge.js";
import { getOpenQueueItemForOpportunity } from "./queue-items.js";
import { getOpportunity } from "./opportunities.js";

const PW_LEADS_FILE = join(DATA_DIR, "pressure-washing-leads.json");

export function getSchemaRuntimeFlags() {
  return {
    USE_SCHEMA_QUEUE_READS: useSchemaQueueReads(),
    USE_SCHEMA_OUTCOME_WRITES: useSchemaOutcomeWrites(),
    queueReadSource: useSchemaQueueReads() ? "schema" : "legacy",
    outcomeWriteMode: useSchemaOutcomeWrites() ? "dual-write" : "legacy-only",
  };
}

export function getSchemaRuntimeDiagnostics() {
  return {
    ...getSchemaRuntimeFlags(),
    persistenceBackend: persistenceBackendLabel(),
    blobPersistenceEnabled: blobPersistenceEnabled(),
  };
}

export async function readSchemaCollectionCounts() {
  const [attempts, businesses, opportunities, queueItems] = await Promise.all([
    readCollection(ATTEMPTS_FILE, "attempts"),
    readCollection(BUSINESSES_FILE, "businesses"),
    readCollection(OPPORTUNITIES_FILE, "opportunities"),
    readCollection(QUEUE_ITEMS_FILE, "queueItems"),
  ]);

  return {
    attempts: attempts.length,
    businesses: businesses.length,
    opportunities: opportunities.length,
    queueItems: queueItems.length,
  };
}

async function readLegacyWebsiteLead(legacyId) {
  const doc = await readJsonDocument(QUALIFIED_BUSINESSES_FILE);
  const records = Array.isArray(doc?.records) ? doc.records : [];
  return records.find((row) => row.id === legacyId) ?? null;
}

async function readLegacyPwLead(legacyId) {
  const doc = await readJsonDocument(PW_LEADS_FILE);
  const leads = Array.isArray(doc?.leads) ? doc.leads : Array.isArray(doc) ? doc : [];
  return leads.find((row) => row.id === legacyId) ?? null;
}

export async function readLeadWriteSnapshot(legacyId, offerSlug) {
  const campaign = await getCampaignByOfferSlug(offerSlug);
  const businessId = await resolveLegacyToBusinessId(legacyId);
  const opportunityId =
    campaign && businessId ? await resolveLegacyToOpportunityId(legacyId, campaign.id) : null;
  const opportunity = opportunityId ? await getOpportunity(opportunityId) : null;
  const queueItem = opportunityId ? await getOpenQueueItemForOpportunity(opportunityId) : null;
  const attempts = opportunityId
    ? (await readCollection(ATTEMPTS_FILE, "attempts")).filter(
        (row) => row.opportunityId === opportunityId,
      )
    : [];

  const legacy =
    offerSlug === "pressure-washing"
      ? await readLegacyPwLead(legacyId)
      : await readLegacyWebsiteLead(legacyId);

  return {
    legacyId,
    offerSlug,
    schema: {
      businessId,
      campaignId: campaign?.id ?? null,
      opportunityId,
      queueItemId: queueItem?.id ?? null,
      attemptCount: attempts.length,
      latestAttemptAt: attempts.at(-1)?.at ?? null,
      outreachStatus: opportunity?.outreachStatus ?? null,
      queueState: queueItem?.state ?? null,
      opportunityUpdatedAt: opportunity?.updatedAt ?? null,
      queueItemUpdatedAt: queueItem?.updatedAt ?? null,
    },
    legacy: legacy
      ? {
          outreachStatus: legacy.outreachStatus ?? legacy.status ?? null,
          queueState: legacy.queueState ?? legacy.websiteQueueState ?? null,
          noteCount: Array.isArray(legacy.salesNotes)
            ? legacy.salesNotes.length
            : Array.isArray(legacy.notes)
              ? legacy.notes.length
              : 0,
          updatedAt: legacy.updatedAt ?? legacy.outreachStatusUpdatedAt ?? null,
        }
      : null,
  };
}
