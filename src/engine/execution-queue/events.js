import { appendEvent } from "../events/index.js";
import { DEFAULT_EXECUTION_QUEUE_ID } from "./queue.js";

function nowIso() {
  return new Date().toISOString();
}

export async function emitExecutionQueueEvent(type, payload = {}, options = {}) {
  const queueId = options.queueId || DEFAULT_EXECUTION_QUEUE_ID;
  const timestamp = nowIso();
  const dispatchId = payload.dispatchId ?? null;
  const jobId = payload.jobId ?? null;
  const jobType = payload.jobType ?? null;
  const target = payload.target ?? null;

  return appendEvent({
    type,
    subjectType: "execution_queue",
    subjectId: queueId,
    payload: {
      timestamp,
      dispatchId,
      jobId,
      jobType,
      target,
      ...payload,
    },
    correlationId: options.correlationId || queueId,
    causationId: options.causationId ?? null,
    metadata: {
      dispatchId,
      jobId,
      jobType,
      target,
    },
  });
}
