import { appendEvent } from "../events/index.js";

export const PIPELINE_EVENT_TYPES = Object.freeze([
  "pipeline.started",
  "pipeline.stage_completed",
  "pipeline.failed",
  "pipeline.completed",
]);

function nowIso() {
  return new Date().toISOString();
}

export async function emitPipelineEvent(type, payload = {}, options = {}) {
  const stage = payload.stage ?? options.stage ?? null;
  const jobType = payload.jobType ?? options.jobType ?? null;

  return appendEvent({
    type,
    subjectType: "pipeline",
    subjectId: options.stage || stage || jobType || "pipeline",
    payload: {
      timestamp: nowIso(),
      stage,
      jobType,
      jobId: payload.jobId ?? null,
      ...payload,
    },
    correlationId: options.correlationId || payload.correlationId || null,
    causationId: options.causationId ?? null,
    metadata: {
      stage,
      jobType,
      jobId: payload.jobId ?? null,
    },
  });
}
