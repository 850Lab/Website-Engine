import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { unlink } from "node:fs/promises";
import { appendEvent, clearEventStoreForTests } from "../events/index.js";
import {
  ensureRuntimeDirectories,
  getRuntimeJobStorePath,
  toRepoRelativePath,
  readJsonWithRetry,
  writeJsonAtomicWithRetry,
  safeFileExists,
  ensureDirectory,
} from "../runtime/index.js";
import { ACTIVE_JOB_STATUSES, deriveIdempotencyKey, findActiveJobByKey } from "./idempotency.js";

export const JOB_STATUSES = [
  "pending",
  "claimed",
  "running",
  "completed",
  "failed",
  "retry_wait",
  "dead_letter",
  "cancelled",
  "archived",
];

export { ACTIVE_JOB_STATUSES, deriveIdempotencyKey } from "./idempotency.js";

const STORE_VERSION = "3.1.0";
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_PRIORITY = 50;
const DEFAULT_BACKOFF_MS = 75;

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

function createEmptyStore() {
  const createdAt = nowIso();
  return {
    metadata: {
      version: STORE_VERSION,
      createdAt,
      updatedAt: createdAt,
      storageMode: "runtime_only",
    },
    jobs: [],
  };
}

async function loadStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeJobStorePath();
  if (!(await safeFileExists(path))) {
    return createEmptyStore();
  }

  const store = await readJsonWithRetry(path, createEmptyStore());
  if (!isObject(store.metadata)) store.metadata = {};
  store.jobs = asArray(store.jobs);
  return store;
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const path = getRuntimeJobStorePath();
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

function findJob(store, jobId) {
  return store.jobs.find((job) => job.id === jobId) || null;
}

function computeRetryRunAfter(attempts) {
  const delayMs = DEFAULT_BACKOFF_MS * attempts * attempts;
  return new Date(Date.now() + delayMs).toISOString();
}

async function emitJobTransitionEvent(type, job, payload = {}, causationId = null) {
  return appendEvent({
    type,
    subjectType: "job",
    subjectId: job.id,
    payload: {
      jobType: job.type,
      status: job.status,
      idempotencyKey: job.idempotencyKey,
      ...payload,
    },
    correlationId: job.metadata?.correlationId || job.id,
    causationId,
    metadata: {
      jobId: job.id,
      jobType: job.type,
      loopVersion: STORE_VERSION,
    },
  });
}

function normalizeJobInput(input = {}) {
  const createdAt = input.createdAt || nowIso();
  const inputRefs = asArray(input.inputRefs);
  const idempotencyKey = deriveIdempotencyKey(
    input.type,
    inputRefs,
    input.idempotencyKey || input.metadata?.idempotencyKey,
  );

  return {
    id: input.id || `job_${randomUUID()}`,
    type: String(input.type || ""),
    status: input.status || "pending",
    priority: Number.isFinite(input.priority) ? input.priority : DEFAULT_PRIORITY,
    inputRefs,
    outputRefs: asArray(input.outputRefs),
    attempts: Number.isFinite(input.attempts) ? input.attempts : 0,
    maxAttempts: Number.isFinite(input.maxAttempts) ? input.maxAttempts : DEFAULT_MAX_ATTEMPTS,
    runAfter: input.runAfter || createdAt,
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
    error: input.error ?? null,
    idempotencyKey,
    createdAt,
    updatedAt: input.updatedAt || createdAt,
    metadata: {
      correlationId: input.metadata?.correlationId || input.correlationId || `corr_${randomUUID()}`,
      causationId: input.metadata?.causationId ?? input.causationId ?? null,
      ...((isObject(input.metadata) && input.metadata) || {}),
      idempotencyKey,
    },
  };
}

function assertJobStatus(job, allowed, action) {
  if (!allowed.includes(job.status)) {
    throw new Error(`Cannot ${action} job ${job.id} in status ${job.status}`);
  }
}

export async function initializeJobStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeJobStorePath();
  if (!(await safeFileExists(path))) {
    await saveStore(createEmptyStore());
  }
  return path;
}

export function getJobStorePath() {
  return getRuntimeJobStorePath();
}

export async function listJobs(options = {}) {
  const store = await loadStore();
  let rows = clone(store.jobs);

  if (options.status) {
    rows = rows.filter((job) => job.status === options.status);
  }
  if (options.type) {
    rows = rows.filter((job) => job.type === options.type);
  }
  if (options.correlationId) {
    rows = rows.filter((job) => job.metadata?.correlationId === options.correlationId);
  }
  if (options.idempotencyKey) {
    rows = rows.filter((job) => job.idempotencyKey === options.idempotencyKey);
  }

  return rows;
}

export async function getJob(jobId) {
  const store = await loadStore();
  const job = findJob(store, jobId);
  return job ? clone(job) : null;
}

export async function createJob(input = {}) {
  if (!input.type) {
    throw new Error("createJob requires type");
  }

  const store = await loadStore();
  const draft = normalizeJobInput(input);
  const existing = findActiveJobByKey(store.jobs, draft.idempotencyKey);
  if (existing) {
    return clone(existing);
  }

  draft.status = "pending";
  store.jobs.push(draft);
  await saveStore(store);

  const createdEvent = await emitJobTransitionEvent("job.created", draft, {
    inputRefs: draft.inputRefs,
  });

  return clone(draft);
}

export async function claimJob(jobId, options = {}) {
  const store = await loadStore();
  const job = findJob(store, jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  assertJobStatus(job, ["pending", "retry_wait"], "claim");

  const now = nowIso();
  if (job.runAfter && new Date(job.runAfter).getTime() > Date.now()) {
    throw new Error(`Job ${jobId} not runnable until ${job.runAfter}`);
  }

  job.status = "claimed";
  job.startedAt = now;
  job.updatedAt = now;
  job.metadata = {
    ...job.metadata,
    claimedBy: options.claimedBy || "local_worker",
    claimedAt: now,
  };
  await saveStore(store);

  await emitJobTransitionEvent("job.claimed", job, {}, options.causationId ?? null);

  return clone(job);
}

export async function completeJob(jobId, options = {}) {
  const store = await loadStore();
  const job = findJob(store, jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  assertJobStatus(job, ["claimed", "running"], "complete");

  const now = nowIso();
  job.status = "completed";
  job.outputRefs = asArray(options.outputRefs);
  if (isObject(options.metadata)) {
    job.metadata = { ...job.metadata, ...options.metadata };
  }
  job.completedAt = now;
  job.updatedAt = now;
  job.error = null;
  await saveStore(store);

  await emitJobTransitionEvent(
    "job.completed",
    job,
    { outputRefs: job.outputRefs },
    options.causationId ?? null,
  );

  return clone(job);
}

export async function failJob(jobId, errorInput = {}, options = {}) {
  const store = await loadStore();
  const job = findJob(store, jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  assertJobStatus(job, ["claimed", "running"], "fail");

  const now = nowIso();
  const retryable = errorInput.retryable !== false;
  const nextAttempts = job.attempts + 1;
  const error = {
    code: errorInput.code || "JOB_FAILED",
    message: String(errorInput.message || "Job failed"),
    retryable,
    at: now,
  };

  job.attempts = nextAttempts;
  job.error = error;
  job.updatedAt = now;

  await emitJobTransitionEvent(
    "job.failed",
    job,
    { error, attempts: job.attempts },
    options.causationId ?? null,
  );

  if (!retryable || nextAttempts >= job.maxAttempts) {
    job.status = "dead_letter";
    job.completedAt = now;
    await saveStore(store);
    await emitJobTransitionEvent("job.dead_letter", job, { error, attempts: job.attempts });
    return clone(job);
  }

  job.status = "retry_wait";
  job.runAfter = computeRetryRunAfter(nextAttempts);
  job.startedAt = null;
  await saveStore(store);

  await emitJobTransitionEvent("job.retry", job, {
    error,
    attempts: job.attempts,
    runAfter: job.runAfter,
  });

  return clone(job);
}

export async function retryJob(jobId, options = {}) {
  const store = await loadStore();
  const job = findJob(store, jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  assertJobStatus(job, ["retry_wait", "dead_letter", "failed"], "retry");

  const now = nowIso();
  job.status = "pending";
  job.runAfter = options.runAfter || now;
  job.startedAt = null;
  job.completedAt = null;
  job.error = null;
  job.updatedAt = now;
  job.metadata = {
    ...job.metadata,
    manualRetry: true,
    retriedAt: now,
  };

  if (options.resetAttempts) {
    job.attempts = 0;
  }

  await saveStore(store);
  await emitJobTransitionEvent("job.retry", job, { manual: true, runAfter: job.runAfter });

  return clone(job);
}

export async function cancelJob(jobId, options = {}) {
  const store = await loadStore();
  const job = findJob(store, jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  assertJobStatus(job, ["pending", "claimed", "running", "retry_wait"], "cancel");

  const now = nowIso();
  job.status = "cancelled";
  job.completedAt = now;
  job.updatedAt = now;
  job.metadata = {
    ...job.metadata,
    cancelledReason: options.reason || null,
  };
  await saveStore(store);

  await emitJobTransitionEvent("job.cancelled", job, { reason: options.reason || null });

  return clone(job);
}

export async function archiveJob(jobId, options = {}) {
  const store = await loadStore();
  const job = findJob(store, jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  assertJobStatus(
    job,
    ["completed", "failed", "dead_letter", "cancelled"],
    "archive",
  );

  const now = nowIso();
  job.status = "archived";
  job.updatedAt = now;
  job.metadata = {
    ...job.metadata,
    archivedReason: options.reason || null,
    archivedAt: now,
  };
  await saveStore(store);

  await emitJobTransitionEvent("job.archived", job, { reason: options.reason || null });

  return clone(job);
}

export async function clearJobStoreForTests() {
  const path = getRuntimeJobStorePath();
  if (await safeFileExists(path)) {
    await unlink(path);
  }
  await clearEventStoreForTests();
}
