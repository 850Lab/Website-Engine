import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import {
  ensureRuntimeDirectories,
  getRuntimeOfferRecommendationStorePath,
  toRepoRelativePath,
  readJsonWithRetry,
  writeJsonAtomicWithRetry,
  safeFileExists,
  ensureDirectory,
} from "../runtime/index.js";

const STORE_VERSION = "2.8.0";

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
    recommendations: [],
    history: [],
  };
}

async function loadStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeOfferRecommendationStorePath();
  if (!(await storeFileExists(path))) {
    return createEmptyStore();
  }
  const store = await readJsonWithRetry(path, createEmptyStore());
  if (!isObject(store.metadata)) store.metadata = {};
  store.recommendations = asArray(store.recommendations);
  store.history = asArray(store.history);
  return store;
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const path = getRuntimeOfferRecommendationStorePath();
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

function appendHistory(store, entry) {
  store.history.push({
    id: `offer_rec_hist_${randomUUID()}`,
    at: nowIso(),
    ...entry,
  });
}

export function normalizeOfferRecommendation(input = {}) {
  const createdAt = input.createdAt || nowIso();
  return {
    id: input.id || `offer_rec_${randomUUID()}`,
    capabilityMatchId: String(input.capabilityMatchId || ""),
    problemId: String(input.problemId || ""),
    recommendedOffers: asArray(input.recommendedOffers),
    rejectedOffers: asArray(input.rejectedOffers),
    explainability: isObject(input.explainability) ? input.explainability : {},
    offerIntelligenceVersion: input.offerIntelligenceVersion || null,
    inputHash: input.inputHash || null,
    generatedAt: input.generatedAt || createdAt,
    createdAt,
    updatedAt: input.updatedAt || createdAt,
    metadata: isObject(input.metadata) ? input.metadata : {},
  };
}

export async function initializeOfferRecommendationStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeOfferRecommendationStorePath();
  if (!(await storeFileExists(path))) {
    await saveStore(createEmptyStore());
  }
  return path;
}

export async function listOfferRecommendations() {
  const store = await loadStore();
  return clone(store.recommendations);
}

export async function getOfferRecommendation(id) {
  const store = await loadStore();
  const row = store.recommendations.find((item) => item.id === id);
  return row ? clone(row) : null;
}

export async function getOfferRecommendationsByProblemId(problemId) {
  const store = await loadStore();
  return clone(store.recommendations.filter((item) => item.problemId === problemId));
}

export async function getOfferRecommendationsByCapabilityMatchId(capabilityMatchId) {
  const store = await loadStore();
  return clone(store.recommendations.filter((item) => item.capabilityMatchId === capabilityMatchId));
}

export async function saveOfferRecommendation(input = {}) {
  const normalized = normalizeOfferRecommendation(input);
  if (!normalized.capabilityMatchId) {
    throw new Error("Offer recommendation requires capabilityMatchId");
  }
  if (!normalized.problemId) {
    throw new Error("Offer recommendation requires problemId");
  }
  if (!normalized.explainability?.selected) {
    throw new Error("Offer recommendation requires explainability bundle");
  }

  const store = await loadStore();
  if (store.recommendations.some((row) => row.id === normalized.id)) {
    throw new Error(`Offer recommendation already exists: ${normalized.id}`);
  }

  store.recommendations.push(normalized);
  appendHistory(store, {
    action: "offer_recommendation_created",
    recommendationId: normalized.id,
    problemId: normalized.problemId,
    capabilityMatchId: normalized.capabilityMatchId,
  });
  await saveStore(store);
  return clone(normalized);
}

export async function getOfferRecommendationSummary() {
  const store = await loadStore();
  return {
    generatedAt: nowIso(),
    total: store.recommendations.length,
    historyEvents: store.history.length,
    metadata: clone(store.metadata),
  };
}

export function getOfferRecommendationStorePath() {
  return getRuntimeOfferRecommendationStorePath();
}

export async function clearOfferRecommendationStoreForTests() {
  await saveStore(createEmptyStore());
}
