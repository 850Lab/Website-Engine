import { createHash } from "node:crypto";

export const ACTIVE_JOB_STATUSES = new Set(["pending", "claimed", "running", "retry_wait"]);

/**
 * Idempotency policy (Phase 3.1):
 * - Every job carries an idempotencyKey (explicit or derived from type + sorted inputRefs).
 * - createJob() with the same key while an active job exists returns that job — no duplicate enqueue.
 * - Active statuses: pending, claimed, running, retry_wait.
 * - Terminal jobs (completed, failed, dead_letter, cancelled, archived) do not block re-create
 *   unless the caller passes { respectCompletedDedupe: true } (future loop supervisor use).
 */
export function deriveIdempotencyKey(type, inputRefs = [], explicitKey = null) {
  if (explicitKey) {
    return String(explicitKey);
  }

  const payload = {
    type: String(type || ""),
    inputRefs: [...inputRefs].map(String).filter(Boolean).sort(),
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function findActiveJobByKey(jobs, idempotencyKey) {
  if (!idempotencyKey) {
    return null;
  }

  return (
    jobs.find((job) => job.idempotencyKey === idempotencyKey && ACTIVE_JOB_STATUSES.has(job.status)) ||
    null
  );
}
