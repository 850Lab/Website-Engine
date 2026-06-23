import { join } from "node:path";
import { DATA_DIR } from "../storage.js";

/** JSON document paths for the locked schema entities. */
export const OFFERS_FILE = join(DATA_DIR, "offers.json");
export const CAMPAIGNS_FILE = join(DATA_DIR, "campaigns.json");
export const BUSINESSES_FILE = join(DATA_DIR, "businesses.json");
export const CONTACTS_FILE = join(DATA_DIR, "contacts.json");
export const OPPORTUNITIES_FILE = join(DATA_DIR, "opportunities.json");
export const QUEUE_ITEMS_FILE = join(DATA_DIR, "queue-items.json");
export const ATTEMPTS_FILE = join(DATA_DIR, "attempts.json");
export const LEARNING_REPORTS_FILE = join(DATA_DIR, "learning-reports.json");

export const SCHEMA_FILES = [
  OFFERS_FILE,
  CAMPAIGNS_FILE,
  BUSINESSES_FILE,
  CONTACTS_FILE,
  OPPORTUNITIES_FILE,
  QUEUE_ITEMS_FILE,
  ATTEMPTS_FILE,
  LEARNING_REPORTS_FILE,
];
