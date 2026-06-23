import { ensureCollectionFile } from "./collection.js";
import {
  ATTEMPTS_FILE,
  BUSINESSES_FILE,
  CAMPAIGNS_FILE,
  CONTACTS_FILE,
  LEARNING_REPORTS_FILE,
  OFFERS_FILE,
  OPPORTUNITIES_FILE,
  QUEUE_ITEMS_FILE,
  SCHEMA_FILES,
} from "./paths.js";

const COLLECTION_KEYS = {
  [OFFERS_FILE]: "offers",
  [CAMPAIGNS_FILE]: "campaigns",
  [BUSINESSES_FILE]: "businesses",
  [CONTACTS_FILE]: "contacts",
  [OPPORTUNITIES_FILE]: "opportunities",
  [QUEUE_ITEMS_FILE]: "queueItems",
  [ATTEMPTS_FILE]: "attempts",
  [LEARNING_REPORTS_FILE]: "reports",
};

/** Ensure all locked-schema JSON documents exist on disk (empty collections). */
export async function ensureSchemaFiles() {
  for (const filePath of SCHEMA_FILES) {
    await ensureCollectionFile(filePath, COLLECTION_KEYS[filePath]);
  }
}

export { SCHEMA_FILES, COLLECTION_KEYS };
