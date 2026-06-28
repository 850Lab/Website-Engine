export const WORKER_ROUTES = Object.freeze({
  "demo.echo": "processor",
  "openclaw.build": "openclaw.builder",
  "openclaw.qa": "openclaw.qa",
});

export const BLOCKED_JOB_TYPES = Object.freeze([
  "sensor.poll",
  "connector.run",
  "execution.outreach",
  "research.run",
]);

export function listWorkerRoutes() {
  return Object.entries(WORKER_ROUTES).map(([jobType, target]) => ({
    jobType,
    target,
  }));
}

export function resolveWorkerTarget(job) {
  const jobType = String(job?.type || "");

  if (BLOCKED_JOB_TYPES.includes(jobType)) {
    return {
      target: null,
      eligible: false,
      reason: `Blocked until future phase: ${jobType}`,
    };
  }

  const target = WORKER_ROUTES[jobType];
  if (!target) {
    return {
      target: null,
      eligible: false,
      reason: `No route for job type: ${jobType || "unknown"}`,
    };
  }

  return {
    target,
    eligible: true,
    reason: `Matched ${jobType} route`,
  };
}
