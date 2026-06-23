import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const ROOT_DIR = ROOT;
export const DATA_DIR = join(ROOT, "data");
export const MIGRATION_DIR = join(DATA_DIR, "migration");
export const SEEDS_DIR = join(DATA_DIR, "seeds");
export const REPORT_FILE = join(MIGRATION_DIR, "report.json");
export const ID_MAP_FILE = join(MIGRATION_DIR, "id-map.json");

export const LEGACY_FILES = {
  qualifiedBusinesses: join(DATA_DIR, "qualified-businesses.json"),
  pwLeads: join(DATA_DIR, "pressure-washing-leads.json"),
  outreachFocus: join(DATA_DIR, "outreach-focus.json"),
  websiteQualityScores: join(DATA_DIR, "website-quality-scores.json"),
  angleAnalyses: join(DATA_DIR, "angle-analyses.json"),
  callSessions: join(DATA_DIR, "call-sessions.json"),
};
