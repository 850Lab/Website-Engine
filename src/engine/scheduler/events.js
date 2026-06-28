import { appendEvent } from "../events/index.js";

function nowIso() {
  return new Date().toISOString();
}

export async function emitSchedulerEvent(type, payload = {}, options = {}) {
  const schedulerId = options.schedulerId || "scheduler_main";
  const timestamp = nowIso();
  const scheduleId = payload.scheduleId ?? null;
  const jobId = payload.jobId ?? null;

  return appendEvent({
    type,
    subjectType: "scheduler",
    subjectId: schedulerId,
    payload: {
      timestamp,
      schedulerId,
      scheduleId,
      jobId,
      ...payload,
    },
    correlationId: options.correlationId || schedulerId,
    causationId: options.causationId ?? null,
    metadata: {
      schedulerId,
      scheduleId,
      jobId,
    },
  });
}
