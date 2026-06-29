import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import {
  ensureRuntimeDirectories,
  getRuntimeFactStorePath,
  toRepoRelativePath,
  readJsonWithRetry,
  writeJsonAtomicWithRetry,
  safeFileExists,
  ensureDirectory,
} from "../runtime/index.js";
import { mapFactToGraphRefs } from "../knowledge-graph/index.js";
import { entityIdFromLabel } from "./entity-id.js";

export const FACT_PREDICATES = [
  "announced",
  "located_in",
  "mentions_entity",
  "has_signal_type",
  "has_source",
  "has_url",
  "affects_market",
  "affects_capability",
  "has_urgency",
  "observed_at",
];

const REQUIRED_CREATE_FIELDS = ["signalIds", "predicate", "extractor"];

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

function defaultTimeRange() {
  return { start: null, end: null };
}

function defaultLocation() {
  return { city: null, county: null, state: null, country: "US", address: null, facilityName: null };
}

async function storeFileExists(path) {
  return safeFileExists(path);
}

async function readStoreFile(path) {
  if (!(await storeFileExists(path))) return null;
  const store = await readJsonWithRetry(path, null);
  if (!store) return null;
  if (!Array.isArray(store.facts)) store.facts = [];
  if (!isObject(store.metadata)) store.metadata = {};
  return store;
}

async function loadStore() {
  await ensureRuntimeDirectories();
  const runtimePath = getRuntimeFactStorePath();
  const runtimeStore = await readStoreFile(runtimePath);
  return {
    metadata: {
      ...(runtimeStore?.metadata || {}),
      storageMode: "runtime_only",
      runtimeStorePath: toRepoRelativePath(runtimePath),
    },
    facts: runtimeStore?.facts || [],
  };
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const runtimePath = getRuntimeFactStorePath();
  await ensureDirectory(dirname(runtimePath));
  store.metadata = {
    ...store.metadata,
    updatedAt: nowIso(),
    storageMode: "runtime_only",
    runtimeStorePath: toRepoRelativePath(runtimePath),
  };
  await writeJsonAtomicWithRetry(runtimePath, store);
}

export async function initializeRuntimeFactStore() {
  await ensureRuntimeDirectories();
  const runtimePath = getRuntimeFactStorePath();
  if (!(await storeFileExists(runtimePath))) {
    const store = await loadStore();
    await saveStore(store);
  }
  return runtimePath;
}

function createEmptyStore() {
  return {
    metadata: {
      updatedAt: nowIso(),
      storageMode: "runtime_only",
    },
    facts: [],
  };
}

export async function clearFactStoreForTests() {
  await saveStore(createEmptyStore());
}

export function validatePredicate(predicate) {
  return FACT_PREDICATES.includes(predicate);
}

export function normalizeFactInput(input = {}) {
  const signalIds = asArray(input.signalIds).map(String).filter(Boolean);
  const subjectLabel = input.subjectLabel != null ? String(input.subjectLabel).trim() : null;
  const createdAt = input.createdAt || nowIso();

  return {
    id: input.id || `fact_${randomUUID()}`,
    signalIds,
    subjectEntityId: input.subjectEntityId || (subjectLabel ? entityIdFromLabel(subjectLabel) : null),
    subjectLabel,
    predicate: String(input.predicate || "").trim(),
    object: input.object ?? null,
    objectEntityId: input.objectEntityId ?? null,
    value: input.value ?? null,
    unit: input.unit ?? null,
    timeRange: { ...defaultTimeRange(), ...(input.timeRange || {}) },
    location: { ...defaultLocation(), ...(input.location || {}) },
    confidence: typeof input.confidence === "number" ? input.confidence : 0.7,
    evidence: asArray(input.evidence),
    extractor: String(input.extractor || "fact_builder_v0"),
    source: input.source ?? null,
    createdAt,
    updatedAt: input.updatedAt || createdAt,
    graphRefs: asArray(input.graphRefs),
    metadata: isObject(input.metadata) ? input.metadata : {},
  };
}

function validateCreateInput(fact) {
  const errors = [];
  for (const field of REQUIRED_CREATE_FIELDS) {
    if (field === "signalIds") {
      if (!fact.signalIds.length) errors.push("Fact must reference at least one signalId");
      continue;
    }
    if (!fact[field]) errors.push(`Missing required field: ${field}`);
  }
  if (fact.predicate && !validatePredicate(fact.predicate)) {
    errors.push(`Invalid predicate: ${fact.predicate}`);
  }
  return errors;
}

export async function listFacts() {
  const store = await loadStore();
  return clone(store.facts);
}

export async function getFactById(id) {
  const store = await loadStore();
  const fact = store.facts.find((row) => row.id === id);
  return fact ? clone(fact) : null;
}

export async function getFactsBySignalId(signalId) {
  const store = await loadStore();
  return clone(store.facts.filter((row) => row.signalIds.includes(signalId)));
}

export async function getFactsByPredicate(predicate) {
  if (!validatePredicate(predicate)) {
    throw new Error(`Invalid predicate: ${predicate}`);
  }
  const store = await loadStore();
  return clone(store.facts.filter((row) => row.predicate === predicate));
}

export async function createFact(input) {
  const normalized = normalizeFactInput(input);
  const errors = validateCreateInput(normalized);
  if (errors.length) {
    throw new Error(errors.join("; "));
  }

  const store = await loadStore();
  if (store.facts.some((row) => row.id === normalized.id)) {
    throw new Error(`Fact already exists: ${normalized.id}`);
  }

  const graphRefs = mapFactToGraphRefs(normalized);
  const fact = {
    ...normalized,
    graphRefs,
    updatedAt: nowIso(),
  };

  store.facts.push(fact);
  await saveStore(store);
  return clone(fact);
}

export async function getFactSummary() {
  const store = await loadStore();
  const byPredicate = Object.fromEntries(FACT_PREDICATES.map((predicate) => [predicate, 0]));
  const byExtractor = {};
  let newestFact = null;
  let oldestFact = null;

  for (const fact of store.facts) {
    byPredicate[fact.predicate] = (byPredicate[fact.predicate] || 0) + 1;
    byExtractor[fact.extractor] = (byExtractor[fact.extractor] || 0) + 1;

    if (!newestFact || fact.createdAt > newestFact.createdAt) {
      newestFact = { id: fact.id, createdAt: fact.createdAt, predicate: fact.predicate };
    }
    if (!oldestFact || fact.createdAt < oldestFact.createdAt) {
      oldestFact = { id: fact.id, createdAt: fact.createdAt, predicate: fact.predicate };
    }
  }

  return {
    generatedAt: nowIso(),
    total: store.facts.length,
    byPredicate,
    byExtractor,
    newestFact,
    oldestFact,
    metadata: clone(store.metadata),
  };
}

export function getFactStorePath() {
  return getRuntimeFactStorePath();
}

export { entityIdFromLabel } from "./entity-id.js";
