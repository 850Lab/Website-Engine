import { normalizePromptHash } from "./prompt.js";

export function deriveOpenClawIdempotencyKey({ phaseId, jobType, promptHash }) {
  const normalizedHash = normalizePromptHash(promptHash);
  return `openclaw:${String(phaseId).trim()}:${String(jobType).trim()}:${normalizedHash}`;
}

export function verifyOpenClawIdempotency(openclawJob, genericJob = null) {
  const expected = deriveOpenClawIdempotencyKey({
    phaseId: openclawJob.phaseId,
    jobType: openclawJob.jobType,
    promptHash: openclawJob.promptHash,
  });

  const openclawKey = String(openclawJob.idempotencyKey || "").trim();
  if (openclawKey !== expected) {
    return {
      ok: false,
      reason: "idempotency_mismatch",
      detail: `openclaw.idempotencyKey must be ${expected}, got ${openclawKey || "(empty)"}`,
      expected,
    };
  }

  if (genericJob) {
    const genericKey = String(genericJob.idempotencyKey || "").trim();
    if (genericKey !== expected) {
      return {
        ok: false,
        reason: "idempotency_mismatch",
        detail: `generic job idempotencyKey must be ${expected}, got ${genericKey || "(empty)"}`,
        expected,
      };
    }
  }

  return { ok: true, reason: "idempotency_verified", detail: expected, expected };
}
