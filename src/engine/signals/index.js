import { createHash, randomUUID } from "node:crypto";
import { dirname } from "node:path";
import {
  ensureRuntimeDirectories,
  getLegacySignalStorePath,
  getRuntimeSignalStorePath,
  toRepoRelativePath,
  readJsonWithRetry,
  writeJsonAtomicWithRetry,
  safeFileExists,
  ensureDirectory,
} from "../runtime/index.js";
import { buildCalibratedDedupKey } from "./dedup.js";

const LEGACY_STORE_PATH = getLegacySignalStorePath();

export const SIGNAL_TYPES = [
  "permit",
  "rfp",
  "bid_award",
  "hiring_spike",
  "expansion",
  "shutdown",
  "turnaround",
  "maintenance",
  "funding",
  "acquisition",
  "weather_event",
  "government_agenda",
  "public_budget",
  "contract_award",
  "regulatory_change",
  "company_news",
  "social_signal",
  "crm_event",
  "unknown",
];

export const PROCESSING_STATES = [
  "captured",
  "normalized",
  "deduped",
  "classified",
  "entity_linked",
  "problem_inferred",
  "opportunity_generated",
  "archived",
  "rejected",
];

export const URGENCY_LEVELS = ["low", "medium", "high", "critical"];

export const SOURCE_TYPES = [
  "manual",
  "government_feed",
  "connector",
  "crm_webhook",
  "news_feed",
  "file_import",
  "unknown",
];

const TERMINAL_STATES = new Set(["archived", "rejected"]);

const OBSERVATION_FIELDS = new Set([
  "id",
  "source",
  "sourceType",
  "observedAt",
  "capturedAt",
  "location",
  "geo",
  "entitiesMentioned",
  "headline",
  "summary",
  "rawTextRef",
  "url",
  "evidence",
  "confidence",
  "freshness",
  "signalType",
  "urgency",
  "affectedMarkets",
  "affectedCapabilities",
  "possibleProblems",
  "possibleOpportunities",
  "hash",
  "dedupKey",
  "riskFlags",
  "provenance",
  "createdAt",
]);

const ALLOWED_TRANSITIONS = {
  captured: ["normalized", "rejected"],
  normalized: ["deduped", "classified", "rejected", "archived"],
  deduped: ["classified", "rejected", "archived"],
  classified: ["entity_linked", "rejected", "archived"],
  entity_linked: ["problem_inferred", "rejected", "archived"],
  problem_inferred: ["opportunity_generated", "rejected", "archived"],
  opportunity_generated: ["archived"],
  archived: [],
  rejected: [],
};

const REQUIRED_CREATE_FIELDS = [
  "source",
  "sourceType",
  "observedAt",
  "headline",
  "rawTextRef",
  "signalType",
];

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

function defaultLocation() {
  return { city: null, county: null, state: null, country: "US", address: null, facilityName: null };
}

function defaultGeo() {
  return { lat: null, lng: null, region: null, metro: null, h3: null };
}

function defaultFreshness(observedAt, capturedAt) {
  const observed = new Date(observedAt).getTime();
  const captured = new Date(capturedAt).getTime();
  const ageHours = Math.max(0, Math.round((captured - observed) / (1000 * 60 * 60)));
  const decayScore = Math.max(0, Math.min(1, 1 - ageHours / (24 * 30)));
  return {
    ageHours,
    decayScore: Number(decayScore.toFixed(3)),
    staleAfter: null,
  };
}

function hashPayload(payload) {
  return `sha256:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function buildDedupKey(input) {
  return buildCalibratedDedupKey(input);
}

function buildHashInput(signal) {
  return {
    source: signal.source,
    sourceType: signal.sourceType,
    observedAt: signal.observedAt,
    headline: signal.headline,
    summary: signal.summary,
    rawTextRef: signal.rawTextRef,
    url: signal.url,
    signalType: signal.signalType,
    location: signal.location,
    dedupKey: signal.dedupKey,
    contentHash: signal.provenance?.contentHash || null,
  };
}

async function storeFileExists(path) {
  return safeFileExists(path);
}

async function readStoreFile(path) {
  if (!(await storeFileExists(path))) return null;
  const store = await readJsonWithRetry(path, null);
  if (!store) return null;
  if (!Array.isArray(store.signals)) store.signals = [];
  if (!isObject(store.metadata)) store.metadata = {};
  return store;
}

async function loadStore() {
  await ensureRuntimeDirectories();

  const legacyStore = await readStoreFile(LEGACY_STORE_PATH);
  const runtimeStore = await readStoreFile(getRuntimeSignalStorePath());
  const mergedById = new Map();

  for (const signal of legacyStore?.signals || []) {
    mergedById.set(signal.id, signal);
  }
  for (const signal of runtimeStore?.signals || []) {
    mergedById.set(signal.id, signal);
  }

  return {
    metadata: {
      ...(legacyStore?.metadata || {}),
      ...(runtimeStore?.metadata || {}),
      storageMode: "runtime_preferred",
      legacyStorePath: toRepoRelativePath(LEGACY_STORE_PATH),
      runtimeStorePath: toRepoRelativePath(getRuntimeSignalStorePath()),
    },
    signals: [...mergedById.values()],
  };
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const runtimePath = getRuntimeSignalStorePath();
  await ensureDirectory(dirname(runtimePath));
  store.metadata = {
    ...store.metadata,
    updatedAt: nowIso(),
    storageMode: "runtime_preferred",
    runtimeStorePath: toRepoRelativePath(runtimePath),
  };
  await writeJsonAtomicWithRetry(runtimePath, store);
}

function createEmptyStore() {
  return {
    metadata: {
      updatedAt: nowIso(),
      storageMode: "runtime_preferred",
    },
    signals: [],
  };
}

export async function clearSignalStoreForTests() {
  const empty = createEmptyStore();
  await saveStore(empty);
  if (await storeFileExists(LEGACY_STORE_PATH)) {
    await writeJsonAtomicWithRetry(LEGACY_STORE_PATH, clone(empty));
  }
}

export async function initializeRuntimeSignalStore() {
  await ensureRuntimeDirectories();
  const runtimePath = getRuntimeSignalStorePath();
  if (!(await storeFileExists(runtimePath))) {
    const store = await loadStore();
    await saveStore(store);
  }
  return runtimePath;
}

export function getSignalStorePaths() {
  return {
    legacy: LEGACY_STORE_PATH,
    runtime: getRuntimeSignalStorePath(),
    writeTarget: getRuntimeSignalStorePath(),
  };
}

export function validateSignalType(signalType) {
  return SIGNAL_TYPES.includes(signalType);
}

export function validateProcessingState(state) {
  return PROCESSING_STATES.includes(state);
}

export function validateUrgency(urgency) {
  return URGENCY_LEVELS.includes(urgency);
}

export function validateSourceType(sourceType) {
  return SOURCE_TYPES.includes(sourceType);
}

export function canTransition(fromState, toState, metadata = {}) {
  if (!validateProcessingState(fromState) || !validateProcessingState(toState)) {
    return false;
  }
  if (fromState === toState) return false;

  if (fromState === "rejected" && metadata.manualOverride === true) {
    return toState === "normalized";
  }

  if (TERMINAL_STATES.has(fromState) && metadata.manualOverride !== true) {
    return false;
  }

  if (fromState === "opportunity_generated" && toState === "captured") {
    return false;
  }

  return (ALLOWED_TRANSITIONS[fromState] || []).includes(toState);
}

export function normalizeSignal(signal) {
  const observedAt = signal.observedAt || nowIso();
  const capturedAt = signal.capturedAt || nowIso();
  const normalized = {
    id: signal.id || `sig_${randomUUID()}`,
    source: String(signal.source || "").trim(),
    sourceType: signal.sourceType || "unknown",
    observedAt,
    capturedAt,
    location: { ...defaultLocation(), ...(signal.location || {}) },
    geo: { ...defaultGeo(), ...(signal.geo || {}) },
    entitiesMentioned: asArray(signal.entitiesMentioned),
    headline: String(signal.headline || "").trim(),
    summary: String(signal.summary || signal.headline || "").trim().slice(0, 500),
    rawTextRef: String(signal.rawTextRef || "").trim(),
    url: signal.url ?? null,
    evidence: asArray(signal.evidence),
    confidence: typeof signal.confidence === "number" ? signal.confidence : 0.5,
    freshness: signal.freshness || defaultFreshness(observedAt, capturedAt),
    signalType: signal.signalType,
    urgency: validateUrgency(signal.urgency) ? signal.urgency : "medium",
    affectedMarkets: asArray(signal.affectedMarkets),
    affectedCapabilities: asArray(signal.affectedCapabilities),
    possibleProblems: asArray(signal.possibleProblems),
    possibleOpportunities: asArray(signal.possibleOpportunities),
    processingState: signal.processingState || "captured",
    provenance: isObject(signal.provenance) ? signal.provenance : {},
    hash: signal.hash || null,
    dedupKey: buildDedupKey(signal),
    riskFlags: asArray(signal.riskFlags),
    factIds: asArray(signal.factIds),
    entityIds: asArray(signal.entityIds),
    problemIds: asArray(signal.problemIds),
    opportunityIds: asArray(signal.opportunityIds),
    lifecycle: asArray(signal.lifecycle),
    createdAt: signal.createdAt || nowIso(),
    updatedAt: signal.updatedAt || nowIso(),
  };

  if (!normalized.hash) {
    normalized.hash = hashPayload(buildHashInput(normalized));
  }

  if (normalized.signalType === "social_signal" && normalized.confidence > 0.5) {
    normalized.confidence = 0.5;
  }

  return normalized;
}

function validateCreateInput(signal) {
  const errors = [];
  for (const field of REQUIRED_CREATE_FIELDS) {
    if (!signal[field]) errors.push(`Missing required field: ${field}`);
  }
  if (signal.signalType && !validateSignalType(signal.signalType)) {
    errors.push(`Invalid signalType: ${signal.signalType}`);
  }
  if (signal.sourceType && !validateSourceType(signal.sourceType)) {
    errors.push(`Invalid sourceType: ${signal.sourceType}`);
  }
  if (signal.urgency && !validateUrgency(signal.urgency)) {
    errors.push(`Invalid urgency: ${signal.urgency}`);
  }

  const observedAt = new Date(signal.observedAt).getTime();
  const capturedAt = new Date(signal.capturedAt || nowIso()).getTime();
  if (Number.isNaN(observedAt)) errors.push("Invalid observedAt");
  if (Number.isNaN(capturedAt)) errors.push("Invalid capturedAt");
  if (!Number.isNaN(observedAt) && !Number.isNaN(capturedAt)) {
    const skewMs = 5 * 60 * 1000;
    if (observedAt > capturedAt + skewMs) {
      errors.push("observedAt must be <= capturedAt (5 minute skew tolerance)");
    }
  }

  return errors;
}

function assertNoObservationPatch(patch) {
  for (const key of Object.keys(patch)) {
    if (OBSERVATION_FIELDS.has(key)) {
      throw new Error(`Observation field is immutable: ${key}`);
    }
  }
}

const PIPELINE_METADATA_FIELDS = new Set([
  "factIds",
  "entityIds",
  "problemIds",
  "opportunityIds",
  "manualOverride",
]);

export async function listSignals() {
  const store = await loadStore();
  return clone(store.signals);
}

export async function getSignalById(id) {
  const store = await loadStore();
  const signal = store.signals.find((row) => row.id === id);
  return signal ? clone(signal) : null;
}

export async function getSignalsByState(state) {
  if (!validateProcessingState(state)) {
    throw new Error(`Invalid processing state: ${state}`);
  }
  const store = await loadStore();
  return clone(store.signals.filter((row) => row.processingState === state));
}

export async function getSignalsBySource(source) {
  const store = await loadStore();
  return clone(store.signals.filter((row) => row.source === source));
}

export async function getSignalsByType(signalType) {
  if (!validateSignalType(signalType)) {
    throw new Error(`Invalid signal type: ${signalType}`);
  }
  const store = await loadStore();
  return clone(store.signals.filter((row) => row.signalType === signalType));
}

export async function createSignal(input) {
  const normalized = normalizeSignal({
    ...input,
    processingState: "captured",
    capturedAt: input.capturedAt || nowIso(),
    lifecycle: [],
  });

  const errors = validateCreateInput(normalized);
  if (errors.length) {
    throw new Error(errors.join("; "));
  }

  const store = await loadStore();
  const duplicate = store.signals.find(
    (row) => row.hash === normalized.hash || row.dedupKey === normalized.dedupKey,
  );
  if (duplicate) {
    throw new Error(`Duplicate signal detected: ${duplicate.id}`);
  }

  const createdAt = nowIso();
  const signal = {
    ...normalized,
    processingState: "captured",
    lifecycle: [
      {
        from: null,
        to: "captured",
        at: createdAt,
        metadata: { action: "create" },
      },
    ],
    createdAt,
    updatedAt: createdAt,
  };

  store.signals.push(signal);
  await saveStore(store);
  return clone(signal);
}

export async function updateSignalState(id, nextState, metadata = {}) {
  if (!validateProcessingState(nextState)) {
    throw new Error(`Invalid processing state: ${nextState}`);
  }

  const store = await loadStore();
  const index = store.signals.findIndex((row) => row.id === id);
  if (index === -1) {
    throw new Error(`Signal not found: ${id}`);
  }

  const current = store.signals[index];
  if (!canTransition(current.processingState, nextState, metadata)) {
    throw new Error(
      `Invalid transition: ${current.processingState} -> ${nextState}`,
    );
  }

  const pipelinePatch = {};
  for (const key of PIPELINE_METADATA_FIELDS) {
    if (metadata[key] !== undefined) pipelinePatch[key] = metadata[key];
  }
  assertNoObservationPatch(pipelinePatch);

  const at = nowIso();
  const lifecycleEvent = {
    from: current.processingState,
    to: nextState,
    at,
    metadata: isObject(metadata) ? metadata : {},
  };

  const updated = {
    ...current,
    processingState: nextState,
    lifecycle: [...asArray(current.lifecycle), lifecycleEvent],
    updatedAt: at,
  };

  if (pipelinePatch.factIds) updated.factIds = asArray(pipelinePatch.factIds);
  if (pipelinePatch.entityIds) updated.entityIds = asArray(pipelinePatch.entityIds);
  if (pipelinePatch.problemIds) updated.problemIds = asArray(pipelinePatch.problemIds);
  if (pipelinePatch.opportunityIds) {
    updated.opportunityIds = asArray(pipelinePatch.opportunityIds);
    if (nextState === "opportunity_generated") {
      updated.possibleOpportunities = asArray(pipelinePatch.opportunityIds);
    }
  }

  store.signals[index] = updated;
  await saveStore(store);
  return clone(updated);
}

export async function linkFactsToSignal(signalId, factIds, metadata = {}) {
  if (!Array.isArray(factIds) || !factIds.length) {
    throw new Error("linkFactsToSignal requires at least one factId");
  }

  const store = await loadStore();
  const index = store.signals.findIndex((row) => row.id === signalId);
  if (index === -1) {
    throw new Error(`Signal not found: ${signalId}`);
  }

  const current = store.signals[index];
  const mergedFactIds = [...new Set([...asArray(current.factIds), ...factIds.map(String)])];
  const at = nowIso();

  const updated = {
    ...current,
    factIds: mergedFactIds,
    updatedAt: at,
    lifecycle: [
      ...asArray(current.lifecycle),
      {
        from: current.processingState,
        to: current.processingState,
        at,
        metadata: {
          action: "facts_linked",
          factIds: factIds.map(String),
          ...(isObject(metadata) ? metadata : {}),
        },
      },
    ],
  };

  store.signals[index] = updated;
  await saveStore(store);
  return clone(updated);
}

export async function getSignalRegistrySummary() {
  const store = await loadStore();
  const byState = Object.fromEntries(PROCESSING_STATES.map((state) => [state, 0]));
  const bySource = {};
  const byType = Object.fromEntries(SIGNAL_TYPES.map((type) => [type, 0]));

  let newestSignal = null;
  let oldestSignal = null;
  let signalsToday = 0;
  let reachedNormalized = 0;
  let reachedClassified = 0;
  let unknownSignals = 0;

  const todayPrefix = nowIso().slice(0, 10);

  for (const signal of store.signals) {
    byState[signal.processingState] = (byState[signal.processingState] || 0) + 1;
    bySource[signal.source] = (bySource[signal.source] || 0) + 1;
    byType[signal.signalType] = (byType[signal.signalType] || 0) + 1;

    if (signal.signalType === "unknown") unknownSignals += 1;
    if ((signal.capturedAt || "").startsWith(todayPrefix)) signalsToday += 1;

    const lifecycle = asArray(signal.lifecycle);
    if (lifecycle.some((event) => event.to === "normalized")) reachedNormalized += 1;
    if (lifecycle.some((event) => event.to === "classified")) reachedClassified += 1;

    if (!newestSignal || signal.capturedAt > newestSignal.capturedAt) {
      newestSignal = { id: signal.id, capturedAt: signal.capturedAt, headline: signal.headline };
    }
    if (!oldestSignal || signal.capturedAt < oldestSignal.capturedAt) {
      oldestSignal = { id: signal.id, capturedAt: signal.capturedAt, headline: signal.headline };
    }
  }

  const total = store.signals.length;
  const normalizationRate = total ? Number((reachedNormalized / total).toFixed(3)) : 0;
  const classificationRate = total ? Number((reachedClassified / total).toFixed(3)) : 0;

  return {
    generatedAt: nowIso(),
    total,
    totalSignals: total,
    signalsToday,
    byState,
    signalsByState: byState,
    bySource,
    signalsBySource: bySource,
    byType,
    signalsByType: byType,
    newestSignal,
    oldestSignal,
    unknownSignals,
    normalizationRate,
    classificationRate,
    metadata: clone(store.metadata),
  };
}

export { ingestManualObservation } from "./ingest-manual.js";
export {
  archiveObservation,
  normalizeObservationInput,
  parseLocationString,
} from "./observations.js";
export { classifySignalRules, UNKNOWN_TYPE } from "./classify.js";
export { buildCalibratedDedupKey } from "./dedup.js";

export {
  ALLOWED_TRANSITIONS,
  OBSERVATION_FIELDS,
  TERMINAL_STATES,
};
