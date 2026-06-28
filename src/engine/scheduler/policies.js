export function isScheduleDue(schedule, now = new Date()) {
  if (!schedule?.enabled) {
    return false;
  }

  if (!schedule.nextRun) {
    return true;
  }

  return new Date(schedule.nextRun).getTime() <= now.getTime();
}

export function evaluateDueSchedules(schedules = [], now = new Date()) {
  return schedules.filter((schedule) => isScheduleDue(schedule, now));
}

export function computeNextRun(schedule, fromDate = new Date()) {
  const intervalMs = Math.max(1, Number(schedule.intervalSeconds) || 300) * 1000;
  return new Date(fromDate.getTime() + intervalMs).toISOString();
}

export function buildScheduleIdempotencyKey(schedule, tickAt) {
  const bucket = schedule.nextRun || new Date(tickAt).toISOString();
  return `scheduler:${schedule.id}:${schedule.jobType}:${bucket}`;
}
