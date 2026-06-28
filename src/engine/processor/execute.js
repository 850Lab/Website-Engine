import { randomUUID } from "node:crypto";
import { claimJob, completeJob, failJob, getJob, listJobs } from "../jobs/index.js";
import { DEFAULT_PROCESSOR_ID } from "./registry.js";
import { emitProcessorEvent } from "./events.js";
import { getJobHandlerEntry } from "./registry.js";

function sortRunnableJobs(jobs) {
  return [...jobs].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export async function processNextJob(options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const pending = await listJobs({ status: "pending" });
  const retryable = await listJobs({ status: "retry_wait" });
  const candidates = sortRunnableJobs([...pending, ...retryable]).filter((job) => {
    if (!job.runAfter) {
      return true;
    }
    return new Date(job.runAfter).getTime() <= now.getTime();
  });

  if (candidates.length === 0) {
    return {
      processorId: options.processorId || DEFAULT_PROCESSOR_ID,
      status: "idle",
      jobId: null,
      handler: null,
      jobStatus: null,
      events: [],
      errors: [],
    };
  }

  return executeJob(candidates[0].id, options);
}

export async function executeJob(jobId, options = {}) {
  const processorId = options.processorId || DEFAULT_PROCESSOR_ID;
  const correlationId = options.correlationId || `proc_${randomUUID()}`;
  const result = {
    processorId,
    correlationId,
    status: "completed",
    jobId,
    handler: null,
    jobStatus: null,
    events: [],
    errors: [],
  };

  let lastEventId = null;

  async function emit(type, payload = {}) {
    const event = await emitProcessorEvent(type, payload, {
      processorId,
      correlationId,
      causationId: lastEventId,
    });
    lastEventId = event.id;
    result.events.push(event);
    return event;
  }

  try {
    await emit("processor.started", { jobId });

    const existing = await getJob(jobId);
    if (!existing) {
      throw new Error(`Job not found: ${jobId}`);
    }

    let job = existing;
    if (job.status === "pending" || job.status === "retry_wait") {
      job = await claimJob(jobId, {
        claimedBy: processorId,
        causationId: lastEventId,
      });
    } else if (job.status !== "claimed" && job.status !== "running") {
      throw new Error(`Job ${jobId} is not processable in status ${job.status}`);
    }

    await emit("processor.job_claimed", {
      jobId: job.id,
      jobType: job.type,
      handler: null,
    });

    const handlerEntry = getJobHandlerEntry(job.type);
    const handlerName = handlerEntry?.label || job.type;
    result.handler = handlerEntry ? handlerName : null;

    await emit("processor.handler_resolved", {
      jobId: job.id,
      jobType: job.type,
      handler: result.handler,
      resolved: Boolean(handlerEntry),
    });

    if (!handlerEntry) {
      const failed = await failJob(
        job.id,
        {
          code: "NO_HANDLER",
          message: `No handler registered for job type: ${job.type}`,
          retryable: false,
        },
        { causationId: lastEventId },
      );
      result.jobStatus = failed.status;

      if (failed.status === "dead_letter") {
        await emit("processor.job_dead_letter", {
          jobId: job.id,
          handler: null,
          error: failed.error,
        });
      } else {
        await emit("processor.failed", {
          jobId: job.id,
          handler: null,
          error: failed.error,
        });
      }

      await emit("processor.completed", { jobId: job.id, handler: null, jobStatus: failed.status });
      return result;
    }

    let handlerResult;
    try {
      handlerResult = await handlerEntry.handler(job, {
        processorId,
        correlationId,
        causationId: lastEventId,
      });
    } catch (error) {
      handlerResult = {
        success: false,
        error: {
          code: "HANDLER_ERROR",
          message: error.message,
          retryable: error.retryable !== false,
        },
      };
    }

    if (handlerResult?.success === false) {
      const failed = await failJob(
        job.id,
        handlerResult.error || {
          code: "HANDLER_FAILED",
          message: "Handler returned failure",
          retryable: true,
        },
        { causationId: lastEventId },
      );
      result.jobStatus = failed.status;

      if (failed.status === "retry_wait") {
        await emit("processor.job_retry", {
          jobId: job.id,
          handler: handlerName,
          error: failed.error,
          runAfter: failed.runAfter,
        });
      } else if (failed.status === "dead_letter") {
        await emit("processor.job_dead_letter", {
          jobId: job.id,
          handler: handlerName,
          error: failed.error,
        });
      }

      await emit("processor.completed", {
        jobId: job.id,
        handler: handlerName,
        jobStatus: failed.status,
      });
      return result;
    }

    const completed = await completeJob(
      job.id,
      {
        outputRefs: handlerResult?.outputRefs || [],
        metadata: handlerResult?.metadata,
        causationId: lastEventId,
      },
    );
    result.jobStatus = completed.status;

    await emit("processor.job_completed", {
      jobId: job.id,
      handler: handlerName,
      outputRefs: completed.outputRefs,
    });

    await emit("processor.completed", {
      jobId: job.id,
      handler: handlerName,
      jobStatus: completed.status,
    });
  } catch (error) {
    result.status = "failed";
    result.errors.push(error.message);
    await emit("processor.failed", {
      jobId,
      handler: result.handler,
      error: { code: "PROCESSOR_ERROR", message: error.message },
    });
  }

  return result;
}
