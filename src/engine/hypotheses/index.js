import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname } from "node:path";
import {
  ensureRuntimeDirectories,
  getRuntimeHypothesisStorePath,
  toRepoRelativePath,
} from "../runtime/index.js";

export const HYPOTHESIS_STATUSES = [
  "generated",
  "supported",
  "contested",
  "promoted",
  "rejected",
  "archived",
];

const ALLOWED_TRANSITIONS = {
  generated: ["supported", "contested", "rejected", "archived"],
  supported: ["contested", "promoted", "rejected", "archived"],
  contested: ["supported", "promoted", "rejected", "archived"],
  promoted: ["archived"],
  rejected: ["archived"],
  archived: [],
};

const STORE_VERSION = "2.6.0";

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return structuredClone(value);
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(values.map(String).filter(Boolean))];
}

async function storeFileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function createEmptyStore() {
  const createdAt = nowIso();
  return {
    metadata: {
      version: STORE_VERSION,
      createdAt,
      updatedAt: createdAt,
      storageMode: "runtime_only",
    },
    hypotheses: [],
    history: [],
  };
}

async function loadStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeHypothesisStorePath();
  if (!(await storeFileExists(path))) {
    return createEmptyStore();
  }
  const raw = await readFile(path, "utf8");
  const store = JSON.parse(raw);
  if (!isObject(store.metadata)) store.metadata = {};
  store.hypotheses = asArray(store.hypotheses);
  store.history = asArray(store.history);
  return store;
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const path = getRuntimeHypothesisStorePath();
  await mkdir(dirname(path), { recursive: true });
  store.metadata = {
    ...store.metadata,
    version: STORE_VERSION,
    updatedAt: nowIso(),
    storageMode: "runtime_only",
    runtimeStorePath: toRepoRelativePath(path),
  };
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  return store;
}

function appendHistory(store, entry) {
  store.history.push({
    id: `hyp_hist_${randomUUID()}`,
    at: nowIso(),
    ...entry,
  });
}

export function validateHypothesisStatus(status) {
  return HYPOTHESIS_STATUSES.includes(status);
}

export function canTransitionHypothesis(fromStatus, toStatus) {
  if (!validateHypothesisStatus(fromStatus) || !validateHypothesisStatus(toStatus)) {
    return false;
  }
  if (fromStatus === toStatus) return false;
  return (ALLOWED_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

export function normalizeHypothesisInput(input = {}) {
  const createdAt = input.createdAt || nowIso();
  return {
    id: input.id || `hyp_${randomUUID()}`,
    title: String(input.title || "").trim(),
    description: String(input.description || "").trim(),
    status: validateHypothesisStatus(input.status) ? input.status : "generated",
    originatingSituationIds: uniqueStrings(input.originatingSituationIds),
    supportingSignalIds: uniqueStrings(input.supportingSignalIds),
    supportingFactIds: uniqueStrings(input.supportingFactIds),
    supportingRelationshipIds: uniqueStrings(input.supportingRelationshipIds),
    competingHypothesisIds: uniqueStrings(input.competingHypothesisIds || []),
    assumptions: asArray(input.assumptions).map(String),
    missingEvidence: asArray(input.missingEvidence),
    confidence: typeof input.confidence === "number" ? input.confidence : 0,
    confidenceBreakdown: isObject(input.confidenceBreakdown) ? input.confidenceBreakdown : {},
    evidenceWeight: typeof input.evidenceWeight === "number" ? input.evidenceWeight : 0,
    contradictionIds: uniqueStrings(input.contradictionIds || []),
    createdAt,
    updatedAt: input.updatedAt || createdAt,
    metadata: isObject(input.metadata) ? input.metadata : {},
  };
}

export async function initializeHypothesisStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeHypothesisStorePath();
  if (!(await storeFileExists(path))) {
    await saveStore(createEmptyStore());
  }
  return path;
}

export async function listHypotheses() {
  const store = await loadStore();
  return clone(store.hypotheses);
}

export async function getHypothesis(id) {
  const store = await loadStore();
  const row = store.hypotheses.find((item) => item.id === id);
  return row ? clone(row) : null;
}

export async function createHypothesis(input = {}) {
  const normalized = normalizeHypothesisInput(input);
  if (!normalized.title) throw new Error("Hypothesis requires title");
  if (!normalized.originatingSituationIds.length) {
    throw new Error("Hypothesis must reference at least one originatingSituationId");
  }

  const store = await loadStore();
  if (store.hypotheses.some((row) => row.id === normalized.id)) {
    throw new Error(`Hypothesis already exists: ${normalized.id}`);
  }

  const hypothesis = {
    ...normalized,
    history: [{ action: "created", at: normalized.createdAt, status: normalized.status }],
  };

  store.hypotheses.push(hypothesis);
  appendHistory(store, { action: "hypothesis_created", hypothesisId: hypothesis.id });
  await saveStore(store);
  return clone(hypothesis);
}

export async function updateHypothesis(id, patch = {}, options = {}) {
  const store = await loadStore();
  const index = store.hypotheses.findIndex((row) => row.id === id);
  if (index === -1) throw new Error(`Hypothesis not found: ${id}`);

  const current = store.hypotheses[index];
  const nextStatus = patch.status || current.status;

  if (patch.status && !canTransitionHypothesis(current.status, patch.status) && !options.force) {
    throw new Error(`Invalid hypothesis transition: ${current.status} -> ${patch.status}`);
  }

  const at = nowIso();
  const updated = {
    ...current,
    ...patch,
    id: current.id,
    status: nextStatus,
    originatingSituationIds: patch.originatingSituationIds
      ? uniqueStrings(patch.originatingSituationIds)
      : current.originatingSituationIds,
    supportingSignalIds: patch.supportingSignalIds
      ? uniqueStrings(patch.supportingSignalIds)
      : current.supportingSignalIds,
    supportingFactIds: patch.supportingFactIds
      ? uniqueStrings(patch.supportingFactIds)
      : current.supportingFactIds,
    supportingRelationshipIds: patch.supportingRelationshipIds
      ? uniqueStrings(patch.supportingRelationshipIds)
      : current.supportingRelationshipIds,
    competingHypothesisIds: patch.competingHypothesisIds
      ? uniqueStrings(patch.competingHypothesisIds)
      : current.competingHypothesisIds,
    contradictionIds: patch.contradictionIds
      ? uniqueStrings(patch.contradictionIds)
      : current.contradictionIds,
    assumptions: patch.assumptions ? asArray(patch.assumptions).map(String) : current.assumptions,
    missingEvidence: patch.missingEvidence ? asArray(patch.missingEvidence) : current.missingEvidence,
    confidenceBreakdown: patch.confidenceBreakdown || current.confidenceBreakdown,
    updatedAt: at,
    history: [
      ...asArray(current.history),
      {
        action: patch.status && patch.status !== current.status ? "status_changed" : "updated",
        at,
        fromStatus: current.status,
        toStatus: nextStatus,
        changes: Object.keys(patch),
      },
    ],
  };

  store.hypotheses[index] = updated;
  appendHistory(store, { action: "hypothesis_updated", hypothesisId: id, status: nextStatus });
  await saveStore(store);
  return clone(updated);
}

export async function getHypothesisSummary() {
  const store = await loadStore();
  const byStatus = Object.fromEntries(HYPOTHESIS_STATUSES.map((status) => [status, 0]));
  for (const row of store.hypotheses) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  }
  return {
    generatedAt: nowIso(),
    total: store.hypotheses.length,
    historyEvents: store.history.length,
    byStatus,
    metadata: clone(store.metadata),
  };
}

export function getHypothesisStorePath() {
  return getRuntimeHypothesisStorePath();
}

export async function clearHypothesisStoreForTests() {
  await saveStore(createEmptyStore());
}

export { ALLOWED_TRANSITIONS as HYPOTHESIS_TRANSITIONS };
