import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  clearEventStoreForTests,
  getEventsByCorrelationId,
  getEventsByType,
  initializeEventStore,
} from "../../src/engine/events/index.js";
import {
  clearJobStoreForTests,
  getJob,
  initializeJobStore,
  listJobs,
} from "../../src/engine/jobs/index.js";
import {
  getRuntimePath,
  getRuntimeSchedulerDirectory,
  getRuntimeSchedulerStorePath,
} from "../../src/engine/runtime/index.js";
import {
  clearSchedulerStoreForTests,
  evaluateDueSchedules,
  executeSchedulerTick,
  initializeSchedulerStore,
  listSchedules,
  loadScheduler,
  registerSchedule,
  removeSchedule,
  saveScheduler,
} from "../../src/engine/scheduler/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEDULER_FILES = [
  "src/engine/scheduler/index.js",
  "src/engine/scheduler/config.js",
  "src/engine/scheduler/store.js",
  "src/engine/scheduler/tick.js",
  "src/engine/scheduler/policies.js",
  "src/engine/scheduler/events.js",
];
const REQUIRED_EVENT_TYPES = [
  "scheduler.started",
  "scheduler.tick",
  "scheduler.job_enqueued",
  "scheduler.job_skipped",
  "scheduler.completed",
  "scheduler.failed",
];
const errors = [];

function fail(message) {
  errors.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function runGit(args) {
  const { stdout } = await execFileAsync("git", args, { cwd: ROOT });
  return stdout.trim();
}

function assertSchedulerEventFields(event) {
  const requiredRoot = ["id", "correlationId", "createdAt"];
  for (const field of requiredRoot) {
    if (!event[field]) {
      return `missing root ${field}`;
    }
  }

  const payload = event.payload || {};
  const requiredPayload = ["timestamp", "schedulerId", "scheduleId", "jobId"];
  for (const field of requiredPayload) {
    if (!(field in payload)) {
      return `missing payload.${field}`;
    }
  }

  if (!("causationId" in event)) {
    return "missing causationId";
  }

  return null;
}

async function assertSchedulerBoundaries() {
  const banned = [
    { pattern: /\bclaimJob\s*\(/, label: "claimJob" },
    { pattern: /\bcompleteJob\s*\(/, label: "completeJob" },
    { pattern: /\bfailJob\s*\(/, label: "failJob" },
    { pattern: /\brunSensor\s*\(/, label: "runSensor" },
    { pattern: /\brunConnector\s*\(/, label: "runConnector" },
    { pattern: /\bbuildMissionControl\s*\(/, label: "buildMissionControl" },
    { pattern: /\bscoreOpportunity\s*\(/, label: "scoreOpportunity" },
    { pattern: /\brunOpenClaw/i, label: "OpenClaw worker" },
    { pattern: /\bopenclaw\//i, label: "openclaw import path" },
    { pattern: /\binferProblems\s*\(/, label: "reasoning inferProblems" },
    { pattern: /\bbuildOpportunityRadar\s*\(/, label: "reasoning buildOpportunityRadar" },
    { pattern: /\bsetInterval\s*\(/, label: "setInterval timer" },
    { pattern: /\bsetTimeout\s*\(/, label: "setTimeout timer" },
  ];

  for (const rel of SCHEDULER_FILES) {
    const source = await readFile(join(ROOT, rel), "utf8");
    for (const rule of banned) {
      if (rule.pattern.test(source)) {
        fail(`Banned ${rule.label} in ${rel}`);
      }
    }
  }

  if (!errors.some((message) => message.includes("Banned"))) {
    pass("Scheduler source has no job execution, sensors, connectors, OpenClaw, or reasoning");
  }

  const tickSource = await readFile(join(ROOT, "src/engine/scheduler/tick.js"), "utf8");
  if (!tickSource.includes("createJob")) {
    fail("Scheduler tick must create jobs via createJob()");
  } else {
    pass("Scheduler tick uses createJob() only");
  }

  if (tickSource.includes("claimJob")) {
    fail("Scheduler tick must never claim jobs");
  } else {
    pass("Scheduler never claims jobs");
  }
}

if (process.env.OPENCLAW_WORKER_RUN !== "1") {
  await clearJobStoreForTests();
  await clearEventStoreForTests();
  await clearSchedulerStoreForTests();
}

const beforeGit = await runGit(["status", "--porcelain"]);

await initializeEventStore();
await initializeJobStore();
await initializeSchedulerStore();

if (!(await fileExists(getRuntimePath("scheduler", ".gitkeep")))) {
  fail("runtime/scheduler/.gitkeep missing");
} else {
  pass("runtime/scheduler/ directory exists");
}

if (getRuntimeSchedulerDirectory() !== getRuntimePath("scheduler")) {
  fail("getRuntimeSchedulerDirectory() mismatch");
} else {
  pass("getRuntimeSchedulerDirectory() wired");
}

if (getRuntimeSchedulerStorePath() !== getRuntimePath("scheduler", "scheduler.json")) {
  fail("getRuntimeSchedulerStorePath() mismatch");
} else {
  pass("getRuntimeSchedulerStorePath() wired");
}

const emptyStore = await loadScheduler();
if (!Array.isArray(emptyStore.jobs) || emptyStore.jobs.length !== 0) {
  fail("Scheduler store did not initialize empty");
} else {
  pass("Scheduler store initializes");
}

const dueAt = new Date("2026-06-23T12:00:00.000Z");
const schedule = await registerSchedule({
  jobType: "sensor.poll",
  intervalSeconds: 60,
  nextRun: dueAt.toISOString(),
  inputRefs: [`sensor_${randomUUID()}`],
});

if (!schedule.id || schedule.jobType !== "sensor.poll") {
  fail("registerSchedule failed");
} else {
  pass("Schedule registration works");
}

const listed = await listSchedules();
if (!listed.some((row) => row.id === schedule.id)) {
  fail("listSchedules failed");
} else {
  pass("listSchedules works");
}

const dueRows = evaluateDueSchedules(listed, dueAt);
if (!dueRows.some((row) => row.id === schedule.id)) {
  fail("evaluateDueSchedules did not detect due schedule");
} else {
  pass("Due schedule detection works");
}

const futureNextRun = new Date(dueAt.getTime() + 120_000).toISOString();
const futureSchedule = await registerSchedule({
  jobType: "sensor.poll",
  intervalSeconds: 60,
  nextRun: futureNextRun,
});
const notDue = evaluateDueSchedules(await listSchedules(), dueAt);
if (notDue.some((row) => row.id === futureSchedule.id)) {
  fail("evaluateDueSchedules should not mark schedule due before nextRun");
} else {
  pass("Future schedules are not due");
}

await removeSchedule(futureSchedule.id);

const tickResult = await executeSchedulerTick({ now: dueAt.toISOString() });
if (tickResult.status !== "completed") {
  fail(`Scheduler tick failed: ${tickResult.errors.join("; ")}`);
} else {
  pass("Scheduler tick completes");
}

if (tickResult.jobsEnqueued.length !== 1) {
  fail(`Expected one enqueued job, got ${tickResult.jobsEnqueued.length}`);
} else {
  pass("Scheduler tick creates pending job");
}

const enqueuedJobId = tickResult.jobsEnqueued[0].jobId;
const enqueuedJob = await getJob(enqueuedJobId);
if (!enqueuedJob || enqueuedJob.status !== "pending") {
  fail(`Enqueued job must be pending, got ${enqueuedJob?.status}`);
} else {
  pass("Scheduler creates pending generic job");
}

if (enqueuedJob.type !== "sensor.poll") {
  fail(`Expected sensor.poll job type, got ${enqueuedJob.type}`);
} else {
  pass("Scheduler enqueues generic Phase 3.1 job type");
}

const claimedJobs = (await listJobs()).filter((row) => row.status === "claimed");
if (claimedJobs.some((row) => row.metadata?.scheduleId === schedule.id)) {
  fail("Scheduler must not claim jobs");
} else {
  pass("Scheduler never executes or claims jobs");
}

const duplicateStore = await loadScheduler();
const scheduleRow = duplicateStore.jobs.find((row) => row.id === schedule.id);
if (!scheduleRow) {
  fail("Schedule missing after first tick");
} else {
  scheduleRow.nextRun = dueAt.toISOString();
  await saveScheduler(duplicateStore);
}

const skipTick = await executeSchedulerTick({ now: dueAt.toISOString() });
if (skipTick.jobsSkipped.length < 1) {
  fail("Duplicate tick should skip active job");
} else {
  pass("Scheduler skips duplicate active jobs");
}

if (!(await getEventsByType("scheduler.job_skipped")).length) {
  fail("scheduler.job_skipped event missing");
} else {
  pass("Scheduler emits scheduler.job_skipped");
}

for (const type of REQUIRED_EVENT_TYPES.slice(0, -1)) {
  const rows = await getEventsByType(type);
  if (!rows.length) {
    fail(`Missing scheduler event type: ${type}`);
  }
}

if (!(await getEventsByType("scheduler.started")).length) {
  fail("scheduler.started missing");
} else {
  pass("Scheduler emits lifecycle events");
}

const correlated = await getEventsByCorrelationId(tickResult.correlationId);
for (const type of [
  "scheduler.started",
  "scheduler.tick",
  "scheduler.job_enqueued",
  "scheduler.completed",
]) {
  if (!correlated.some((row) => row.type === type)) {
    fail(`Missing correlated event ${type}`);
  }
}

if (!correlated.some((row) => row.type === "scheduler.job_enqueued")) {
  fail("scheduler.job_enqueued missing from tick correlation");
} else {
  pass("Scheduler emits scheduler.job_enqueued");
}

for (const event of correlated.filter((row) => row.type.startsWith("scheduler."))) {
  const problem = assertSchedulerEventFields(event);
  if (problem) {
    fail(`Scheduler event ${event.type} ${problem}`);
  }
}

if (!errors.some((message) => message.includes("Scheduler event"))) {
  pass("Scheduler events include id, timestamp, correlationId, causationId, schedulerId, scheduleId, jobId");
}

const refreshed = await loadScheduler();
const updatedSchedule = refreshed.jobs.find((row) => row.id === schedule.id);
if (!updatedSchedule?.lastRun || !updatedSchedule?.nextRun) {
  fail("Scheduler tick must update lastRun and nextRun");
} else {
  pass("Scheduler updates schedule cursors after tick");
}

await removeSchedule(schedule.id);
if ((await listSchedules()).some((row) => row.id === schedule.id)) {
  fail("removeSchedule failed");
} else {
  pass("Schedule removal works");
}

await assertSchedulerBoundaries();

if (!(await fileExists(getRuntimeSchedulerStorePath()))) {
  fail("scheduler.json not persisted");
} else {
  pass("Scheduler store persisted at runtime/scheduler/scheduler.json");
}

const afterGit = await runGit(["status", "--porcelain"]);
const afterLines = afterGit ? afterGit.split("\n").filter(Boolean) : [];
const runtimeChanges = afterLines.filter((line) => {
  const path = line.slice(2).trimStart();
  if (path.endsWith(".gitkeep")) return false;
  return path.startsWith("runtime/");
});

if (runtimeChanges.length) {
  fail(`Runtime scheduler writes dirty git: ${runtimeChanges.join(", ")}`);
} else {
  pass("Scheduler runtime store stays gitignored");
}

await new Promise((resolve) => setTimeout(resolve, 1500));

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-3-1.js")], {
    cwd: ROOT,
    env: { ...process.env, OPENCLAW_WORKER_RUN: "1" },
  });
  pass("validate-phase-3-1.js regression passes");
} catch (error) {
  fail(`validate-phase-3-1.js regression failed: ${error.message}`);
}

try {
  await execFileAsync(
    process.execPath,
    [join(ROOT, "scripts/opportunity-engine/validate-phase-2-9-5.js"), "--quick"],
    { cwd: ROOT },
  );
  pass("validate-phase-2-9-5.js regression passes");
} catch (error) {
  fail(`validate-phase-2-9-5.js regression failed: ${error.message}`);
}

if (errors.length) {
  console.error(`\nPhase 3.2 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 3.2 validation passed.");
console.log("Clock → Scheduler → Pending Jobs. No processing. STOP.");
