import { randomUUID } from "node:crypto";

export const DEFAULT_SCHEDULER_ID = "scheduler_main";
export const STORE_VERSION = "3.2.0";
export const DEFAULT_INTERVAL_SECONDS = 300;

export function normalizeSchedule(input = {}) {
  if (!input.jobType) {
    throw new Error("registerSchedule requires jobType");
  }

  return {
    id: input.id || `sched_${randomUUID()}`,
    jobType: String(input.jobType),
    enabled: input.enabled !== false,
    intervalSeconds: Number.isFinite(Number(input.intervalSeconds))
      ? Number(input.intervalSeconds)
      : DEFAULT_INTERVAL_SECONDS,
    lastRun: input.lastRun ?? null,
    nextRun: input.nextRun ?? null,
    inputRefs: Array.isArray(input.inputRefs) ? input.inputRefs : [],
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
}

export function createEmptySchedulerStore(schedulerId = DEFAULT_SCHEDULER_ID) {
  const createdAt = new Date().toISOString();
  return {
    metadata: {
      version: STORE_VERSION,
      schedulerId,
      createdAt,
      updatedAt: createdAt,
      storageMode: "runtime_only",
    },
    jobs: [],
  };
}
