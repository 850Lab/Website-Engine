import { readFile, access } from "node:fs/promises";
import { bootstrapValidator, finalizeValidator, shouldSkipNestedRegressions } from "../../src/engine/validation/index.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  appendEvent,
  listEvents,
  getEvent,
  getEventsByType,
  getEventsByCorrelationId,
  getEventsBySubject,
  initializeEventStore,
  getEventStorePath,
  clearEventStoreForTests,
} from "../../src/engine/events/index.js";
import {
  createJob,
  claimJob,
  completeJob,
  failJob,
  retryJob,
  cancelJob,
  archiveJob,
  listJobs,
  getJob,
  initializeJobStore,
  getJobStorePath,
  clearJobStoreForTests,
  deriveIdempotencyKey,
} from "../../src/engine/jobs/index.js";
import { assertRuntimeDirectoryExists } from "./runtime-directory-assertions.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("3.1");

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

async function assertModuleBoundaries() {
  const files = [
    "src/engine/events/index.js",
    "src/engine/jobs/index.js",
    "src/engine/jobs/idempotency.js",
  ];
  const banned = [
    /\bsetInterval\s*\(/,
    /\bsetTimeout\s*\(/,
    /runSensor\s*\(/,
    /runConnector\s*\(/,
    /buildMissionControl\s*\(/,
    /scoreOpportunity\s*\(/,
    /openclaw/i,
    /scheduler/i,
  ];

  for (const rel of files) {
    const source = await readFile(join(ROOT, rel), "utf8");
    for (const pattern of banned) {
      if (pattern.test(source)) {
        fail(`Banned pattern ${pattern} in ${rel}`);
      }
    }
  }

  if (!errors.some((message) => message.includes("Banned pattern"))) {
    pass("No scheduler, timers, connectors, Mission Control, Score Council, or OpenClaw in loop kernel");
  }

  const eventsSource = await readFile(join(ROOT, "src/engine/events/index.js"), "utf8");
  if (!eventsSource.includes("appendJsonLineWithRetry")) {
    fail("Event store does not use appendJsonLineWithRetry");
  } else {
    pass("Event store uses runtime IO append helper");
  }

  const jobsSource = await readFile(join(ROOT, "src/engine/jobs/index.js"), "utf8");
  if (!jobsSource.includes("writeJsonAtomicWithRetry")) {
    fail("Job store does not use writeJsonAtomicWithRetry");
  } else {
    pass("Job store uses runtime IO atomic write helper");
  }
}

if (process.env.OPENCLAW_WORKER_RUN !== "1") {
  await clearJobStoreForTests();
  await clearEventStoreForTests();
}

const beforeGit = await runGit(["status", "--porcelain"]);

await initializeEventStore();
await initializeJobStore();

await assertRuntimeDirectoryExists(fail, pass, "runtime/events/ directory exists", "events");
await assertRuntimeDirectoryExists(fail, pass, "runtime/jobs/ directory exists", "jobs");

const correlationId = `corr_${randomUUID()}`;
const causationRoot = `evt_${randomUUID()}`;

const manualEvent = await appendEvent({
  id: causationRoot,
  type: "test.manual",
  subjectType: "test",
  subjectId: "subject_1",
  payload: { note: "append-only probe" },
  correlationId,
  causationId: null,
});

if (!manualEvent.id.startsWith("evt_")) {
  fail("Event id must use evt_ prefix");
} else {
  pass("Event append assigns UUID id");
}

const eventCountBefore = (await listEvents()).length;
await appendEvent({
  type: "test.manual",
  subjectType: "test",
  subjectId: "subject_2",
  payload: { note: "second line" },
  correlationId,
  causationId: manualEvent.id,
});

const allEvents = await listEvents();
if (allEvents.length !== eventCountBefore + 1) {
  fail("Event append did not increase event log");
} else {
  pass("Event append is append-only");
}

const fetched = await getEvent(manualEvent.id);
if (fetched?.payload?.note !== "append-only probe") {
  fail("getEvent failed");
} else {
  pass("getEvent works");
}

if ((await getEventsByType("test.manual")).length < 2) {
  fail("getEventsByType failed");
} else {
  pass("getEventsByType works");
}

if ((await getEventsByCorrelationId(correlationId)).length < 2) {
  fail("getEventsByCorrelationId failed");
} else {
  pass("getEventsByCorrelationId works");
}

if ((await getEventsBySubject("test", "subject_1")).length !== 1) {
  fail("getEventsBySubject failed");
} else {
  pass("getEventsBySubject works");
}

const inputRefs = [`sig_${randomUUID()}`];
const idempotencyKey = deriveIdempotencyKey("fact.build", inputRefs);

const jobA = await createJob({
  type: "fact.build",
  inputRefs,
  idempotencyKey,
  metadata: { correlationId },
});

const jobB = await createJob({
  type: "fact.build",
  inputRefs,
  idempotencyKey,
  metadata: { correlationId },
});

if (jobA.id !== jobB.id) {
  fail("Idempotency did not return existing active job");
} else {
  pass("Idempotency returns existing pending job");
}

const jobEvents = await getEventsBySubject("job", jobA.id);
if (!jobEvents.some((row) => row.type === "job.created")) {
  fail("job.created event missing");
} else {
  pass("Job creation emits job.created event");
}

const claimed = await claimJob(jobA.id);
if (claimed.status !== "claimed") {
  fail(`Expected claimed status, got ${claimed.status}`);
} else {
  pass("claimJob transitions to claimed");
}

if (!(await getEventsByType("job.claimed")).some((row) => row.subjectId === jobA.id)) {
  fail("job.claimed event missing");
} else {
  pass("claimJob emits job.claimed event");
}

const outputRef = `fact_${randomUUID()}`;
const completed = await completeJob(jobA.id, { outputRefs: [outputRef] });
if (completed.status !== "completed" || !completed.outputRefs.includes(outputRef)) {
  fail("completeJob failed");
} else {
  pass("completeJob transitions to completed");
}

if (!(await getEventsByType("job.completed")).some((row) => row.subjectId === jobA.id)) {
  fail("job.completed event missing");
} else {
  pass("completeJob emits job.completed event");
}

const retryJobRecord = await createJob({
  type: "graph.project",
  inputRefs: [`fact_${randomUUID()}`],
  maxAttempts: 3,
  metadata: { correlationId },
});

await claimJob(retryJobRecord.id);
const failedRetry = await failJob(retryJobRecord.id, {
  code: "EBUSY",
  message: "Simulated lock",
  retryable: true,
});

if (failedRetry.status !== "retry_wait") {
  fail(`Expected retry_wait, got ${failedRetry.status}`);
} else {
  pass("Retryable failure moves job to retry_wait");
}

if (!(await getEventsByType("job.failed")).some((row) => row.subjectId === retryJobRecord.id)) {
  fail("job.failed event missing");
} else {
  pass("failJob emits job.failed event");
}

if (!(await getEventsByType("job.retry")).some((row) => row.subjectId === retryJobRecord.id)) {
  fail("job.retry event missing");
} else {
  pass("failJob emits job.retry event for retryable errors");
}

const deadLetterJob = await createJob({
  type: "situation.build",
  inputRefs: [`graph_${randomUUID()}`],
  maxAttempts: 1,
  metadata: { correlationId },
});

await claimJob(deadLetterJob.id);
const deadLettered = await failJob(deadLetterJob.id, {
  code: "VALIDATION",
  message: "Permanent failure",
  retryable: true,
});

if (deadLettered.status !== "dead_letter") {
  fail(`Expected dead_letter, got ${deadLettered.status}`);
} else {
  pass("Exceeded maxAttempts moves job to dead_letter");
}

if (!(await getEventsByType("job.dead_letter")).some((row) => row.subjectId === deadLetterJob.id)) {
  fail("job.dead_letter event missing");
} else {
  pass("Dead-letter transition emits job.dead_letter event");
}

const replayed = await retryJob(deadLetterJob.id, { resetAttempts: true });
if (replayed.status !== "pending") {
  fail("retryJob did not return job to pending");
} else {
  pass("retryJob manual replay returns job to pending (no automatic replay)");
}

const cancelTarget = await createJob({
  type: "hypothesis.generate",
  inputRefs: [`sit_${randomUUID()}`],
  metadata: { correlationId },
});

await cancelJob(cancelTarget.id, { reason: "validation_cancel" });
const cancelled = await getJob(cancelTarget.id);
if (cancelled.status !== "cancelled") {
  fail("cancelJob failed");
} else {
  pass("cancelJob works");
}

await archiveJob(completed.id, { reason: "validation_archive" });
const archived = await getJob(completed.id);
if (archived.status !== "archived") {
  fail("archiveJob failed");
} else {
  pass("archiveJob works");
}

const chainEvents = await getEventsByCorrelationId(correlationId);
if (chainEvents.length < 5) {
  fail("Expected correlated event chain across job lifecycle");
} else {
  pass("correlationId propagated across job lifecycle events");
}

const retryEvent = chainEvents.find((row) => row.type === "job.retry" && row.causationId);
if (retryEvent && retryEvent.causationId !== retryEvent.id) {
  pass("causationId supported on events");
} else if (chainEvents.some((row) => row.causationId === manualEvent.id)) {
  pass("causationId supported on events");
} else {
  fail("causationId chain missing");
}

if (!(await fileExists(getEventStorePath()))) {
  fail("events.jsonl not created");
} else {
  pass("Event store persisted at runtime/events/events.jsonl");
}

if (!(await fileExists(getJobStorePath()))) {
  fail("jobs.json not created");
} else {
  pass("Job store persisted at runtime/jobs/jobs.json");
}

const listed = await listJobs({ type: "fact.build" });
if (!listed.some((row) => row.id === jobA.id)) {
  fail("listJobs filter failed");
} else {
  pass("listJobs works");
}

const afterGit = await runGit(["status", "--porcelain"]);
const afterLines = afterGit ? afterGit.split("\n").filter(Boolean) : [];
const runtimeChanges = afterLines.filter((line) => {
  const path = line.slice(2).trimStart();
  if (path.endsWith(".gitkeep")) return false;
  return path.startsWith("runtime/");
});

if (runtimeChanges.length) {
  fail(`Runtime job/event writes dirty git: ${runtimeChanges.join(", ")}`);
} else {
  pass("Runtime job/event stores do not dirty git");
}

await assertModuleBoundaries();

await new Promise((resolve) => setTimeout(resolve, 1500));

if (!shouldSkipNestedRegressions()) {
try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-2-9-5.js"), "--quick"], {
    cwd: ROOT,
  });
  pass("validate-phase-2-9-5.js regression passes");
} catch (error) {
  fail(`validate-phase-2-9-5.js regression failed: ${error.message}`);
}


}
await finalizeValidator({ phase: "3.1", errors, startedAt: __validationStartedAt });

console.log("\nPhase 3.1 validation passed.");
console.log("Job & Event runtime kernel complete. No scheduler. STOP.");
