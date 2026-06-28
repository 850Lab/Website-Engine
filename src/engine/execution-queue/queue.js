import { dirname } from "node:path";
import { unlink } from "node:fs/promises";
import { listJobs } from "../jobs/index.js";
import {
  ensureRuntimeDirectories,
  getRuntimeDispatchStorePath,
  toRepoRelativePath,
  readJsonWithRetry,
  writeJsonAtomicWithRetry,
  safeFileExists,
  ensureDirectory,
} from "../runtime/index.js";
import { BLOCKED_JOB_TYPES } from "./routing.js";
import { rankEligibleJobs } from "./priority.js";

export const STORE_VERSION = "3.4.0";
export const DEFAULT_EXECUTION_QUEUE_ID = "execution_queue_main";

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return structuredClone(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isRunnable(job, now = new Date()) {
  if (!job?.runAfter) {
    return true;
  }
  return new Date(job.runAfter).getTime() <= now.getTime();
}

export function createEmptyDispatchStore(queueId = DEFAULT_EXECUTION_QUEUE_ID) {
  const createdAt = nowIso();
  return {
    metadata: {
      version: STORE_VERSION,
      queueId,
      createdAt,
      updatedAt: createdAt,
      storageMode: "runtime_only",
    },
    decisions: [],
  };
}

async function loadStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeDispatchStorePath();
  if (!(await safeFileExists(path))) {
    return createEmptyDispatchStore();
  }

  const store = await readJsonWithRetry(path, createEmptyDispatchStore());
  if (!store.metadata || typeof store.metadata !== "object") {
    store.metadata = createEmptyDispatchStore().metadata;
  }
  store.decisions = asArray(store.decisions);
  return store;
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const path = getRuntimeDispatchStorePath();
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

export async function initializeDispatchStore() {
  await ensureRuntimeDirectories();
  return getRuntimeDispatchStorePath();
}

export function getDispatchStorePath() {
  return getRuntimeDispatchStorePath();
}

export async function clearDispatchStoreForTests() {
  const path = getRuntimeDispatchStorePath();
  if (await safeFileExists(path)) {
    await unlink(path);
  }
}

export async function loadDispatchStore() {
  const store = await loadStore();
  return clone(store);
}

export async function listConsiderableJobs(options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const pending = await listJobs({ status: "pending" });
  const retryable = await listJobs({ status: "retry_wait" });
  return rankEligibleJobs([...pending, ...retryable]).filter((job) => isRunnable(job, now));
}

export async function listEligibleJobs(options = {}) {
  const jobs = await listConsiderableJobs(options);
  return jobs.filter((job) => !BLOCKED_JOB_TYPES.includes(job.type));
}

export { loadStore, saveStore };
