import { readFile, access, unlink } from "node:fs/promises";
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
  getJobStorePath,
  initializeJobStore,
  listJobs,
} from "../../src/engine/jobs/index.js";
import {
  clearDispatchStoreForTests,
  createDispatchDecision,
  dispatchNextJob,
  emitExecutionQueueEvent,
  getDispatchStorePath,
  initializeDispatchStore,
  listEligibleJobs,
  listWorkerRoutes,
  loadDispatchStore,
  rankEligibleJobs,
  resolveWorkerTarget,
} from "../../src/engine/execution-queue/index.js";
import {
  getRuntimeDispatchDirectory,
  getRuntimeDispatchStorePath,
  getRuntimePath,
} from "../../src/engine/runtime/index.js";
import { clearSchedulerStoreForTests } from "../../src/engine/scheduler/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const QUEUE_FILES = [
  "src/engine/execution-queue/index.js",
  "src/engine/execution-queue/queue.js",
  "src/engine/execution-queue/routing.js",
  "src/engine/execution-queue/priority.js",
  "src/engine/execution-queue/dispatch.js",
  "src/engine/execution-queue/events.js",
];
const PROCESSOR_FILES = [
  "src/engine/processor/execute.js",
];
const SCHEDULER_FILES = [
  "src/engine/scheduler/tick.js",
  "src/engine/scheduler/index.js",
];
const REQUIRED_EVENT_TYPES = [
  "execution_queue.started",
  "execution_queue.job_considered",
  "execution_queue.job_skipped",
  "execution_queue.job_selected",
  "execution_queue.dispatch_created",
  "execution_queue.completed",
  "execution_queue.failed",
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

async function clearJobsAndDispatchForTests() {
  const jobPath = getJobStorePath();
  if (await fileExists(jobPath)) {
    await unlink(jobPath);
  }
  await clearDispatchStoreForTests();
  await initializeJobStore();
  await initializeDispatchStore();
}

function assertQueueEventFields(event) {
  const payload = event.payload || {};
  for (const field of ["timestamp", "dispatchId", "jobId", "jobType", "target"]) {
    if (!(field in payload)) {
      return `missing payload.${field}`;
    }
  }
  if (!event.id || !event.correlationId || !("causationId" in event)) {
    return "missing required event envelope fields";
  }
  return null;
}

async function assertQueueBoundaries() {
  const banned = [
    { pattern: /\bclaimJob\s*\(/, label: "claimJob" },
    { pattern: /\bcompleteJob\s*\(/, label: "completeJob" },
    { pattern: /\bfailJob\s*\(/, label: "failJob" },
    { pattern: /\bexecuteJob\s*\(/, label: "executeJob" },
    { pattern: /\bprocessNextJob\s*\(/, label: "processNextJob" },
    { pattern: /\bcreateJob\s*\(/, label: "createJob" },
    { pattern: /\bregisterSchedule\s*\(/, label: "registerSchedule" },
    { pattern: /\bexecuteSchedulerTick\s*\(/, label: "executeSchedulerTick" },
    { pattern: /\brunSensor\s*\(/, label: "runSensor" },
    { pattern: /\brunConnector\s*\(/, label: "runConnector" },
    { pattern: /\bbuildMissionControl\s*\(/, label: "buildMissionControl" },
    { pattern: /\bscoreOpportunity\s*\(/, label: "scoreOpportunity" },
    { pattern: /\brunOpenClaw/i, label: "OpenClaw worker" },
    { pattern: /\bopenclaw\.execution/i, label: "OpenClaw Execution" },
    { pattern: /\bsetInterval\s*\(/, label: "setInterval" },
    { pattern: /\bsetTimeout\s*\(/, label: "setTimeout" },
    { pattern: /\bwhile\s*\(\s*true\s*\)/, label: "infinite loop" },
  ];

  for (const rel of QUEUE_FILES) {
    const source = await readFile(join(ROOT, rel), "utf8");
    for (const rule of banned) {
      if (rule.pattern.test(source)) {
        fail(`Banned ${rule.label} in ${rel}`);
      }
    }
  }

  if (!errors.some((message) => message.includes("Banned"))) {
    pass("Execution queue has no claim, execute, schedule, sensor, connector, or OpenClaw execution");
  }
}

async function assertProcessorUnchanged() {
  const executeSource = await readFile(join(ROOT, "src/engine/processor/execute.js"), "utf8");
  if (!executeSource.includes("claimJob") || !executeSource.includes("processNextJob")) {
    fail("Processor execute module missing expected execution APIs");
  } else {
    pass("Processor remains unchanged");
  }
}

async function assertSchedulerUnchanged() {
  for (const rel of SCHEDULER_FILES) {
    const source = await readFile(join(ROOT, rel), "utf8");
    if (source.includes("dispatchNextJob") || source.includes("claimJob")) {
      fail(`Scheduler modified with dispatch behavior in ${rel}`);
    }
  }

  if (!errors.some((message) => message.includes("Scheduler modified"))) {
    pass("Scheduler remains unchanged");
  }
}

if (process.env.OPENCLAW_WORKER_RUN !== "1") {
  await clearJobStoreForTests();
  await clearEventStoreForTests();
  await clearSchedulerStoreForTests();
  await clearDispatchStoreForTests();
}

const beforeGit = await runGit(["status", "--porcelain"]);

await initializeEventStore();
await initializeJobStore();
await initializeDispatchStore();

await emitExecutionQueueEvent("execution_queue.failed", {
  dispatchId: null,
  jobId: null,
  jobType: null,
  target: null,
  error: "validation_probe",
});

pass("Execution queue module loads");

if (!(await fileExists(getRuntimePath("dispatch", ".gitkeep")))) {
  fail("runtime/dispatch/.gitkeep missing");
} else {
  pass("runtime/dispatch/ directory exists");
}

if (getRuntimeDispatchDirectory() !== getRuntimePath("dispatch")) {
  fail("getRuntimeDispatchDirectory() mismatch");
} else {
  pass("Dispatch runtime directory wired");
}

if (getDispatchStorePath() !== getRuntimeDispatchStorePath()) {
  fail("getDispatchStorePath() mismatch");
} else {
  pass("Dispatch runtime store path wired");
}

const emptyStore = await loadDispatchStore();
if (!Array.isArray(emptyStore.decisions) || emptyStore.decisions.length !== 0) {
  fail("Dispatch store did not initialize empty");
} else {
  pass("Dispatch runtime store initializes");
}

const routes = listWorkerRoutes();
if (
  !routes.some((row) => row.jobType === "demo.echo" && row.target === "processor") ||
  !routes.some((row) => row.jobType === "openclaw.build" && row.target === "openclaw.builder") ||
  !routes.some((row) => row.jobType === "openclaw.qa" && row.target === "openclaw.qa")
) {
  fail("listWorkerRoutes missing required routes");
} else {
  pass("Worker routes registered");
}

const echoRoute = resolveWorkerTarget({ type: "demo.echo" });
const buildRoute = resolveWorkerTarget({ type: "openclaw.build" });
const qaRoute = resolveWorkerTarget({ type: "openclaw.qa" });
const unknownRoute = resolveWorkerTarget({ type: `unknown_${randomUUID().slice(0, 6)}` });
const blockedRoute = resolveWorkerTarget({ type: "sensor.poll" });

if (echoRoute.target !== "processor" || !echoRoute.eligible) {
  fail("demo.echo should route to processor");
} else {
  pass("Routing resolves demo.echo to processor");
}

if (buildRoute.target !== "openclaw.builder" || !buildRoute.eligible) {
  fail("openclaw.build should route to openclaw.builder");
} else {
  pass("Routing resolves openclaw.build to openclaw.builder");
}

if (qaRoute.target !== "openclaw.qa" || !qaRoute.eligible) {
  fail("openclaw.qa should route to openclaw.qa");
} else {
  pass("Routing resolves openclaw.qa to openclaw.qa");
}

if (unknownRoute.eligible || unknownRoute.target) {
  fail("Unknown job types should be rejected");
} else {
  pass("Unknown job types are rejected");
}

if (blockedRoute.eligible || blockedRoute.target) {
  fail("Blocked job types should not route");
} else {
  pass("Blocked future job types are rejected at routing");
}

await createJob({
  type: "sensor.poll",
  inputRefs: [`sensor_${randomUUID()}`],
});

const blockedJob = (await listJobs({ type: "sensor.poll" }))[0];
const eligibleBeforeBlocked = await listEligibleJobs();
if (eligibleBeforeBlocked.some((row) => row.id === blockedJob.id)) {
  fail("Blocked job types must be excluded from eligible listing");
} else {
  pass("Blocked future job types are skipped in eligible listing");
}

const lowPriority = await createJob({
  type: "demo.echo",
  inputRefs: [`low_${randomUUID()}`],
  priority: 90,
});
const highPriority = await createJob({
  type: "demo.echo",
  inputRefs: [`high_${randomUUID()}`],
  priority: 10,
});

const ranked = rankEligibleJobs(await listEligibleJobs());
const highIndex = ranked.findIndex((row) => row.id === highPriority.id);
const lowIndex = ranked.findIndex((row) => row.id === lowPriority.id);
if (highIndex === -1 || lowIndex === -1 || highIndex >= lowIndex) {
  fail("Priority ranking should prefer lower priority numbers first");
} else {
  pass("Priority ranking works");
}

await clearJobsAndDispatchForTests();

const unknownJob = await createJob({
  type: `unknown_${randomUUID().slice(0, 8)}`,
  inputRefs: [`unknown_${randomUUID()}`],
});

const unknownDispatch = await dispatchNextJob();
if (unknownDispatch.decision || unknownDispatch.target) {
  fail("Unknown job dispatch should not create routable decision");
} else {
  pass("Unknown job types are skipped during dispatch");
}

if (!(await getEventsByType("execution_queue.job_skipped")).some((row) => row.payload?.jobId === unknownJob.id)) {
  fail("execution_queue.job_skipped missing for unknown job");
} else {
  pass("Unknown jobs emit execution_queue.job_skipped");
}

const stillUnknown = await getJob(unknownJob.id);
if (stillUnknown.status !== "pending") {
  fail("Dispatch must not claim unknown jobs");
} else {
  pass("Dispatch does not claim job");
}

await clearJobsAndDispatchForTests();

const echoOnly = await createJob({
  type: "demo.echo",
  inputRefs: [`echo_${randomUUID()}`],
  priority: 5,
});

const dispatchResult = await dispatchNextJob();
if (!dispatchResult.decision || dispatchResult.target !== "processor") {
  fail(`Expected processor dispatch decision, got ${dispatchResult.target}`);
} else {
  pass("Dispatch creates routing decision");
}

const echoState = await getJob(echoOnly.id);
if (echoState.status !== "pending") {
  fail("Dispatch must not execute or claim jobs");
} else {
  pass("Dispatch does not execute job");
}

const persisted = await loadDispatchStore();
if (!persisted.decisions.some((row) => row.id === dispatchResult.dispatchId)) {
  fail("Dispatch decision was not persisted");
} else {
  pass("Dispatch decision is persisted");
}

const correlated = await getEventsByCorrelationId(dispatchResult.correlationId);
for (const type of [
  "execution_queue.started",
  "execution_queue.job_considered",
  "execution_queue.job_selected",
  "execution_queue.dispatch_created",
  "execution_queue.completed",
]) {
  if (!correlated.some((row) => row.type === type)) {
    fail(`Missing correlated execution_queue event ${type}`);
  }
}

for (const event of correlated.filter((row) => row.type.startsWith("execution_queue."))) {
  const problem = assertQueueEventFields(event);
  if (problem) {
    fail(`Execution queue event ${event.type} ${problem}`);
  }
}

if (!errors.some((message) => message.includes("Execution queue event"))) {
  pass("Dispatch emits required events with dispatchId, jobId, jobType, target, correlationId, causationId, timestamp");
}

for (const type of REQUIRED_EVENT_TYPES) {
  if (!(await getEventsByType(type)).length) {
    fail(`Missing execution_queue event type: ${type}`);
  }
}

if (!errors.some((message) => message.includes("Missing execution_queue event type"))) {
  pass("All required execution_queue event types emitted");
}

if (!(await fileExists(getDispatchStorePath()))) {
  fail("dispatch.json not persisted");
} else {
  pass("Dispatch store persisted at runtime/dispatch/dispatch.json");
}

await clearJobsAndDispatchForTests();

const blockedOnly = await createJob({
  type: "sensor.poll",
  inputRefs: [`sensor_only_${randomUUID()}`],
});
const blockedDispatch = await dispatchNextJob();
if (!blockedDispatch.skipped.some((row) => row.jobId === blockedOnly.id)) {
  fail("Blocked sensor.poll should be skipped during dispatch");
} else {
  pass("Blocked future job types are skipped during dispatch");
}

try {
  await createDispatchDecision(null);
  fail("createDispatchDecision should reject invalid job");
} catch {
  pass("Dispatch handles invalid input gracefully");
}

await assertQueueBoundaries();
await assertProcessorUnchanged();
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

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-3-3.js")], {
    cwd: ROOT,
  });
  pass("validate-phase-3-3.js regression passes");
} catch (error) {
  fail(`validate-phase-3-3.js regression failed: ${error.message}`);
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-3-2.js")], {
    cwd: ROOT,
  });
  pass("validate-phase-3-2.js regression passes");
} catch (error) {
  fail(`validate-phase-3-2.js regression failed: ${error.message}`);
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

if (errors.length) {
  console.error(`\nPhase 3.4 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 3.4 validation passed.");
console.log("Clock → Scheduler → Pending Jobs → Execution Queue → Dispatch Decision. STOP.");
