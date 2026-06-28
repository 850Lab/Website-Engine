import { createJob, listJobs } from "../jobs/index.js";
import { ACTIVE_JOB_STATUSES } from "../jobs/idempotency.js";
import { appendOrchestratorHistory } from "./store.js";
import { buildOrchestratorIdempotencyKey, extractInputRefs } from "./routing.js";

export async function enqueueDownstreamJob(event = {}, route = {}, options = {}) {
  const inputRefs = extractInputRefs(event, route);
  if (!inputRefs.length) {
    throw new Error(`Cannot enqueue ${route.jobType}: missing inputRefs from event ${event.type}`);
  }

  const correlationId =
    options.correlationId || event.correlationId || event.metadata?.correlationId || `corr_${event.id}`;
  const causationId = options.causationId ?? event.id ?? null;
  const idempotencyKey =
    options.idempotencyKey ||
    buildOrchestratorIdempotencyKey(route.eventType, route.jobType, inputRefs);

  const existingActive = (await listJobs({ idempotencyKey })).find((row) =>
    ACTIVE_JOB_STATUSES.has(row.status),
  );

  const job = await createJob({
    type: route.jobType,
    inputRefs,
    idempotencyKey,
    metadata: {
      correlationId,
      causationId,
      orchestratorId: options.orchestratorId || "orchestrator_main",
      triggerEventId: event.id,
      triggerEventType: event.type,
      stage: route.stage || null,
      enqueuedBy: "orchestrator",
    },
  });

  const created = !existingActive;

  await appendOrchestratorHistory({
    triggerEventId: event.id,
    triggerEventType: event.type,
    jobType: route.jobType,
    jobId: job.id,
    correlationId,
    causationId,
    idempotencyKey,
    inputRefs,
    status: created ? "job_enqueued" : "job_deduped",
    metadata: {
      stage: route.stage || null,
    },
  });

  return { job, created, idempotencyKey, inputRefs, correlationId, causationId };
}
