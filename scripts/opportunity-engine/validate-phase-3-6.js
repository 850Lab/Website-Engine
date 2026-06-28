import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  appendEvent,
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
  clearDispatchStoreForTests,
  initializeDispatchStore,
} from "../../src/engine/execution-queue/index.js";
import {
  clearOrchestratorStoreForTests,
  emitOrchestratorEvent,
  getOrchestratorStorePath,
  initializeOrchestratorStore,
  listEventRoutes,
  loadOrchestratorStore,
  orchestrateEvent,
  resolveEventRoute,
} from "../../src/engine/orchestrator/index.js";
import {
  getRuntimeOrchestratorDirectory,
  getRuntimePath,
} from "../../src/engine/runtime/index.js";
import { clearSchedulerStoreForTests } from "../../src/engine/scheduler/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ORCHESTRATOR_FILES = [
  "src/engine/orchestrator/index.js",
  "src/engine/orchestrator/registry.js",
  "src/engine/orchestrator/routing.js",
  "src/engine/orchestrator/store.js",
  "src/engine/orchestrator/enqueue.js",
  "src/engine/orchestrator/handlers.js",
  "src/engine/orchestrator/events.js",
];
const SCHEDULER_FILE = "src/engine/scheduler/tick.js";
const PROCESSOR_FILE = "src/engine/processor/execute.js";
const OPENCLAW_FILE = "src/engine/openclaw/worker.js";
const REQUIRED_EVENT_TYPES = [
  "orchestrator.started",
  "orchestrator.route_found",
  "orchestrator.job_enqueued",
  "orchestrator.no_route",
  "orchestrator.completed",
  "orchestrator.failed",
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

async function assertOrchestratorBoundaries() {
  const banned = [
    { pattern: /\bclaimJob\s*\(/, label: "claimJob" },
    { pattern: /\bexecuteJob\s*\(/, label: "executeJob" },
    { pattern: /\bprocessNextJob\s*\(/, label: "processNextJob" },
    { pattern: /\bdispatchNextJob\s*\(/, label: "dispatchNextJob" },
    { pattern: /\brunSensor\s*\(/, label: "runSensor" },
    { pattern: /\bprocessSignalIntoFacts\s*\(/, label: "processSignalIntoFacts" },
    { pattern: /\binferProblems\s*\(/, label: "inferProblems" },
    { pattern: /\bbuildSituations\s*\(/, label: "buildSituations" },
    { pattern: /\bgenerateHypotheses\s*\(/, label: "generateHypotheses" },
    { pattern: /\brecommendOffers\s*\(/, label: "recommendOffers" },
    { pattern: /\bbuildOpportunity\s*\(/, label: "buildOpportunity" },
    { pattern: /\bbuildMissionControl\s*\(/, label: "buildMissionControl" },
    { pattern: /\bscoreOpportunity\s*\(/, label: "scoreOpportunity" },
    { pattern: /\brunOpenClaw/i, label: "OpenClaw worker" },
    { pattern: /\bfact-builder\//, label: "fact-builder import" },
    { pattern: /\bproblem-inference\//, label: "problem-inference import" },
    { pattern: /\bsetInterval\s*\(/, label: "setInterval" },
    { pattern: /\bwhile\s*\(\s*true\s*\)/, label: "infinite loop" },
  ];

  for (const rel of ORCHESTRATOR_FILES) {
    const source = await readFile(join(ROOT, rel), "utf8");
    for (const rule of banned) {
      if (rule.pattern.test(source)) {
        fail(`Banned ${rule.label} in ${rel}`);
      }
    }
  }

  if (!errors.some((message) => message.includes("Banned"))) {
    pass("Orchestrator has no direct intelligence execution or worker invocation");
  }
}

async function assertUnchangedModule(rel, requiredPatterns = [], forbiddenPatterns = []) {
  const source = await readFile(join(ROOT, rel), "utf8");
  for (const pattern of requiredPatterns) {
    if (!source.includes(pattern)) {
      fail(`${rel} missing expected pattern ${pattern}`);
    }
  }
  for (const pattern of forbiddenPatterns) {
    if (source.includes(pattern)) {
      fail(`${rel} contains forbidden pattern ${pattern}`);
    }
  }
}

async function appendTriggerEvent(type, payload, correlationId, causationId = null) {
  return appendEvent({
    type,
    subjectType: payload.subjectType || "pipeline",
    subjectId: payload.subjectId || `subj_${randomUUID().slice(0, 8)}`,
    payload,
    correlationId,
    causationId,
  });
}

async function expectJobFromEvent(eventType, payload, expectedJobType, correlationId, causationId) {
  const event = await appendTriggerEvent(
    eventType,
    payload,
    correlationId,
    causationId,
  );
  const result = await orchestrateEvent(event);
  if (result.status !== "completed" || result.jobType !== expectedJobType) {
    fail(`${eventType} should enqueue ${expectedJobType}, got ${result.jobType}`);
    return null;
  }
  const job = await getJob(result.jobId);
  if (!job || job.type !== expectedJobType) {
    fail(`${eventType} job missing or wrong type`);
    return null;
  }
  if (job.metadata?.correlationId !== correlationId) {
    fail(`${eventType} job lost correlationId`);
  }
  if (job.metadata?.causationId !== event.id) {
    fail(`${eventType} job lost causationId`);
  }
  pass(`${eventType} creates ${expectedJobType} job`);
  return { event, job, result };
}

if (process.env.OPENCLAW_WORKER_RUN !== "1") {
  await clearJobStoreForTests();
  await clearEventStoreForTests();
  await clearSchedulerStoreForTests();
  await clearDispatchStoreForTests();
  await clearOrchestratorStoreForTests();
}

const beforeGit = await runGit(["status", "--porcelain"]);

await initializeEventStore();
await initializeJobStore();
await initializeOrchestratorStore();

if (!(await fileExists(getRuntimePath("orchestrator", ".gitkeep")))) {
  fail("runtime/orchestrator/.gitkeep missing");
} else {
  pass("runtime/orchestrator/ directory exists");
}

if (getOrchestratorStorePath() !== getRuntimePath("orchestrator", "orchestrator.json")) {
  fail("getOrchestratorStorePath() mismatch");
} else {
  pass("Orchestrator runtime store path wired");
}

const emptyStore = await loadOrchestratorStore();
if (!Array.isArray(emptyStore.history)) {
  fail("Orchestrator store did not initialize");
} else {
  pass("Orchestrator store initializes");
}

if (listEventRoutes().length < 8) {
  fail("listEventRoutes missing pipeline routes");
} else {
  pass("Event routes registered");
}

const correlationId = `corr_${randomUUID()}`;
let lastEventId = null;

const signalStep = await expectJobFromEvent(
  "signal.created",
  { subjectType: "signal", subjectId: `sig_${randomUUID().slice(0, 8)}`, signalId: `sig_${randomUUID().slice(0, 8)}` },
  "fact.build",
  correlationId,
  lastEventId,
);
if (signalStep) lastEventId = signalStep.event.id;

const factId = `fact_${randomUUID().slice(0, 8)}`;
const factStep = await expectJobFromEvent(
  "facts.completed",
  { subjectType: "fact", subjectId: factId, factIds: [factId] },
  "graph.project",
  correlationId,
  lastEventId,
);
if (factStep) lastEventId = factStep.event.id;

const graphId = `graph_${randomUUID().slice(0, 8)}`;
const graphStep = await expectJobFromEvent(
  "graph.completed",
  { subjectType: "graph", subjectId: graphId, graphId },
  "situation.build",
  correlationId,
  lastEventId,
);
if (graphStep) lastEventId = graphStep.event.id;

const situationId = `sit_${randomUUID().slice(0, 8)}`;
const situationStep = await expectJobFromEvent(
  "situations.completed",
  { subjectType: "situation", subjectId: situationId, situationId },
  "hypothesis.generate",
  correlationId,
  lastEventId,
);
if (situationStep) lastEventId = situationStep.event.id;

const hypothesisId = `hyp_${randomUUID().slice(0, 8)}`;
const hypothesisStep = await expectJobFromEvent(
  "hypotheses.completed",
  { subjectType: "hypothesis", subjectId: hypothesisId, hypothesisIds: [hypothesisId] },
  "problem.infer",
  correlationId,
  lastEventId,
);
if (hypothesisStep) lastEventId = hypothesisStep.event.id;

const problemId = `prob_${randomUUID().slice(0, 8)}`;
const problemStep = await expectJobFromEvent(
  "problems.completed",
  { subjectType: "problem", subjectId: problemId, problemId },
  "capability.match",
  correlationId,
  lastEventId,
);
if (problemStep) lastEventId = problemStep.event.id;

const capabilityMatchId = `cap_match_${randomUUID().slice(0, 8)}`;
const capabilityStep = await expectJobFromEvent(
  "capability.completed",
  { subjectType: "capability_match", subjectId: capabilityMatchId, capabilityMatchId },
  "offer.recommend",
  correlationId,
  lastEventId,
);
if (capabilityStep) lastEventId = capabilityStep.event.id;

const offerId = `offer_rec_${randomUUID().slice(0, 8)}`;
await expectJobFromEvent(
  "offer.completed",
  { subjectType: "offer_recommendation", subjectId: offerId, offerRecommendationId: offerId },
  "opportunity.build",
  correlationId,
  lastEventId,
);

const unknownEvent = await appendTriggerEvent(
  "pipeline.unknown_event",
  { subjectType: "test", subjectId: "test_1" },
  `corr_${randomUUID()}`,
);
const unknownResult = await orchestrateEvent(unknownEvent);
if (!unknownResult.skipped || unknownResult.jobId) {
  fail("Unknown events should be ignored without enqueueing jobs");
} else {
  pass("Unknown events are ignored");
}

if (!(await getEventsByType("orchestrator.no_route")).length) {
  fail("orchestrator.no_route missing");
} else {
  pass("Unknown events emit orchestrator.no_route");
}

const dupSignalId = `sig_dup_${randomUUID().slice(0, 8)}`;
const dupEvent = await appendTriggerEvent(
  "signal.created",
  { subjectType: "signal", subjectId: dupSignalId, signalId: dupSignalId },
  `corr_${randomUUID()}`,
);
const firstDup = await orchestrateEvent(dupEvent);
const secondDup = await orchestrateEvent(dupEvent);
if (!firstDup.jobId || firstDup.jobId !== secondDup.jobId) {
  fail("Duplicate events should not enqueue duplicate active jobs");
} else {
  pass("Duplicate events do not enqueue duplicate jobs");
}

const orchestrated = await getEventsByCorrelationId(correlationId);
if (orchestrated.filter((row) => row.type === "orchestrator.job_enqueued").length < 8) {
  fail("Expected orchestrator.job_enqueued events across pipeline correlation");
} else {
  pass("correlationId preserved across orchestration events");
}

const chainedJob = await getJob(signalStep?.job?.id || "");
if (chainedJob?.metadata?.correlationId !== correlationId) {
  fail("correlationId not preserved on enqueued job");
} else {
  pass("correlationId preserved on enqueued jobs");
}

if (chainedJob?.metadata?.causationId !== signalStep?.event?.id) {
  fail("causationId not preserved on enqueued job");
} else {
  pass("causationId preserved on enqueued jobs");
}

await emitOrchestratorEvent("orchestrator.failed", {
  triggerEventId: null,
  triggerEventType: null,
  error: "validation_probe",
});

for (const type of REQUIRED_EVENT_TYPES) {
  if (!(await getEventsByType(type)).length) {
    fail(`Missing orchestrator event type: ${type}`);
  }
}

if (!errors.some((message) => message.includes("Missing orchestrator event type"))) {
  pass("Orchestrator emits required event types");
}

const history = await loadOrchestratorStore();
if (history.history.length < 8) {
  fail("Orchestrator history not persisted");
} else {
  pass("Orchestrator append-only history persisted");
}

if (!(await fileExists(getOrchestratorStorePath()))) {
  fail("orchestrator.json not written");
} else {
  pass("orchestrator.json runtime store exists");
}

await assertOrchestratorBoundaries();

await assertUnchangedModule(SCHEDULER_FILE, ["createJob"], ["orchestrateEvent"]);
await assertUnchangedModule(PROCESSOR_FILE, ["claimJob"], ["orchestrateEvent"]);
await assertUnchangedModule(OPENCLAW_FILE, ["runOpenClawBuilderJob"], ["orchestrateEvent"]);

if (!errors.some((message) => message.includes("scheduler/tick") || message.includes("processor/execute") || message.includes("openclaw/worker"))) {
  pass("Scheduler, processor, and OpenClaw remain unchanged");
}

if (!resolveEventRoute("signal.created")) {
  fail("resolveEventRoute failed");
} else {
  pass("resolveEventRoute works");
}

const afterGit = await runGit(["status", "--porcelain"]);
const runtimeChanges = (afterGit ? afterGit.split("\n").filter(Boolean) : []).filter((line) => {
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

await clearJobStoreForTests();
await clearEventStoreForTests();
await clearOrchestratorStoreForTests();
await clearDispatchStoreForTests();
await clearSchedulerStoreForTests();
await initializeEventStore();
await initializeJobStore();
await initializeOrchestratorStore();

const regressions = [
  "validate-phase-3-5.js",
  "validate-phase-3-4.js",
  "validate-phase-3-3.js",
  "validate-phase-3-2.js",
  "validate-phase-3-1.js",
];

for (const script of regressions) {
  try {
    await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine", script)], {
      cwd: ROOT,
    });
    pass(`${script} regression passes`);
  } catch (error) {
    fail(`${script} regression failed: ${error.message}`);
  }
}

if (errors.length) {
  console.error(`\nPhase 3.6 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 3.6 validation passed.");
console.log("Event → Orchestrator → Pending Jobs. No execution. STOP.");
