import { appendEvent } from "../events/index.js";

function nowIso() {
  return new Date().toISOString();
}

export async function emitProcessorEvent(type, payload = {}, options = {}) {
  const processorId = options.processorId || "processor_main";
  const timestamp = nowIso();
  const jobId = payload.jobId ?? null;
  const handler = payload.handler ?? null;

  return appendEvent({
    type,
    subjectType: "processor",
    subjectId: processorId,
    payload: {
      timestamp,
      processorId,
      jobId,
      handler,
      ...payload,
    },
    correlationId: options.correlationId || processorId,
    causationId: options.causationId ?? null,
    metadata: {
      processorId,
      jobId,
      handler,
    },
  });
}
