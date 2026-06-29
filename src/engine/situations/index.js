import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import {
  ensureRuntimeDirectories,
  getRuntimeSituationStorePath,
  toRepoRelativePath,
  readJsonWithRetry,
  writeJsonAtomicWithRetry,
  safeFileExists,
  ensureDirectory,
} from "../runtime/index.js";

export const SITUATION_CATEGORIES = [
  "Expansion",
  "Hiring",
  "Infrastructure",
  "Government Funding",
  "Capital Project",
  "Facility Maintenance",
  "Maintenance",
  "Turnaround",
  "Emergency",
  "Permit Activity",
  "Procurement",
  "Acquisition",
  "Unknown",
];

export const SITUATION_STATUSES = ["observed", "growing", "stable", "resolved", "archived"];

const ALLOWED_TRANSITIONS = {
  observed: ["growing", "archived"],
  growing: ["stable", "archived"],
  stable: ["resolved", "archived"],
  resolved: ["archived"],
  archived: [],
};

const STORE_VERSION = "2.5.5";

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

function defaultLocation() {
  return { city: null, county: null, state: null, country: "US", address: null, facilityName: null };
}

function defaultTimeline() {
  return { observedAt: null, start: null, end: null, label: null };
}

function defaultSummary() {
  return {
    evidenceCount: 0,
    factCount: 0,
    relationshipCount: 0,
    signalCount: 0,
    confidence: 0,
    affectedMarkets: [],
    affectedCapabilities: [],
    primaryLocation: null,
  };
}

async function storeFileExists(path) {
  return safeFileExists(path);
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
    situations: [],
    history: [],
  };
}

async function loadStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeSituationStorePath();
  if (!(await storeFileExists(path))) {
    return createEmptyStore();
  }
  const store = await readJsonWithRetry(path, createEmptyStore());
  if (!isObject(store.metadata)) store.metadata = {};
  store.situations = asArray(store.situations);
  store.history = asArray(store.history);
  return store;
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const path = getRuntimeSituationStorePath();
  await ensureDirectory(dirname(path));
  store.metadata = {
    ...store.metadata,
    version: STORE_VERSION,
    updatedAt: nowIso(),
    storageMode: "runtime_only",
    runtimeStorePath: toRepoRelativePath(path),
  };
  await writeJsonAtomicWithRetry(path, store);
  return store;
}

export function validateSituationCategory(category) {
  return SITUATION_CATEGORIES.includes(category);
}

export function validateSituationStatus(status) {
  return SITUATION_STATUSES.includes(status);
}

export function canTransitionSituation(fromStatus, toStatus) {
  if (!validateSituationStatus(fromStatus) || !validateSituationStatus(toStatus)) {
    return false;
  }
  if (fromStatus === toStatus) return false;
  return (ALLOWED_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

export function normalizeSituationInput(input = {}) {
  const createdAt = input.createdAt || nowIso();
  const category = validateSituationCategory(input.category)
    ? input.category
    : validateSituationCategory(input.situationType)
      ? input.situationType
      : "Unknown";

  return {
    id: input.id || `sit_${randomUUID()}`,
    title: String(input.title || "").trim(),
    description: String(input.description || "").trim(),
    status: validateSituationStatus(input.status) ? input.status : "observed",
    category,
    situationType: category,
    confidence: typeof input.confidence === "number" ? input.confidence : 0.5,
    entityIds: uniqueStrings(input.entityIds),
    factIds: uniqueStrings(input.factIds),
    relationshipIds: uniqueStrings(input.relationshipIds),
    signalIds: uniqueStrings(input.signalIds),
    marketIds: uniqueStrings(input.marketIds),
    capabilityIds: uniqueStrings(input.capabilityIds),
    graphNodeIds: uniqueStrings(input.graphNodeIds),
    location: { ...defaultLocation(), ...(input.location || {}) },
    timeline: { ...defaultTimeline(), ...(input.timeline || {}) },
    summary: { ...defaultSummary(), ...(input.summary || {}) },
    evidenceScore: typeof input.evidenceScore === "number" ? input.evidenceScore : 0,
    priority: input.priority || "medium",
    tags: uniqueStrings(input.tags),
    createdAt,
    updatedAt: input.updatedAt || createdAt,
    metadata: isObject(input.metadata) ? input.metadata : {},
  };
}

function appendHistory(store, entry) {
  store.history.push({
    id: `sit_hist_${randomUUID()}`,
    at: nowIso(),
    ...entry,
  });
}

export async function initializeSituationStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeSituationStorePath();
  if (!(await storeFileExists(path))) {
    await saveStore(createEmptyStore());
  }
  return path;
}

export async function listSituations() {
  const store = await loadStore();
  return clone(store.situations);
}

export async function getSituation(id) {
  const store = await loadStore();
  const situation = store.situations.find((row) => row.id === id);
  return situation ? clone(situation) : null;
}

export async function createSituation(input = {}) {
  const normalized = normalizeSituationInput(input);
  if (!normalized.title) {
    throw new Error("Situation requires title");
  }

  const store = await loadStore();
  if (store.situations.some((row) => row.id === normalized.id)) {
    throw new Error(`Situation already exists: ${normalized.id}`);
  }

  const situation = {
    ...normalized,
    history: [
      {
        action: "created",
        at: normalized.createdAt,
        status: normalized.status,
      },
    ],
  };

  store.situations.push(situation);
  appendHistory(store, {
    action: "situation_created",
    situationId: situation.id,
    status: situation.status,
  });
  await saveStore(store);
  return clone(situation);
}

export async function updateSituation(id, patch = {}, options = {}) {
  const store = await loadStore();
  const index = store.situations.findIndex((row) => row.id === id);
  if (index === -1) {
    throw new Error(`Situation not found: ${id}`);
  }

  const current = store.situations[index];
  const nextStatus = patch.status || current.status;

  if (patch.status && !canTransitionSituation(current.status, patch.status) && !options.force) {
    throw new Error(`Invalid situation transition: ${current.status} -> ${patch.status}`);
  }

  const at = nowIso();
  const updated = {
    ...current,
    ...patch,
    id: current.id,
    status: nextStatus,
    entityIds: patch.entityIds ? uniqueStrings(patch.entityIds) : current.entityIds,
    factIds: patch.factIds ? uniqueStrings(patch.factIds) : current.factIds,
    relationshipIds: patch.relationshipIds
      ? uniqueStrings(patch.relationshipIds)
      : current.relationshipIds,
    signalIds: patch.signalIds ? uniqueStrings(patch.signalIds) : current.signalIds,
    marketIds: patch.marketIds ? uniqueStrings(patch.marketIds) : current.marketIds,
    capabilityIds: patch.capabilityIds ? uniqueStrings(patch.capabilityIds) : current.capabilityIds,
    graphNodeIds: patch.graphNodeIds ? uniqueStrings(patch.graphNodeIds) : current.graphNodeIds,
    tags: patch.tags ? uniqueStrings(patch.tags) : current.tags,
    summary: patch.summary ? { ...current.summary, ...patch.summary } : current.summary,
    location: patch.location ? { ...current.location, ...patch.location } : current.location,
    timeline: patch.timeline ? { ...current.timeline, ...patch.timeline } : current.timeline,
    metadata: { ...current.metadata, ...(patch.metadata || {}) },
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

  store.situations[index] = updated;
  appendHistory(store, {
    action: "situation_updated",
    situationId: id,
    status: updated.status,
    changes: Object.keys(patch),
  });
  await saveStore(store);
  return clone(updated);
}

export async function getSituationSummary() {
  const store = await loadStore();
  const byStatus = Object.fromEntries(SITUATION_STATUSES.map((status) => [status, 0]));
  const byCategory = Object.fromEntries(SITUATION_CATEGORIES.map((category) => [category, 0]));

  for (const situation of store.situations) {
    byStatus[situation.status] = (byStatus[situation.status] || 0) + 1;
    byCategory[situation.category || situation.situationType || "Unknown"] =
      (byCategory[situation.category || situation.situationType || "Unknown"] || 0) + 1;
  }

  return {
    generatedAt: nowIso(),
    total: store.situations.length,
    historyEvents: store.history.length,
    byStatus,
    byCategory,
    metadata: clone(store.metadata),
  };
}

export function getSituationStorePath() {
  return getRuntimeSituationStorePath();
}

export async function clearSituationStoreForTests() {
  await saveStore(createEmptyStore());
}

export { ALLOWED_TRANSITIONS as SITUATION_TRANSITIONS };
