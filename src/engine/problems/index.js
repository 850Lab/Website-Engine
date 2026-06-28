import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import {
  ensureRuntimeDirectories,
  getRuntimeProblemStorePath,
  toRepoRelativePath,
  readJsonWithRetry,
  writeJsonAtomicWithRetry,
  safeFileExists,
  ensureDirectory,
} from "../runtime/index.js";

export const PROBLEM_STATUSES = ["open", "monitoring", "addressed", "expired", "archived"];

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
    problems: [],
    history: [],
  };
}

async function loadStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeProblemStorePath();
  if (!(await storeFileExists(path))) {
    return createEmptyStore();
  }
  const store = await readJsonWithRetry(path, createEmptyStore());
  if (!isObject(store.metadata)) store.metadata = {};
  store.problems = asArray(store.problems);
  store.history = asArray(store.history);
  return store;
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const path = getRuntimeProblemStorePath();
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
    id: `prob_hist_${randomUUID()}`,
    at: nowIso(),
    ...entry,
  });
}

export function normalizeProblemInput(input = {}) {
  const createdAt = input.createdAt || nowIso();
  return {
    id: input.id || `prob_${randomUUID()}`,
    title: String(input.title || "").trim(),
    description: String(input.description || "").trim(),
    category: String(input.category || input.problemCategory || "unknown"),
    severity: input.severity || "medium",
    urgency: input.urgency || "medium",
    confidence: typeof input.confidence === "number" ? input.confidence : 0,
    supportingHypothesisIds: uniqueStrings(input.supportingHypothesisIds),
    supportingSituationIds: uniqueStrings(input.supportingSituationIds),
    supportingFactIds: uniqueStrings(input.supportingFactIds),
    supportingRelationshipIds: uniqueStrings(input.supportingRelationshipIds),
    supportingSignalIds: uniqueStrings(input.supportingSignalIds),
    affectedMarkets: uniqueStrings(input.affectedMarkets),
    affectedCapabilities: uniqueStrings(input.affectedCapabilities),
    explainability: isObject(input.explainability) ? input.explainability : {},
    status: PROBLEM_STATUSES.includes(input.status) ? input.status : "open",
    createdAt,
    updatedAt: input.updatedAt || createdAt,
    metadata: isObject(input.metadata) ? input.metadata : {},
  };
}

export async function initializeProblemStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeProblemStorePath();
  if (!(await storeFileExists(path))) {
    await saveStore(createEmptyStore());
  }
  return path;
}

export async function listProblems() {
  const store = await loadStore();
  return clone(store.problems);
}

export async function getProblem(id) {
  const store = await loadStore();
  const row = store.problems.find((item) => item.id === id);
  return row ? clone(row) : null;
}

export async function createProblem(input = {}) {
  const normalized = normalizeProblemInput(input);
  if (!normalized.title) throw new Error("Problem requires title");
  if (!normalized.supportingHypothesisIds.length) {
    throw new Error("Problem must reference at least one supportingHypothesisId");
  }
  if (!normalized.supportingSituationIds.length) {
    throw new Error("Problem must reference at least one supportingSituationId");
  }
  if (!normalized.explainability?.why) {
    throw new Error("Problem requires explainability bundle");
  }

  const store = await loadStore();
  if (store.problems.some((row) => row.id === normalized.id)) {
    throw new Error(`Problem already exists: ${normalized.id}`);
  }

  const problem = {
    ...normalized,
    history: [{ action: "created", at: normalized.createdAt, status: normalized.status }],
  };

  store.problems.push(problem);
  appendHistory(store, { action: "problem_created", problemId: problem.id });
  await saveStore(store);
  return clone(problem);
}

export async function getProblemSummary() {
  const store = await loadStore();
  const byStatus = Object.fromEntries(PROBLEM_STATUSES.map((status) => [status, 0]));
  for (const row of store.problems) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  }
  return {
    generatedAt: nowIso(),
    total: store.problems.length,
    historyEvents: store.history.length,
    byStatus,
    metadata: clone(store.metadata),
  };
}

export function getProblemStorePath() {
  return getRuntimeProblemStorePath();
}

export async function clearProblemStoreForTests() {
  await saveStore(createEmptyStore());
}

export function buildExplainability({
  hypothesis,
  evidenceBundle,
  contradictions,
  confidenceResult,
}) {
  const situation = evidenceBundle.situation;
  return {
    why: {
      rule: "hypothesis_promotion_v0",
      hypothesisId: hypothesis.id,
      hypothesisTitle: hypothesis.title,
      problemCategory: hypothesis.metadata?.problemCategoryCandidate,
      confidence: confidenceResult.confidence,
    },
    situations: [
      {
        id: situation.id,
        title: situation.title,
        confidence: situation.confidence,
      },
    ],
    facts: evidenceBundle.facts.map((row) => ({
      id: row.id,
      tier: row.tier,
      predicate: row.predicate,
      confidence: row.confidence,
    })),
    relationships: evidenceBundle.relationships.map((row) => ({
      id: row.id,
      type: row.type,
      tier: row.tier,
      confidence: row.confidence,
    })),
    signals: evidenceBundle.signals.map((row) => ({
      id: row.id,
      tier: row.tier,
      signalType: row.signalType,
      confidence: row.confidence,
    })),
    supports: confidenceResult.reasoning,
    contradicts: contradictions.map((row) => ({
      id: row.id,
      label: row.label,
      status: row.status,
      resolution: row.resolution,
      hypothesisIds: row.hypothesisIds,
    })),
    missingEvidence: evidenceBundle.missingEvidence,
    confidenceFactors: confidenceResult.confidenceBreakdown,
    confidenceLevers: {
      increase: evidenceBundle.missingEvidence
        .filter((row) => row.priority !== "critical")
        .map((row) => row.description),
      decrease: contradictions.map((row) => row.label),
    },
  };
}
