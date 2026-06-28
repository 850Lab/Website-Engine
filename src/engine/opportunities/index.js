import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname } from "node:path";
import {
  ensureRuntimeDirectories,
  getRuntimeOpportunityStorePath,
  toRepoRelativePath,
} from "../runtime/index.js";

export { generateOpportunities } from "./radar.js";

export const OPPORTUNITY_STATUSES = [
  "assembled",
  "validated",
  "ready",
  "executing",
  "won",
  "lost",
  "archived",
];

const STORE_VERSION = "2.9.0";

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
    opportunities: [],
    history: [],
  };
}

async function loadStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeOpportunityStorePath();
  if (!(await storeFileExists(path))) {
    return createEmptyStore();
  }
  const raw = await readFile(path, "utf8");
  const store = JSON.parse(raw);
  if (!isObject(store.metadata)) store.metadata = {};
  store.opportunities = asArray(store.opportunities);
  store.history = asArray(store.history);
  return store;
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const path = getRuntimeOpportunityStorePath();
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
    id: `opp_hist_${randomUUID()}`,
    at: nowIso(),
    ...entry,
  });
}

export function normalizeOpportunityInput(input = {}) {
  const createdAt = input.createdAt || nowIso();
  return {
    id: input.id || `opp_${randomUUID()}`,
    title: String(input.title || "").trim(),
    description: String(input.description || "").trim(),
    problemId: String(input.problemId || ""),
    capabilityMatchId: String(input.capabilityMatchId || ""),
    offerRecommendationId: String(input.offerRecommendationId || ""),
    buyer: isObject(input.buyer) ? input.buyer : {},
    location: isObject(input.location) ? input.location : {},
    industry: input.industry ?? null,
    estimatedValue: isObject(input.estimatedValue) ? input.estimatedValue : {},
    confidence: typeof input.confidence === "number" ? input.confidence : 0,
    executionReadiness: input.executionReadiness || "review_required",
    explainability: isObject(input.explainability) ? input.explainability : {},
    constraints: isObject(input.constraints) ? input.constraints : {},
    recommendedNextAction: isObject(input.recommendedNextAction) ? input.recommendedNextAction : {},
    status: OPPORTUNITY_STATUSES.includes(input.status) ? input.status : "assembled",
    createdAt,
    updatedAt: input.updatedAt || createdAt,
    metadata: isObject(input.metadata) ? input.metadata : {},
  };
}

export async function initializeOpportunityStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeOpportunityStorePath();
  if (!(await storeFileExists(path))) {
    await saveStore(createEmptyStore());
  }
  return path;
}

export async function listOpportunities() {
  const store = await loadStore();
  return clone(store.opportunities);
}

export async function getOpportunityById(id) {
  const store = await loadStore();
  const row = store.opportunities.find((item) => item.id === id);
  return row ? clone(row) : null;
}

export async function getOpportunitiesByProblemId(problemId) {
  const store = await loadStore();
  return clone(store.opportunities.filter((item) => item.problemId === problemId));
}

export async function saveOpportunity(input = {}) {
  const normalized = normalizeOpportunityInput(input);
  if (!normalized.problemId) throw new Error("Opportunity requires problemId");
  if (!normalized.capabilityMatchId) throw new Error("Opportunity requires capabilityMatchId");
  if (!normalized.offerRecommendationId) {
    throw new Error("Opportunity requires offerRecommendationId");
  }
  if (!normalized.explainability?.whatProblem) {
    throw new Error("Opportunity requires explainability bundle");
  }

  const store = await loadStore();
  if (store.opportunities.some((row) => row.id === normalized.id)) {
    throw new Error(`Opportunity already exists: ${normalized.id}`);
  }

  store.opportunities.push(normalized);
  appendHistory(store, {
    action: "opportunity_created",
    opportunityId: normalized.id,
    problemId: normalized.problemId,
    status: normalized.status,
  });
  await saveStore(store);
  return clone(normalized);
}

export async function updateOpportunityStatus(id, status, metadata = {}) {
  if (!OPPORTUNITY_STATUSES.includes(status)) {
    throw new Error(`Invalid opportunity status: ${status}`);
  }

  const store = await loadStore();
  const index = store.opportunities.findIndex((row) => row.id === id);
  if (index === -1) throw new Error(`Opportunity not found: ${id}`);

  store.opportunities[index] = {
    ...store.opportunities[index],
    status,
    updatedAt: nowIso(),
    metadata: { ...store.opportunities[index].metadata, ...metadata },
  };
  appendHistory(store, { action: "opportunity_status_updated", opportunityId: id, status });
  await saveStore(store);
  return clone(store.opportunities[index]);
}

export async function getOpportunitySummary() {
  const store = await loadStore();
  const byStatus = Object.fromEntries(OPPORTUNITY_STATUSES.map((status) => [status, 0]));
  for (const row of store.opportunities) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  }
  return {
    generatedAt: nowIso(),
    total: store.opportunities.length,
    historyEvents: store.history.length,
    byStatus,
    metadata: clone(store.metadata),
  };
}

export function getOpportunityStorePath() {
  return getRuntimeOpportunityStorePath();
}

export async function clearOpportunityStoreForTests() {
  await saveStore(createEmptyStore());
}
