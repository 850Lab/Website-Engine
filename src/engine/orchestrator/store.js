import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { unlink } from "node:fs/promises";
import {
  ensureRuntimeDirectories,
  getRuntimeOrchestratorStorePath,
  toRepoRelativePath,
  readJsonWithRetry,
  writeJsonAtomicWithRetry,
  safeFileExists,
  ensureDirectory,
} from "../runtime/index.js";
import { DEFAULT_ORCHESTRATOR_ID, STORE_VERSION } from "./registry.js";

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return structuredClone(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function createEmptyOrchestratorStore(orchestratorId = DEFAULT_ORCHESTRATOR_ID) {
  const createdAt = nowIso();
  return {
    metadata: {
      version: STORE_VERSION,
      orchestratorId,
      createdAt,
      updatedAt: createdAt,
      storageMode: "runtime_only",
    },
    history: [],
  };
}

async function loadStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeOrchestratorStorePath();
  if (!(await safeFileExists(path))) {
    return createEmptyOrchestratorStore();
  }

  const store = await readJsonWithRetry(path, createEmptyOrchestratorStore());
  if (!store.metadata || typeof store.metadata !== "object") {
    store.metadata = createEmptyOrchestratorStore().metadata;
  }
  store.history = asArray(store.history);
  return store;
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const path = getRuntimeOrchestratorStorePath();
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

export async function initializeOrchestratorStore() {
  await ensureRuntimeDirectories();
  return getRuntimeOrchestratorStorePath();
}

export function getOrchestratorStorePath() {
  return getRuntimeOrchestratorStorePath();
}

export async function clearOrchestratorStoreForTests() {
  const path = getRuntimeOrchestratorStorePath();
  if (await safeFileExists(path)) {
    await unlink(path);
  }
}

export async function loadOrchestratorStore() {
  const store = await loadStore();
  return clone(store);
}

export async function appendOrchestratorHistory(entry = {}) {
  const store = await loadStore();
  const record = {
    id: entry.id || `orch_${randomUUID()}`,
    triggerEventId: entry.triggerEventId || null,
    triggerEventType: entry.triggerEventType || null,
    jobType: entry.jobType || null,
    jobId: entry.jobId || null,
    correlationId: entry.correlationId || null,
    causationId: entry.causationId || null,
    idempotencyKey: entry.idempotencyKey || null,
    inputRefs: asArray(entry.inputRefs),
    status: entry.status || "completed",
    createdAt: entry.createdAt || nowIso(),
    metadata: entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {},
  };
  store.history.push(record);
  await saveStore(store);
  return clone(record);
}

export { loadStore, saveStore };
