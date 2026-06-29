import { readFile, access } from "node:fs/promises";
import { bootstrapValidator, finalizeValidator, shouldSkipNestedRegressions } from "../../src/engine/validation/index.js";
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
  createJob,
  getJob,
  initializeJobStore,
  listJobs,
} from "../../src/engine/jobs/index.js";
import {
  clearJobHandlersForTests,
  demoEchoHandler,
  executeJob,
  getJobHandler,
  listJobHandlers,
  processNextJob,
  registerBuiltInHandlers,
  registerJobHandler,
  unregisterJobHandler,
} from "../../src/engine/processor/index.js";
import { getRuntimePath } from "../../src/engine/runtime/index.js";
import { clearSchedulerStoreForTests } from "../../src/engine/scheduler/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PROCESSOR_FILES = [
  "src/engine/processor/index.js",
  "src/engine/processor/registry.js",
  "src/engine/processor/handlers.js",
  "src/engine/processor/execute.js",
  "src/engine/processor/events.js",
];
const SCHEDULER_FILES = [
  "src/engine/scheduler/index.js",
  "src/engine/scheduler/tick.js",
];
const REQUIRED_EVENT_TYPES = [
  "processor.started",
  "processor.job_claimed",
  "processor.handler_resolved",
  "processor.job_completed",
  "processor.job_retry",
  "processor.job_dead_letter",
  "processor.failed",
  "processor.completed",
];
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("3.3");

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

function assertProcessorEventFields(event) {
  const requiredRoot = ["id", "correlationId", "createdAt"];
  for (const field of requiredRoot) {
    if (!event[field]) {
      return `missing root ${field}`;
    }
  }

  const payload = event.payload || {};
  for (const field of ["timestamp", "processorId", "jobId", "handler"]) {
    if (!(field in payload)) {
      return `missing payload.${field}`;
    }
  }

  if (!("causationId" in event)) {
    return "missing causationId";
  }

  return null;
}

async function assertProcessorBoundaries() {
  const banned = [
    { pattern: /\bcreateJob\s*\(/, label: "createJob" },
    { pattern: /\bregisterSchedule\s*\(/, label: "registerSchedule" },
    { pattern: /\bexecuteSchedulerTick\s*\(/, label: "executeSchedulerTick" },
    { pattern: /\brunSensor\s*\(/, label: "runSensor" },
    { pattern: /\brunConnector\s*\(/, label: "runConnector" },
    { pattern: /\bbuildMissionControl\s*\(/, label: "buildMissionControl" },
    { pattern: /\bscoreOpportunity\s*\(/, label: "scoreOpportunity" },
    { pattern: /\brunOpenClaw/i, label: "OpenClaw worker" },
    { pattern: /\bopenclaw\//i, label: "openclaw import path" },
    { pattern: /\binferProblems\s*\(/, label: "reasoning inferProblems" },
    { pattern: /\bsetInterval\s*\(/, label: "setInterval timer" },
    { pattern: /\bsetTimeout\s*\(/, label: "setTimeout timer" },
    { pattern: /\bwhile\s*\(\s*true\s*\)/, label: "infinite loop" },
  ];

  for (const rel of PROCESSOR_FILES) {
    const source = await readFile(join(ROOT, rel), "utf8");
    for (const rule of banned) {
      if (rule.pattern.test(source)) {
        fail(`Banned ${rule.label} in ${rel}`);
      }
    }
  }

  if (!errors.some((message) => message.includes("Banned"))) {
    pass("Processor source has no scheduling, sensors, connectors, OpenClaw, or reasoning");
  }
}

async function assertSchedulerUnchanged() {
  for (const rel of SCHEDULER_FILES) {
    const source = await readFile(join(ROOT, rel), "utf8");
    if (source.includes("claimJob") || source.includes("processNextJob")) {
      fail(`Scheduler modified with processor behavior in ${rel}`);
    }
  }

  if (!errors.some((message) => message.includes("Scheduler modified"))) {
    pass("Scheduler remains enqueue-only");
  }
}

if (process.env.OPENCLAW_WORKER_RUN !== "1") {
  await clearJobStoreForTests();
  await clearEventStoreForTests();
  await clearSchedulerStoreForTests();
}

clearJobHandlersForTests();
registerBuiltInHandlers();

const beforeGit = await runGit(["status", "--porcelain"]);

await initializeEventStore();
await initializeJobStore();

const missingJobResult = await executeJob(`job_${randomUUID()}`);
if (missingJobResult.status !== "failed") {
  fail("executeJob should fail gracefully for missing job");
} else {
  pass("executeJob fails gracefully for missing job");
}

if (!(await getEventsByType("processor.failed")).length) {
  fail("processor.failed event missing");
} else {
  pass("Processor emits processor.failed on execution error");
}

if (!listJobHandlers().includes("demo.echo")) {
  fail("Built-in demo.echo handler not registered");
} else {
  pass("Built-in demo.echo handler registered");
}

const customType = `demo.custom_${randomUUID().slice(0, 8)}`;
let customCalls = 0;
registerJobHandler(customType, async () => {
  customCalls += 1;
  return { success: true };
});

if (typeof getJobHandler(customType) !== "function") {
  fail("getJobHandler lookup failed");
} else {
  pass("Handler registration and lookup work");
}

unregisterJobHandler(customType);
if (getJobHandler(customType)) {
  fail("unregisterJobHandler failed");
} else {
  pass("Handler unregistration works");
}

const unknownJob = await createJob({
  type: `unknown_${randomUUID().slice(0, 8)}`,
  inputRefs: [`in_${randomUUID()}`],
});

const unknownResult = await executeJob(unknownJob.id);
if (unknownResult.status !== "completed" || unknownResult.jobStatus !== "dead_letter") {
  fail(`Unknown handler should dead-letter gracefully, got ${unknownResult.jobStatus}`);
} else {
  pass("Unknown handler fails gracefully");
}

if (!(await getEventsByType("processor.failed")).some((row) => row.payload?.jobId === unknownJob.id)) {
  // dead-letter path uses processor.job_dead_letter; processor.failed only on thrown errors
}

if (!(await getEventsByType("processor.job_dead_letter")).some((row) => row.payload?.jobId === unknownJob.id)) {
  fail("processor.job_dead_letter missing for unknown handler");
} else {
  pass("Unknown handler emits processor.job_dead_letter");
}

let echoCalls = 0;
registerJobHandler("demo.echo", async (job) => {
  echoCalls += 1;
  return demoEchoHandler(job);
});

const echoJob = await createJob({
  type: "demo.echo",
  inputRefs: [`echo_${randomUUID()}`],
  metadata: { probe: "phase-3-3" },
});

const secondPending = await createJob({
  type: "demo.echo",
  inputRefs: [`echo_${randomUUID()}`],
});

const processResult = await processNextJob();
if (processResult.status !== "completed" || !processResult.jobId) {
  fail(`processNextJob failed: ${processResult.errors.join("; ")}`);
} else {
  pass("processNextJob claims and processes one pending job");
}

if (echoCalls !== 1) {
  fail(`Expected demo.echo handler to run once, got ${echoCalls}`);
} else {
  pass("Handler executes exactly once per invocation");
}

const processed = await getJob(processResult.jobId);
if (!processed || processed.status !== "completed") {
  fail(`Expected completed job, got ${processed?.status}`);
} else {
  pass("Successful job completes");
}

if (!processed.metadata?.demoEchoAt) {
  fail("demo.echo handler did not append timestamp metadata");
} else {
  pass("demo.echo handler appends timestamp metadata");
}

const stillPending = (await listJobs({ status: "pending" })).filter((row) => row.type === "demo.echo");
if (stillPending.length < 1) {
  fail("processNextJob should process only one job per invocation");
} else {
  pass("Processor exits after one job (second job remains pending)");
}

const retryType = `demo.retry_${randomUUID().slice(0, 8)}`;
registerJobHandler(retryType, async () => ({
  success: false,
  error: { code: "TEMP", message: "retry please", retryable: true },
}));

const retryJob = await createJob({
  type: retryType,
  inputRefs: [`retry_${randomUUID()}`],
  maxAttempts: 3,
});

const retryResult = await executeJob(retryJob.id);
const retryState = await getJob(retryJob.id);
if (retryResult.jobStatus !== "retry_wait" || retryState.status !== "retry_wait") {
  fail(`Retryable failure should enter retry_wait, got ${retryState?.status}`);
} else {
  pass("Retryable failure enters retry state");
}

if (!(await getEventsByType("processor.job_retry")).some((row) => row.payload?.jobId === retryJob.id)) {
  fail("processor.job_retry event missing");
} else {
  pass("Processor emits processor.job_retry");
}

const deadType = `demo.dead_${randomUUID().slice(0, 8)}`;
registerJobHandler(deadType, async () => ({
  success: false,
  error: { code: "PERM", message: "no retry", retryable: true },
}));

const deadJob = await createJob({
  type: deadType,
  inputRefs: [`dead_${randomUUID()}`],
  maxAttempts: 1,
});

const deadResult = await executeJob(deadJob.id);
const deadState = await getJob(deadJob.id);
if (deadResult.jobStatus !== "dead_letter" || deadState.status !== "dead_letter") {
  fail(`Max attempts should dead-letter, got ${deadState?.status}`);
} else {
  pass("Max attempts enters dead-letter");
}

if (!(await getEventsByType("processor.job_dead_letter")).some((row) => row.payload?.jobId === deadJob.id)) {
  fail("processor.job_dead_letter missing for max attempts");
} else {
  pass("Processor emits processor.job_dead_letter");
}

const successCorrelation = processResult.correlationId;
const correlated = await getEventsByCorrelationId(successCorrelation);
for (const type of [
  "processor.started",
  "processor.job_claimed",
  "processor.handler_resolved",
  "processor.job_completed",
  "processor.completed",
]) {
  if (!correlated.some((row) => row.type === type)) {
    fail(`Missing correlated processor event ${type}`);
  }
}

for (const event of correlated.filter((row) => row.type.startsWith("processor."))) {
  const problem = assertProcessorEventFields(event);
  if (problem) {
    fail(`Processor event ${event.type} ${problem}`);
  }
}

if (!errors.some((message) => message.includes("Processor event"))) {
  pass("Processor events include id, timestamp, correlationId, causationId, processorId, jobId, handler");
}

for (const type of REQUIRED_EVENT_TYPES) {
  if (!(await getEventsByType(type)).length) {
    fail(`Missing processor event type: ${type}`);
  }
}

if (!errors.some((message) => message.includes("Missing processor event type"))) {
  pass("Processor emits required event types");
}

await assertProcessorBoundaries();
await assertSchedulerUnchanged();

const afterGit = await runGit(["status", "--porcelain"]);
const afterLines = afterGit ? afterGit.split("\n").filter(Boolean) : [];
const runtimeChanges = afterLines.filter((line) => {
  const path = line.slice(2).trimStart();
  if (path.endsWith(".gitkeep")) return false;
  return path.startsWith("runtime/");
});

if (runtimeChanges.length) {
  fail(`Runtime writes dirty git: ${runtimeChanges.join(", ")}`);
} else {
  pass("Runtime remains git-clean");
}

await new Promise((resolve) => setTimeout(resolve, 1500));

if (!shouldSkipNestedRegressions()) {
try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-3-2.js")], {
    cwd: ROOT,
  });
  pass("validate-phase-3-2.js regression passes");
} catch (error) {
  fail(`validate-phase-3-2.js regression failed: ${error.message}`);
}


}
try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-3-1-8.js")], {
    cwd: ROOT,
    env: { ...process.env, OPENCLAW_ALLOW_VALIDATION_DEMO: "1" },
  });
  pass("validate-phase-3-1-8.js regression passes");
} catch (error) {
  fail(`validate-phase-3-1-8.js regression failed: ${error.message}`);
}

if (!shouldSkipNestedRegressions()) {
try {
  await execFileAsync(
    process.execPath,
    [join(ROOT, "scripts/opportunity-engine/validate-phase-2-9-5.js"), "--quick"],
    { cwd: ROOT },
  );
  pass("validate-phase-2-9.5.js regression passes");
} catch (error) {
  fail(`validate-phase-2-9.5.js regression failed: ${error.message}`);
}


}
await finalizeValidator({ phase: "3.3", errors, startedAt: __validationStartedAt });

console.log("\nPhase 3.3 validation passed.");
console.log("Clock → Scheduler → Pending Jobs → Processor → Completed / Retry / Dead-letter. STOP.");
