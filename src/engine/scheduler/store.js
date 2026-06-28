import { dirname } from "node:path";
import { unlink } from "node:fs/promises";
import {
  ensureRuntimeDirectories,
  getRuntimeSchedulerStorePath,
  toRepoRelativePath,
  readJsonWithRetry,
  writeJsonAtomicWithRetry,
  safeFileExists,
  ensureDirectory,
} from "../runtime/index.js";
import { createEmptySchedulerStore, normalizeSchedule, STORE_VERSION } from "./config.js";

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return structuredClone(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function loadStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeSchedulerStorePath();
  if (!(await safeFileExists(path))) {
    return createEmptySchedulerStore();
  }

  const store = await readJsonWithRetry(path, createEmptySchedulerStore());
  if (!store.metadata || typeof store.metadata !== "object") {
    store.metadata = createEmptySchedulerStore().metadata;
  }
  store.jobs = asArray(store.jobs);
  return store;
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const path = getRuntimeSchedulerStorePath();
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

function findSchedule(store, scheduleId) {
  return store.jobs.find((row) => row.id === scheduleId) || null;
}

export async function initializeSchedulerStore() {
  await ensureRuntimeDirectories();
  return getRuntimeSchedulerStorePath();
}

export function getSchedulerStorePath() {
  return getRuntimeSchedulerStorePath();
}

export async function clearSchedulerStoreForTests() {
  const path = getRuntimeSchedulerStorePath();
  if (await safeFileExists(path)) {
    await unlink(path);
  }
}

export async function loadScheduler() {
  const store = await loadStore();
  return clone(store);
}

export async function saveScheduler(store) {
  if (!store || !Array.isArray(store.jobs)) {
    throw new Error("saveScheduler requires store with jobs array");
  }
  await saveStore(store);
  return clone(store);
}

export async function registerSchedule(input = {}) {
  const store = await loadStore();
  const schedule = normalizeSchedule(input);
  if (findSchedule(store, schedule.id)) {
    throw new Error(`Schedule already exists: ${schedule.id}`);
  }

  if (!schedule.nextRun) {
    schedule.nextRun = nowIso();
  }

  store.jobs.push(schedule);
  await saveStore(store);
  return clone(schedule);
}

export async function removeSchedule(scheduleId) {
  const store = await loadStore();
  const before = store.jobs.length;
  store.jobs = store.jobs.filter((row) => row.id !== scheduleId);
  if (store.jobs.length === before) {
    throw new Error(`Schedule not found: ${scheduleId}`);
  }
  await saveStore(store);
  return { removed: scheduleId };
}

export async function listSchedules(options = {}) {
  const store = await loadStore();
  let rows = clone(store.jobs);
  if (options.enabled != null) {
    rows = rows.filter((row) => row.enabled === options.enabled);
  }
  return rows;
}

export { loadStore, saveStore };
