import { appendEvent } from "../events/index.js";
import { DEFAULT_ORCHESTRATOR_ID } from "./registry.js";

function nowIso() {
  return new Date().toISOString();
}

export async function emitOrchestratorEvent(type, payload = {}, options = {}) {
  const orchestratorId = options.orchestratorId || DEFAULT_ORCHESTRATOR_ID;
  const timestamp = nowIso();

  return appendEvent({
    type,
    subjectType: "orchestrator",
    subjectId: orchestratorId,
    payload: {
      timestamp,
      orchestratorId,
      triggerEventId: payload.triggerEventId ?? null,
      triggerEventType: payload.triggerEventType ?? null,
      jobType: payload.jobType ?? null,
      jobId: payload.jobId ?? null,
      routeFound: payload.routeFound ?? null,
      ...payload,
    },
    correlationId: options.correlationId || payload.correlationId || orchestratorId,
    causationId: options.causationId ?? null,
    metadata: {
      orchestratorId,
      triggerEventId: payload.triggerEventId ?? null,
      jobId: payload.jobId ?? null,
    },
  });
}
