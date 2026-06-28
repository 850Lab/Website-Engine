import { randomUUID } from "node:crypto";
import {
  DEFAULT_EXECUTION_QUEUE_ID,
  listConsiderableJobs,
  loadStore,
  saveStore,
} from "./queue.js";
import { resolveWorkerTarget } from "./routing.js";
import { emitExecutionQueueEvent } from "./events.js";

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return structuredClone(value);
}

export async function createDispatchDecision(job, routeResult = null) {
  if (!job?.id || !job?.type) {
    throw new Error("createDispatchDecision requires job with id and type");
  }

  const resolved = routeResult || resolveWorkerTarget(job);
  const decision = {
    id: `dispatch_${randomUUID()}`,
    jobId: job.id,
    jobType: job.type,
    target: resolved.target,
    priority: Number.isFinite(job.priority) ? job.priority : 50,
    eligible: resolved.eligible,
    reason: resolved.reason,
    createdAt: nowIso(),
    metadata: {},
  };

  const store = await loadStore();
  store.decisions.push(decision);
  await saveStore(store);

  return clone(decision);
}

export async function dispatchNextJob(options = {}) {
  const queueId = options.queueId || DEFAULT_EXECUTION_QUEUE_ID;
  const correlationId = options.correlationId || `dispatch_${randomUUID()}`;
  const result = {
    queueId,
    correlationId,
    status: "completed",
    dispatchId: null,
    jobId: null,
    jobType: null,
    target: null,
    decision: null,
    considered: [],
    skipped: [],
    events: [],
    errors: [],
  };

  let lastEventId = null;

  async function emit(type, payload = {}) {
    const event = await emitExecutionQueueEvent(type, payload, {
      queueId,
      correlationId,
      causationId: lastEventId,
    });
    lastEventId = event.id;
    result.events.push(event);
    return event;
  }

  try {
    await emit("execution_queue.started", {});

    const candidates = await listConsiderableJobs({ now: options.now });

    if (candidates.length === 0) {
      result.status = "idle";
      await emit("execution_queue.completed", {
        dispatchId: null,
        jobId: null,
        jobType: null,
        target: null,
      });
      return result;
    }

    for (const job of candidates) {
      result.considered.push(job.id);
      const route = resolveWorkerTarget(job);

      await emit("execution_queue.job_considered", {
        jobId: job.id,
        jobType: job.type,
        target: route.target,
        eligible: route.eligible,
      });

      if (!route.eligible) {
        result.skipped.push({ jobId: job.id, reason: route.reason });
        await emit("execution_queue.job_skipped", {
          jobId: job.id,
          jobType: job.type,
          target: route.target,
          reason: route.reason,
        });
        continue;
      }

      await emit("execution_queue.job_selected", {
        jobId: job.id,
        jobType: job.type,
        target: route.target,
      });

      const decision = await createDispatchDecision(job, route);
      result.dispatchId = decision.id;
      result.jobId = decision.jobId;
      result.jobType = decision.jobType;
      result.target = decision.target;
      result.decision = decision;

      await emit("execution_queue.dispatch_created", {
        dispatchId: decision.id,
        jobId: decision.jobId,
        jobType: decision.jobType,
        target: decision.target,
        priority: decision.priority,
        reason: decision.reason,
      });

      await emit("execution_queue.completed", {
        dispatchId: decision.id,
        jobId: decision.jobId,
        jobType: decision.jobType,
        target: decision.target,
      });

      return result;
    }

    await emit("execution_queue.completed", {
      dispatchId: null,
      jobId: null,
      jobType: null,
      target: null,
    });
  } catch (error) {
    result.status = "failed";
    result.errors.push(error.message);
    await emit("execution_queue.failed", {
      dispatchId: result.dispatchId,
      jobId: result.jobId,
      jobType: result.jobType,
      target: result.target,
      error: error.message,
    });
  }

  return result;
}
