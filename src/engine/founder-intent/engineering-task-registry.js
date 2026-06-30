import { dirname } from "node:path";
import {
  ensureDirectory,
  ensureRuntimeDirectories,
  getRuntimeEngineeringTaskStorePath,
  readJsonWithRetry,
  toRepoRelativePath,
  writeJsonAtomicWithRetry,
} from "../runtime/index.js";
import { validateEngineeringTask } from "./engineering-director.js";

export const ENGINEERING_TASK_STATUSES = Object.freeze([
  "proposed",
  "approved",
  "active",
  "blocked",
  "completed",
  "cancelled",
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeTaskStatus(status) {
  return ENGINEERING_TASK_STATUSES.includes(status) ? status : "proposed";
}

export function normalizeEngineeringTaskRecord(task = {}) {
  const createdAt = task.createdAt || task.metadata?.createdAt || nowIso();
  return {
    ...task,
    status: normalizeTaskStatus(task.status),
    blockerReason: task.blockerReason || null,
    validationResult: task.validationResult || null,
    commitHash: task.commitHash || null,
    metadata: {
      ...(task.metadata || {}),
      createdAt,
      updatedAt: nowIso(),
    },
  };
}

async function loadStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeEngineeringTaskStorePath();
  const store = await readJsonWithRetry(path, null);
  if (Array.isArray(store?.tasks)) return store;
  return {
    metadata: {
      updatedAt: nowIso(),
      storageMode: "runtime_only",
      runtimeStorePath: toRepoRelativePath(path),
    },
    tasks: [],
  };
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const path = getRuntimeEngineeringTaskStorePath();
  await ensureDirectory(dirname(path));
  store.metadata = {
    ...store.metadata,
    updatedAt: nowIso(),
    storageMode: "runtime_only",
    runtimeStorePath: toRepoRelativePath(path),
  };
  await writeJsonAtomicWithRetry(path, store);
  return path;
}

export async function listEngineeringTasks(options = {}) {
  const store = await loadStore();
  let tasks = store.tasks.map((task) => normalizeEngineeringTaskRecord(task));
  if (options.status) {
    tasks = tasks.filter((task) => task.status === options.status);
  }
  return tasks;
}

export async function getEngineeringTaskById(taskId) {
  const tasks = await listEngineeringTasks();
  return tasks.find((task) => task.taskId === taskId) || null;
}

export async function saveEngineeringTask(task, options = {}) {
  const record = normalizeEngineeringTaskRecord(task);
  if (options.validate !== false) {
    const validation = validateEngineeringTask(record);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }
  }

  const store = await loadStore();
  const index = store.tasks.findIndex((row) => row.taskId === record.taskId);
  if (index >= 0) {
    store.tasks[index] = record;
  } else {
    store.tasks.push(record);
  }
  const path = await saveStore(store);
  return { task: record, path };
}

async function updateTaskStatus(taskId, status, updates = {}) {
  const task = await getEngineeringTaskById(taskId);
  if (!task) throw new Error(`Engineering task not found: ${taskId}`);
  return saveEngineeringTask({
    ...task,
    ...updates,
    status,
    metadata: {
      ...(task.metadata || {}),
      ...(updates.metadata || {}),
      updatedAt: nowIso(),
    },
  });
}

export async function approveEngineeringTask(taskId, metadata = {}) {
  return updateTaskStatus(taskId, "approved", { metadata });
}

export async function activateEngineeringTask(taskId, metadata = {}) {
  return updateTaskStatus(taskId, "active", { metadata });
}

export async function blockEngineeringTask(taskId, blockerReason, metadata = {}) {
  return updateTaskStatus(taskId, "blocked", { blockerReason, metadata });
}

export async function completeEngineeringTask(taskId, updates = {}) {
  return updateTaskStatus(taskId, "completed", updates);
}

export async function cancelEngineeringTask(taskId, metadata = {}) {
  return updateTaskStatus(taskId, "cancelled", { metadata });
}

export async function clearEngineeringTaskStoreForTests() {
  const store = {
    metadata: { updatedAt: nowIso(), storageMode: "runtime_only" },
    tasks: [],
  };
  await saveStore(store);
  return store;
}

export function getEngineeringTaskRegistrySummary(tasks = []) {
  const byStatus = Object.fromEntries(ENGINEERING_TASK_STATUSES.map((status) => [status, 0]));
  for (const task of tasks) {
    const status = normalizeTaskStatus(task.status);
    byStatus[status] = (byStatus[status] || 0) + 1;
  }
  return {
    total: tasks.length,
    byStatus,
    active: byStatus.active || 0,
    blocked: byStatus.blocked || 0,
    completed: byStatus.completed || 0,
  };
}
