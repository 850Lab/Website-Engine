import { randomUUID } from "node:crypto";
import { DEFAULT_ORCHESTRATOR_ID } from "./registry.js";
import { resolveRoute } from "./routing.js";
import { enqueueDownstreamJob } from "./enqueue.js";
import { emitOrchestratorEvent } from "./events.js";

export async function orchestrateEvent(event = {}, options = {}) {
  const orchestratorId = options.orchestratorId || DEFAULT_ORCHESTRATOR_ID;
  const correlationId =
    options.correlationId || event.correlationId || event.metadata?.correlationId || `corr_${randomUUID()}`;

  const result = {
    orchestratorId,
    correlationId,
    status: "completed",
    triggerEventId: event.id || null,
    triggerEventType: event.type || null,
    route: null,
    job: null,
    jobId: null,
    jobType: null,
    skipped: false,
    events: [],
    errors: [],
  };

  let lastEventId = null;

  async function emit(type, payload = {}) {
    const emitted = await emitOrchestratorEvent(type, payload, {
      orchestratorId,
      correlationId,
      causationId: lastEventId,
    });
    lastEventId = emitted.id;
    result.events.push(emitted);
    return emitted;
  }

  try {
    await emit("orchestrator.started", {
      triggerEventId: event.id,
      triggerEventType: event.type,
      correlationId,
      causationId: event.causationId ?? null,
    });

    const route = resolveRoute(event.type);
    if (!route) {
      result.skipped = true;
      await emit("orchestrator.no_route", {
        triggerEventId: event.id,
        triggerEventType: event.type,
        routeFound: false,
      });
      await emit("orchestrator.completed", {
        triggerEventId: event.id,
        triggerEventType: event.type,
        routeFound: false,
        jobId: null,
      });
      return result;
    }

    result.route = route;

    await emit("orchestrator.route_found", {
      triggerEventId: event.id,
      triggerEventType: event.type,
      jobType: route.jobType,
      routeFound: true,
    });

    const enqueueResult = await enqueueDownstreamJob(event, route, {
      orchestratorId,
      correlationId,
      causationId: event.id,
    });

    result.job = enqueueResult.job;
    result.jobId = enqueueResult.job.id;
    result.jobType = enqueueResult.job.type;

    await emit("orchestrator.job_enqueued", {
      triggerEventId: event.id,
      triggerEventType: event.type,
      jobType: route.jobType,
      jobId: enqueueResult.job.id,
      idempotencyKey: enqueueResult.idempotencyKey,
      created: enqueueResult.created,
      inputRefs: enqueueResult.inputRefs,
    });

    await emit("orchestrator.completed", {
      triggerEventId: event.id,
      triggerEventType: event.type,
      jobType: route.jobType,
      jobId: enqueueResult.job.id,
      routeFound: true,
    });
  } catch (error) {
    result.status = "failed";
    result.errors.push(error.message);
    await emit("orchestrator.failed", {
      triggerEventId: event.id,
      triggerEventType: event.type,
      error: error.message,
    });
  }

  return result;
}
