import { readFile, access } from "node:fs/promises";
import { bootstrapValidator, finalizeValidator, shouldSkipNestedRegressions, getActiveValidationContext } from "../../src/engine/validation/index.js";
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
  initializeJobStore,
  listJobs,
} from "../../src/engine/jobs/index.js";
import {
  clearDispatchStoreForTests,
  initializeDispatchStore,
} from "../../src/engine/execution-queue/index.js";
import {
  clearOrchestratorStoreForTests,
  initializeOrchestratorStore,
} from "../../src/engine/orchestrator/index.js";
import { clearSchedulerStoreForTests } from "../../src/engine/scheduler/index.js";
import { clearGraphStoreForTests } from "../../src/engine/graph-store/index.js";
import { clearSituationStoreForTests } from "../../src/engine/situations/index.js";
import { clearHypothesisStoreForTests } from "../../src/engine/hypotheses/index.js";
import { clearProblemStoreForTests, listProblems } from "../../src/engine/problems/index.js";
import {
  clearCapabilityMatchStoreForTests,
  listCapabilityMatches,
} from "../../src/engine/capability-matches/index.js";
import {
  clearOfferRecommendationStoreForTests,
  listOfferRecommendations,
} from "../../src/engine/offer-recommendations/index.js";
import {
  clearOpportunityStoreForTests,
  listOpportunities,
} from "../../src/engine/opportunities/index.js";
import { clearCapabilityCacheForTests } from "../../src/engine/capabilities/index.js";
import { clearOfferCacheForTests } from "../../src/engine/offers/index.js";
import { listFacts } from "../../src/engine/facts/index.js";
import { listGraphEdges, listGraphNodes } from "../../src/engine/graph-store/index.js";
import { listHypotheses } from "../../src/engine/hypotheses/index.js";
import { listSignals } from "../../src/engine/signals/index.js";
import { listSituations } from "../../src/engine/situations/index.js";
import {
  runLivePipeline,
} from "./run-live-pipeline.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const RUNNER_FILE = "scripts/opportunity-engine/run-live-pipeline.js";
const DISPATCH_FILE = "src/engine/execution-queue/dispatch.js";
const SCHEDULER_FILE = "src/engine/scheduler/tick.js";
const PROCESSOR_FILE = "src/engine/processor/execute.js";
const OPENCLAW_FILE = "src/engine/openclaw/worker.js";
const MISSION_CONTROL_FILE = "src/engine/mission-control/index.js";
const REQUIRED_DOMAIN_EVENTS = [
  "signal.created",
  "facts.completed",
  "graph.completed",
  "situations.completed",
  "hypotheses.completed",
  "problems.completed",
  "capability.completed",
  "offer.completed",
  "opportunity.completed",
];
const REQUIRED_PIPELINE_EVENTS = [
  "pipeline.started",
  "pipeline.stage_completed",
  "pipeline.completed",
];
const REQUIRED_ORCHESTRATOR_EVENTS = [
  "orchestrator.started",
  "orchestrator.route_found",
  "orchestrator.job_enqueued",
  "orchestrator.completed",
];
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("3.8");
const validationReportsDir = getActiveValidationContext()?.reportsDir || join(ROOT, "reports");
const LIVE_PIPELINE_MD = join(validationReportsDir, "live-pipeline.md");
const LIVE_PIPELINE_JSON = join(validationReportsDir, "live-pipeline.json");

function fail(message) {
  errors.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

pass(`Isolated validation runtime: ${getActiveValidationContext()?.runtimePath || process.env.OPPORTUNITY_RUNTIME_DIR}`);

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

async function clearPipelineStoresForTests() {
  await clearJobStoreForTests();
  await clearEventStoreForTests();
  await clearSchedulerStoreForTests();
  await clearDispatchStoreForTests();
  await clearOrchestratorStoreForTests();
  await clearGraphStoreForTests();
  await clearSituationStoreForTests();
  await clearHypothesisStoreForTests();
  await clearProblemStoreForTests();
  await clearCapabilityMatchStoreForTests();
  await clearOfferRecommendationStoreForTests();
  await clearOpportunityStoreForTests();
  clearCapabilityCacheForTests();
  clearOfferCacheForTests();
}

async function assertRunnerBoundaries() {
  const source = await readFile(join(ROOT, RUNNER_FILE), "utf8");
  const banned = [
    { pattern: /\bsetInterval\s*\(/, label: "setInterval" },
    { pattern: /\bsetTimeout\s*\(\s*[^,]+,\s*\d+/, label: "polling timer" },
    { pattern: /\bwhile\s*\(\s*true\s*\)/, label: "infinite loop" },
    { pattern: /\bdispatchNextJob\s*\(/, label: "dispatchNextJob" },
    { pattern: /\bexecuteSchedulerTick\s*\(/, label: "executeSchedulerTick" },
    { pattern: /\brunOpenClaw/i, label: "OpenClaw worker" },
    { pattern: /\bbuildMissionControl\s*\(/, label: "Mission Control" },
    { pattern: /\bscoreOpportunity\s*\(/, label: "Score Council" },
    { pattern: /\bprocessSignalIntoFacts\s*\(/, label: "direct fact builder" },
    { pattern: /\binferProblems\s*\(/, label: "direct problem inference" },
  ];

  for (const rule of banned) {
    if (rule.pattern.test(source)) {
      fail(`Banned ${rule.label} in ${RUNNER_FILE}`);
    }
  }

  if (!errors.some((message) => message.includes("Banned"))) {
    pass("Live pipeline runner has no daemon, dispatch, scheduler, or direct intelligence calls");
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

function countDuplicateKeys(jobs, keyFn) {
  const groups = new Map();
  for (const job of jobs) {
    const key = keyFn(job);
    if (!key) continue;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  return [...groups.values()].filter((count) => count > 1).length;
}

if (process.env.OPENCLAW_WORKER_RUN !== "1") {
  await clearPipelineStoresForTests();
}

const beforeGit = await runGit(["status", "--porcelain"]);

await initializeEventStore();
await initializeJobStore();
await initializeDispatchStore();
await initializeOrchestratorStore();

await assertRunnerBoundaries();

const baselineSignals = (await listSignals()).length;
const baselineFacts = (await listFacts()).length;

let report;
try {
  report = await runLivePipeline({
    writeReports: true,
    reportPaths: {
      markdownPath: LIVE_PIPELINE_MD,
      jsonPath: LIVE_PIPELINE_JSON,
    },
  });
} catch (error) {
  fail(`runLivePipeline failed: ${error.message}`);
  report = null;
}

if (report?.success) {
  pass("Live pipeline runner completed successfully");
} else if (report) {
  fail(`Live pipeline runner incomplete: ${report.summary}`);
}

if (!(await fileExists(LIVE_PIPELINE_MD))) {
  fail("validation live-pipeline.md missing");
} else {
  pass("live-pipeline.md generated in validation reports");
}

if (!(await fileExists(LIVE_PIPELINE_JSON))) {
  fail("validation live-pipeline.json missing");
} else {
  pass("live-pipeline.json generated in validation reports");
}

const gitignore = await readFile(join(ROOT, ".gitignore"), "utf8");
if (!gitignore.includes("reports/live-pipeline.md") || !gitignore.includes("reports/live-pipeline.json")) {
  fail("Live pipeline reports not gitignored");
} else {
  pass("Live pipeline reports are gitignored");
}

if (report) {
  if (typeof report.durationMs !== "number" || report.durationMs < 0) {
    fail("Report missing execution duration");
  } else {
    pass("Report includes execution duration");
  }

  if (!report.correlationId) {
    fail("Report missing correlationId");
  } else {
    pass("Report includes correlationId");
  }

  if (!report.opportunityIds?.length) {
    fail("Report missing opportunity ids");
  } else {
    pass("Report includes opportunity ids");
  }
}

if (report?.sensor?.observationsIngested > 0) {
  pass("Observation created");
} else {
  fail("Observation not created");
}

if ((await listSignals()).length > baselineSignals) {
  pass("Signal stored");
} else {
  fail("Signal not stored");
}

if ((await listFacts()).length > baselineFacts) {
  pass("Facts created");
} else {
  fail("Facts not created");
}

if ((await listGraphNodes()).length > 0 && (await listGraphEdges()).length > 0) {
  pass("Graph updated");
} else {
  fail("Graph not updated");
}

if ((await listSituations()).length > 0) {
  pass("Situation created");
} else {
  fail("Situation not created");
}

if ((await listHypotheses()).length > 0) {
  pass("Hypothesis created");
} else {
  fail("Hypothesis not created");
}

if ((await listProblems()).length > 0) {
  pass("Problem created");
} else {
  fail("Problem not created");
}

if ((await listCapabilityMatches()).length > 0) {
  pass("Capability Match created");
} else {
  fail("Capability Match not created");
}

if ((await listOfferRecommendations()).length > 0) {
  pass("Offer Recommendation created");
} else {
  fail("Offer Recommendation not created");
}

if ((await listOpportunities()).length > 0) {
  pass("Opportunity created");
} else {
  fail("Opportunity not created");
}

if ((await listOpportunities()).length > 1) {
  fail("Duplicate opportunities created");
} else {
  pass("No duplicate Opportunities");
}

const correlationId = report?.correlationId;
if (correlationId) {
  const chainEvents = await getEventsByCorrelationId(correlationId);
  if (!chainEvents.length) {
    fail("No correlated events found");
  } else if (chainEvents.some((event) => event.correlationId !== correlationId)) {
    fail("correlationId not preserved across chain events");
  } else {
    pass("correlationId preserved across the entire chain");
  }

  if (!chainEvents.every((event) => "causationId" in event)) {
    fail("Events missing causationId field");
  } else {
    pass("causationId preserved on chain events");
  }
}

for (const type of [...REQUIRED_DOMAIN_EVENTS, ...REQUIRED_PIPELINE_EVENTS, ...REQUIRED_ORCHESTRATOR_EVENTS]) {
  const events = correlationId
    ? (await getEventsByCorrelationId(correlationId)).filter((row) => row.type === type)
    : await getEventsByType(type);
  if (!events.length) {
    fail(`Expected event not emitted: ${type}`);
  } else {
    pass(`Event emitted: ${type}`);
  }
}

const jobs = await listJobs();
const duplicateIdempotency = countDuplicateKeys(
  jobs.filter((row) =>
    [
      "fact.build",
      "graph.project",
      "situation.build",
      "hypothesis.generate",
      "problem.infer",
      "capability.match",
      "offer.recommend",
      "opportunity.build",
    ].includes(row.type),
  ),
  (job) => job.idempotencyKey,
);
if (duplicateIdempotency > 0) {
  fail("Duplicate pipeline Jobs detected by idempotencyKey");
} else {
  pass("No duplicate Jobs");
}

const pendingJobs = jobs.filter((row) => row.status === "pending").length;
const retryJobs = jobs.filter((row) => row.status === "retry_wait").length;
if (pendingJobs || retryJobs) {
  fail(`Pipeline finished with pending=${pendingJobs}, retry_wait=${retryJobs}`);
} else {
  pass("Pipeline completes with zero pending Jobs");
}

await assertUnchangedModule(DISPATCH_FILE, ["dispatchNextJob"], ["runLivePipeline"]);
await assertUnchangedModule(SCHEDULER_FILE, ["createJob"], ["runLivePipeline"]);
await assertUnchangedModule(PROCESSOR_FILE, ["executeJob"], ["runLivePipeline"]);
await assertUnchangedModule(OPENCLAW_FILE, ["runOpenClawBuilderJob"], ["runLivePipeline"]);
await assertUnchangedModule(MISSION_CONTROL_FILE, [], ["runLivePipeline"]);

if (
  !errors.some(
    (message) =>
      message.includes("execution-queue/dispatch") ||
      message.includes("scheduler/tick") ||
      message.includes("processor/execute") ||
      message.includes("openclaw/worker") ||
      message.includes("mission-control/index"),
  )
) {
  pass("Dispatcher, Scheduler, Processor, OpenClaw, and Mission Control remain unchanged");
}

const afterGit = await runGit(["status", "--porcelain"]);
const runtimeChanges = (afterGit ? afterGit.split("\n").filter(Boolean) : []).filter((line) => {
  const path = line.slice(2).trimStart().replace(/\\/g, "/");
  if (path.endsWith(".gitkeep")) return false;
  if (path === "reports/live-pipeline.md" || path === "reports/live-pipeline.json") return false;
  if (path.startsWith("runtime-validation/")) return false;
  return path.startsWith("runtime/");
});

if (runtimeChanges.length) {
  fail(`Runtime writes dirty git: ${runtimeChanges.join(", ")}`);
} else {
  pass("Runtime remains git-clean");
}

await new Promise((resolve) => setTimeout(resolve, 1500));

if (!shouldSkipNestedRegressions()) {
  const regressions = [
    "validate-phase-3-7.js",
    "validate-phase-3-6.js",
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
}

await finalizeValidator({ phase: "3.8", errors, startedAt: __validationStartedAt });

console.log("\nPhase 3.8 validation passed.");
console.log("File Drop → Signal → Opportunity end-to-end. STOP.");
