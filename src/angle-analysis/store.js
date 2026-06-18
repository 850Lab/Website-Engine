import { join } from "node:path";
import { DATA_DIR } from "../storage.js";
import { nowIso } from "../stage1/shared.js";
import { readJsonDocument, writeJsonDocument } from "../persistence/json-document-store.js";

export const ANGLE_ANALYSES_FILE = join(DATA_DIR, "angle-analyses.json");

const EMPTY_STORE = () => ({
  version: 1,
  updatedAt: nowIso(),
  analyses: {},
  lastBatchRun: null,
});

async function readStore() {
  try {
    const parsed = await readJsonDocument(ANGLE_ANALYSES_FILE);
    if (!parsed) return EMPTY_STORE();
    return {
      version: 1,
      updatedAt: parsed.updatedAt ?? nowIso(),
      analyses: parsed.analyses ?? {},
      lastBatchRun: parsed.lastBatchRun ?? null,
    };
  } catch {
    return EMPTY_STORE();
  }
}

async function writeStore(store) {
  const next = { ...store, updatedAt: nowIso() };
  await writeJsonDocument(ANGLE_ANALYSES_FILE, next);
  return next;
}

export async function getAngleAnalysis(businessId) {
  const store = await readStore();
  return store.analyses[businessId] ?? null;
}

export async function listAngleAnalyses() {
  const store = await readStore();
  return Object.values(store.analyses);
}

export async function upsertAngleAnalysis(businessId, analysis) {
  const store = await readStore();
  store.analyses[businessId] = {
    ...analysis,
    businessId,
    analyzedAt: analysis.analyzedAt ?? nowIso(),
  };
  return writeStore(store);
}

export async function saveBatchRunSummary(summary) {
  const store = await readStore();
  store.lastBatchRun = { ...summary, completedAt: nowIso() };
  return writeStore(store);
}

export async function getAngleAnalysisStore() {
  return readStore();
}
