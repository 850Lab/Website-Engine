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
  createJob,
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
  initializeOrchestratorStore,
} from "../../src/engine/orchestrator/index.js";
import { clearSchedulerStoreForTests } from "../../src/engine/scheduler/index.js";
import {
  executeJob,
  listJobHandlers,
  registerBuiltInHandlers,
} from "../../src/engine/processor/index.js";
import {
  PIPELINE_JOB_TYPES,
  RUNTIME_GRAPH_ID,
  registerPipelineHandlers,
} from "../../src/engine/pipeline-handlers/index.js";
import { clearGraphStoreForTests } from "../../src/engine/graph-store/index.js";
import { clearSituationStoreForTests } from "../../src/engine/situations/index.js";
import { clearHypothesisStoreForTests, listHypotheses } from "../../src/engine/hypotheses/index.js";
import { clearProblemStoreForTests, listProblems } from "../../src/engine/problems/index.js";
import {
  clearCapabilityMatchStoreForTests,
  listCapabilityMatches,
} from "../../src/engine/capability-matches/index.js";
import {
  clearOfferRecommendationStoreForTests,
  listOfferRecommendations,
} from "../../src/engine/offer-recommendations/index.js";
import { clearOpportunityStoreForTests, listOpportunities } from "../../src/engine/opportunities/index.js";
import { clearCapabilityCacheForTests } from "../../src/engine/capabilities/index.js";
import { clearOfferCacheForTests } from "../../src/engine/offers/index.js";
import { ingestManualObservation } from "../../src/engine/signals/ingest-manual.js";
import { getRuntimePath } from "../../src/engine/runtime/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PIPELINE_HANDLER_FILES = [
  "src/engine/pipeline-handlers/index.js",
  "src/engine/pipeline-handlers/events.js",
  "src/engine/pipeline-handlers/utils.js",
  "src/engine/pipeline-handlers/fact-build.js",
  "src/engine/pipeline-handlers/graph-project.js",
  "src/engine/pipeline-handlers/situation-build.js",
  "src/engine/pipeline-handlers/hypothesis-generate.js",
  "src/engine/pipeline-handlers/problem-infer.js",
  "src/engine/pipeline-handlers/capability-match.js",
  "src/engine/pipeline-handlers/offer-recommend.js",
  "src/engine/pipeline-handlers/opportunity-build.js",
];
const PROCESSOR_FILE = "src/engine/processor/index.js";
const SCHEDULER_FILE = "src/engine/scheduler/tick.js";
const ORCHESTRATOR_FILE = "src/engine/orchestrator/handlers.js";
const OPENCLAW_FILE = "src/engine/openclaw/worker.js";
const REQUIRED_PIPELINE_EVENTS = [
  "pipeline.started",
  "pipeline.stage_completed",
  "pipeline.failed",
  "pipeline.completed",
];
const DOMAIN_COMPLETION_EVENTS = [
  "facts.completed",
  "graph.completed",
  "situations.completed",
  "hypotheses.completed",
  "problems.completed",
  "capability.completed",
  "offer.completed",
  "opportunity.completed",
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

async function assertPipelineHandlerBoundaries() {
  const banned = [
    { pattern: /\bcreateJob\s*\(/, label: "createJob" },
    { pattern: /\borchestrateEvent\s*\(/, label: "orchestrateEvent" },
    { pattern: /\bdispatchNextJob\s*\(/, label: "dispatchNextJob" },
    { pattern: /\bprocessNextJob\s*\(/, label: "processNextJob" },
    { pattern: /\bclaimJob\s*\(/, label: "claimJob" },
    { pattern: /\brunSensor\s*\(/, label: "runSensor" },
    { pattern: /\bbuildMissionControl\s*\(/, label: "buildMissionControl" },
    { pattern: /\bscoreOpportunity\s*\(/, label: "scoreOpportunity" },
    { pattern: /\brunOpenClaw/i, label: "OpenClaw worker" },
    { pattern: /\bsetInterval\s*\(/, label: "setInterval" },
    { pattern: /\bwhile\s*\(\s*true\s*\)/, label: "infinite loop" },
  ];

  for (const rel of PIPELINE_HANDLER_FILES) {
    const source = await readFile(join(ROOT, rel), "utf8");
    for (const rule of banned) {
      if (rule.pattern.test(source)) {
        fail(`Banned ${rule.label} in ${rel}`);
      }
    }
  }

  if (!errors.some((message) => message.includes("Banned"))) {
    pass("Pipeline handlers have no orchestration, scheduling, or worker execution");
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

async function executeStage(type, inputRefs, correlationId, causationId = null) {
  const job = await createJob({
    type,
    inputRefs,
    metadata: {
      correlationId,
      causationId,
      stage: type,
      enqueuedBy: "validate-phase-3-7",
    },
  });
  const result = await executeJob(job.id, { correlationId, causationId });
  const completed = await getJob(job.id);
  if (result.jobStatus !== "completed" || completed.status !== "completed") {
    fail(`${type} execution failed with status ${result.jobStatus}: ${completed?.error?.message || result.errors.join("; ")}`);
    return null;
  }
  return completed;
}

if (process.env.OPENCLAW_WORKER_RUN !== "1") {
  await clearPipelineStoresForTests();
}

const beforeGit = await runGit(["status", "--porcelain"]);

await initializeEventStore();
await initializeJobStore();
await initializeDispatchStore();
await initializeOrchestratorStore();

if (!(await fileExists(getRuntimePath("pipeline-handlers", ".gitkeep")))) {
  // no runtime dir needed for pipeline handlers
}

const handlers = listJobHandlers();
for (const jobType of PIPELINE_JOB_TYPES) {
  if (!handlers.includes(jobType)) {
    fail(`Processor registry missing production handler ${jobType}`);
  } else {
    pass(`Processor registry contains ${jobType}`);
  }
}

if (handlers.includes("demo.echo")) {
  fail("demo.echo must not be in production processor registration");
} else {
  pass("Demo handler removed from production registration");
}

registerBuiltInHandlers();
if (!listJobHandlers().includes("demo.echo")) {
  fail("demo.echo should remain available via registerBuiltInHandlers for tests");
} else {
  pass("Demo handler available for tests via registerBuiltInHandlers");
}
registerPipelineHandlers();

await assertPipelineHandlerBoundaries();

const correlationId = `corr_${randomUUID().slice(0, 8)}`;
const uniqueSuffix = randomUUID().slice(0, 8);
const ingestResult = await ingestManualObservation({
  source: "phase_3_7_validation",
  sourceType: "manual",
  observedAt: new Date().toISOString(),
  headline: `ABC Manufacturing announces $40M facility expansion in Beaumont (${uniqueSuffix})`,
  summary: "ABC Manufacturing announced a major facility expansion investment in Beaumont, TX.",
  originalText: `ABC Manufacturing announces $40M facility expansion in Beaumont (${uniqueSuffix})`,
  signalType: "expansion",
  location: { city: "Beaumont", state: "TX", country: "US" },
  affectedMarkets: ["industrial_construction"],
  affectedCapabilities: ["site_services"],
  entitiesMentioned: ["ABC Manufacturing"],
  urgency: "high",
});

const factJob = await executeStage(
  "fact.build",
  [ingestResult.signal.id],
  correlationId,
);
if (factJob?.outputRefs?.length) {
  pass("fact.build executes Fact Builder");
} else {
  fail("fact.build missing outputRefs");
}

const graphJob = await executeStage("graph.project", factJob.outputRefs, correlationId);
if (graphJob?.outputRefs?.includes(RUNTIME_GRAPH_ID)) {
  pass("graph.project executes Graph Builder");
} else {
  fail("graph.project missing graph outputRef");
}

const situationJob = await executeStage(
  "situation.build",
  [RUNTIME_GRAPH_ID],
  correlationId,
);
if (situationJob?.outputRefs?.length) {
  pass("situation.build executes Situation Builder");
} else {
  fail("situation.build missing outputRefs");
}

const hypothesisJob = await executeStage(
  "hypothesis.generate",
  [situationJob.outputRefs[0]],
  correlationId,
);
if (hypothesisJob?.outputRefs?.length) {
  pass("hypothesis.generate executes Hypothesis Generator");
} else {
  fail("hypothesis.generate missing outputRefs");
}

const positiveHypothesis = (await listHypotheses()).find(
  (row) =>
    hypothesisJob.outputRefs.includes(row.id) &&
    (row.metadata?.polarity || "positive") === "positive",
);
if (!positiveHypothesis) {
  fail("No positive hypothesis available for problem.infer");
}

const problemJob = await executeStage(
  "problem.infer",
  [positiveHypothesis.id],
  correlationId,
);
if (problemJob?.outputRefs?.length) {
  pass("problem.infer executes Problem Inference");
} else {
  fail("problem.infer missing outputRefs");
}

const capabilityJob = await executeStage(
  "capability.match",
  [problemJob.outputRefs[0]],
  correlationId,
);
if (capabilityJob?.outputRefs?.length) {
  pass("capability.match executes Capability Matcher");
} else {
  fail("capability.match missing outputRefs");
}

const offerJob = await executeStage(
  "offer.recommend",
  [capabilityJob.outputRefs[0]],
  correlationId,
);
if (offerJob?.outputRefs?.length) {
  pass("offer.recommend executes Offer Intelligence");
} else {
  fail("offer.recommend missing outputRefs");
}

const opportunityJob = await executeStage(
  "opportunity.build",
  [offerJob.outputRefs[0]],
  correlationId,
);
if (opportunityJob?.outputRefs?.length) {
  pass("opportunity.build executes Opportunity Factory");
} else {
  fail("opportunity.build missing outputRefs");
}

for (const eventType of REQUIRED_PIPELINE_EVENTS) {
  if (eventType === "pipeline.failed") {
    continue;
  }
  if (!(await getEventsByType(eventType)).length) {
    fail(`Missing pipeline event ${eventType}`);
  } else {
    pass(`Pipeline event emitted: ${eventType}`);
  }
}

const badJob = await createJob({
  type: "fact.build",
  inputRefs: [`signal_missing_${randomUUID()}`],
  metadata: { correlationId: `fail_${randomUUID().slice(0, 8)}` },
});
const badResult = await executeJob(badJob.id);
if (badResult.jobStatus !== "retry_wait" && badResult.jobStatus !== "dead_letter") {
  fail(`Expected fact.build failure for missing signal, got ${badResult.jobStatus}`);
} else if (!(await getEventsByType("pipeline.failed")).length) {
  fail("Missing pipeline event pipeline.failed on handler failure");
} else {
  pass("Pipeline event emitted: pipeline.failed");
}

for (const eventType of DOMAIN_COMPLETION_EVENTS) {
  if (!(await getEventsByType(eventType)).length) {
    fail(`Missing domain completion event ${eventType}`);
  } else {
    pass(`Domain completion event emitted: ${eventType}`);
  }
}

const chainEvents = await getEventsByCorrelationId(correlationId);
if (chainEvents.length < 8) {
  fail("Expected correlated pipeline/domain events across full chain");
} else {
  pass("Pipeline events correlated across full chain");
}

const replayCounts = {
  facts: factJob.outputRefs.length,
  situations: situationJob.outputRefs.length,
  hypotheses: hypothesisJob.outputRefs.length,
  problems: (await listProblems()).length,
  capabilityMatches: (await listCapabilityMatches()).length,
  offerRecommendations: (await listOfferRecommendations()).length,
  opportunities: (await listOpportunities()).length,
};

const replayStages = [
  ["fact.build", [ingestResult.signal.id]],
  ["graph.project", factJob.outputRefs],
  ["situation.build", [RUNTIME_GRAPH_ID]],
  ["hypothesis.generate", [situationJob.outputRefs[0]]],
  ["problem.infer", [positiveHypothesis.id]],
  ["capability.match", [problemJob.outputRefs[0]]],
  ["offer.recommend", [capabilityJob.outputRefs[0]]],
  ["opportunity.build", [offerJob.outputRefs[0]]],
];

for (const [type, inputRefs] of replayStages) {
  const replayJob = await executeStage(type, inputRefs, correlationId);
  if (!replayJob) {
    fail(`${type} replay execution failed`);
  }
}

if ((await listProblems()).length !== replayCounts.problems) {
  fail("Idempotency violated: duplicate problems created on replay");
} else {
  pass("Idempotency preserved for problems on replay");
}

if ((await listCapabilityMatches()).length !== replayCounts.capabilityMatches) {
  fail("Idempotency violated: duplicate capability matches created on replay");
} else {
  pass("Idempotency preserved for capability matches on replay");
}

if ((await listOfferRecommendations()).length !== replayCounts.offerRecommendations) {
  fail("Idempotency violated: duplicate offer recommendations created on replay");
} else {
  pass("Idempotency preserved for offer recommendations on replay");
}

if ((await listOpportunities()).length !== replayCounts.opportunities) {
  fail("Idempotency violated: duplicate opportunities created on replay");
} else {
  pass("Idempotency preserved for opportunities on replay");
}

if ((await listJobs()).length > replayStages.length * 2) {
  // jobs accumulate but artifacts should not
  pass("Replay jobs enqueued without duplicate downstream artifacts");
}

await assertUnchangedModule(SCHEDULER_FILE, ["createJob"], ["registerPipelineHandlers"]);
await assertUnchangedModule(ORCHESTRATOR_FILE, ["orchestrateEvent"], ["executeJob"]);
await assertUnchangedModule(OPENCLAW_FILE, ["runOpenClawBuilderJob"], ["registerPipelineHandlers"]);
await assertUnchangedModule(PROCESSOR_FILE, ["executeJob", "registerPipelineHandlers"], [
  "registerBuiltInHandlers()",
]);

if (
  !errors.some(
    (message) =>
      message.includes("scheduler/tick") ||
      message.includes("orchestrator/handlers") ||
      message.includes("openclaw/worker") ||
      message.includes("processor/index"),
  )
) {
  pass("Scheduler, orchestrator, processor wiring, and OpenClaw remain within bounds");
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

await clearPipelineStoresForTests();
await initializeEventStore();
await initializeJobStore();
await initializeOrchestratorStore();

const regressions = [
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

if (errors.length) {
  console.error(`\nPhase 3.7 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 3.7 validation passed.");
console.log("Processor → Pipeline Handlers → Domain Events. Orchestrator chains next Job. STOP.");
