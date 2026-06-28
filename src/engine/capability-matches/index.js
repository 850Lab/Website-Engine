import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname } from "node:path";
import {
  ensureRuntimeDirectories,
  getRuntimeCapabilityMatchStorePath,
  toRepoRelativePath,
} from "../runtime/index.js";

const STORE_VERSION = "2.7.0";

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
    recommendations: [],
    history: [],
  };
}

async function loadStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeCapabilityMatchStorePath();
  if (!(await storeFileExists(path))) {
    return createEmptyStore();
  }
  const raw = await readFile(path, "utf8");
  const store = JSON.parse(raw);
  if (!isObject(store.metadata)) store.metadata = {};
  store.recommendations = asArray(store.recommendations);
  store.history = asArray(store.history);
  return store;
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const path = getRuntimeCapabilityMatchStorePath();
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
    id: `cap_match_hist_${randomUUID()}`,
    at: nowIso(),
    ...entry,
  });
}

export function normalizeRecommendation(input = {}) {
  const createdAt = input.createdAt || nowIso();
  return {
    id: input.id || `cap_match_${randomUUID()}`,
    problemId: String(input.problemId || ""),
    recommendedCapabilities: asArray(input.recommendedCapabilities),
    rejectedCapabilities: asArray(input.rejectedCapabilities),
    compositionPlan: input.compositionPlan || null,
    explainability: isObject(input.explainability) ? input.explainability : {},
    matcherVersion: input.matcherVersion || null,
    inputHash: input.inputHash || null,
    generatedAt: input.generatedAt || createdAt,
    createdAt,
    updatedAt: input.updatedAt || createdAt,
    metadata: isObject(input.metadata) ? input.metadata : {},
  };
}

export async function initializeCapabilityMatchStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeCapabilityMatchStorePath();
  if (!(await storeFileExists(path))) {
    await saveStore(createEmptyStore());
  }
  return path;
}

export async function listCapabilityMatches() {
  const store = await loadStore();
  return clone(store.recommendations);
}

export async function getCapabilityMatch(id) {
  const store = await loadStore();
  const row = store.recommendations.find((item) => item.id === id);
  return row ? clone(row) : null;
}

export async function getCapabilityMatchesByProblemId(problemId) {
  const store = await loadStore();
  return clone(store.recommendations.filter((item) => item.problemId === problemId));
}

export async function saveCapabilityMatch(input = {}) {
  const normalized = normalizeRecommendation(input);
  if (!normalized.problemId) throw new Error("Capability match requires problemId");
  if (!normalized.explainability?.selected) {
    throw new Error("Capability match requires explainability bundle");
  }

  const store = await loadStore();
  if (store.recommendations.some((row) => row.id === normalized.id)) {
    throw new Error(`Capability match already exists: ${normalized.id}`);
  }

  store.recommendations.push(normalized);
  appendHistory(store, { action: "capability_match_created", matchId: normalized.id, problemId: normalized.problemId });
  await saveStore(store);
  return clone(normalized);
}

export async function getCapabilityMatchSummary() {
  const store = await loadStore();
  return {
    generatedAt: nowIso(),
    total: store.recommendations.length,
    historyEvents: store.history.length,
    metadata: clone(store.metadata),
  };
}

export function getCapabilityMatchStorePath() {
  return getRuntimeCapabilityMatchStorePath();
}

export async function clearCapabilityMatchStoreForTests() {
  await saveStore(createEmptyStore());
}
