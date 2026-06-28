import { randomUUID } from "node:crypto";
import { createJob, listJobs } from "../jobs/index.js";
import { ACTIVE_JOB_STATUSES } from "../jobs/idempotency.js";
import { DEFAULT_SCHEDULER_ID } from "./config.js";
import { emitSchedulerEvent } from "./events.js";
import {
  buildScheduleIdempotencyKey,
  computeNextRun,
  evaluateDueSchedules,
} from "./policies.js";
import { loadStore, saveStore } from "./store.js";

export async function executeSchedulerTick(options = {}) {
  const schedulerId = options.schedulerId || DEFAULT_SCHEDULER_ID;
  const tickAt = options.now ? new Date(options.now) : new Date();
  const correlationId = options.correlationId || `sched_tick_${randomUUID()}`;
  const result = {
    schedulerId,
    correlationId,
    tickAt: tickAt.toISOString(),
    status: "completed",
    schedulesDue: [],
    jobsEnqueued: [],
    jobsSkipped: [],
    events: [],
    errors: [],
  };

  let lastEventId = null;

  async function emit(type, payload = {}) {
    const event = await emitSchedulerEvent(type, payload, {
      schedulerId,
      correlationId,
      causationId: lastEventId,
    });
    lastEventId = event.id;
    result.events.push(event);
    return event;
  }

  try {
    await emit("scheduler.started", { tickAt: result.tickAt });

    const store = await loadStore();
    const due = evaluateDueSchedules(store.jobs, tickAt);
    result.schedulesDue = due.map((row) => row.id);

    await emit("scheduler.tick", {
      schedulesDue: result.schedulesDue.length,
      scheduleIds: result.schedulesDue,
    });

    for (const schedule of due) {
      const inputRefs =
        schedule.inputRefs.length > 0 ? schedule.inputRefs : [`schedule:${schedule.id}`];
      const idempotencyKey =
        schedule.metadata?.idempotencyKey || buildScheduleIdempotencyKey(schedule, tickAt);

      const existingActive = (await listJobs({ idempotencyKey })).find((row) =>
        ACTIVE_JOB_STATUSES.has(row.status),
      );

      if (existingActive) {
        result.jobsSkipped.push({
          scheduleId: schedule.id,
          jobId: existingActive.id,
          reason: "duplicate_active_job",
        });
        await emit("scheduler.job_skipped", {
          scheduleId: schedule.id,
          jobId: existingActive.id,
          reason: "duplicate_active_job",
        });
      } else {
        const job = await createJob({
          type: schedule.jobType,
          inputRefs,
          idempotencyKey,
          metadata: {
            correlationId,
            causationId: lastEventId,
            schedulerId,
            scheduleId: schedule.id,
            enqueuedBy: "scheduler",
          },
        });

        result.jobsEnqueued.push({ scheduleId: schedule.id, jobId: job.id, jobType: job.type });
        await emit("scheduler.job_enqueued", {
          scheduleId: schedule.id,
          jobId: job.id,
          jobType: job.type,
        });
      }

      schedule.lastRun = tickAt.toISOString();
      schedule.nextRun = computeNextRun(schedule, tickAt);
    }

    await saveStore(store);
    await emit("scheduler.completed", {
      jobsEnqueued: result.jobsEnqueued.length,
      jobsSkipped: result.jobsSkipped.length,
    });
  } catch (error) {
    result.status = "failed";
    result.errors.push(error.message);
    await emit("scheduler.failed", { error: error.message });
  }

  return result;
}
