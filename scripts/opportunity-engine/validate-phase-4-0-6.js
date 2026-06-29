import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import {
  bootstrapValidator,
  finalizeValidator,
  getActiveValidationContext,
  isValidationFrameworkManaged,
} from "../../src/engine/validation/index.js";
import { VALIDATOR_GRAPH } from "../../src/engine/validation/graph.js";
import {
  assertNotEngineDataWritePath,
  assertRuntimeWritePath,
  isEngineDataPath,
  writeJsonAtomicWithRetry,
  getRuntimePath,
  getLegacySignalStorePath,
  getRuntimeInboxObservationsDirectory,
  ensureDirectory,
} from "../../src/engine/runtime/index.js";
import {
  createSignal,
  clearSignalStoreForTests,
  initializeRuntimeSignalStore,
} from "../../src/engine/signals/index.js";
import { runFileDropSensor, clearSensorsForTests } from "../../src/engine/sensors/index.js";
import { clearInboxForRun } from "./run-live-pipeline.js";
import { assertEngineDataClean } from "./assert-engine-data-clean.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("4.0.6");

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

async function hashFile(path) {
  if (!(await fileExists(path))) return null;
  const content = await readFile(path, "utf8");
  return createHash("sha256").update(content).digest("hex");
}

function expectThrows(label, fn) {
  try {
    fn();
    fail(`${label} should have thrown`);
    return false;
  } catch (error) {
    pass(`${label} rejected: ${error.message}`);
    return true;
  }
}

async function expectThrowsAsync(label, fn) {
  try {
    await fn();
    fail(`${label} should have thrown`);
    return false;
  } catch (error) {
    pass(`${label} rejected: ${error.message}`);
    return true;
  }
}

function formatLivePipelineFailure(result) {
  const { report, error, stderr, stdout, reportPath } = result;
  if (error && !report) {
    const parts = [error.message || String(error)];
    if (stderr?.trim()) parts.push(`stderr: ${stderr.trim()}`);
    if (stdout?.trim()) parts.push(`stdout: ${stdout.trim()}`);
    if (reportPath) parts.push(`reportPath=${reportPath}`);
    return parts.join(" | ");
  }
  if (!report) {
    return reportPath ? `no live pipeline report returned (expected ${reportPath})` : "no live pipeline report returned";
  }
  return [
    report.summary || "live pipeline incomplete",
    `success=${report.success}`,
    `idle=${report.idle}`,
    `opportunitiesCreated=${report.objectsCreated?.opportunities ?? 0}`,
    `pendingJobs=${report.pendingJobs}`,
    `retryJobs=${report.retryJobs}`,
    `jobs=${report.jobsCompleted}/${report.jobsCreated} completed`,
    report.jobs?.failed ? `failedJobs=${report.jobs.failed}` : null,
    report.sensor?.errors?.length ? `sensorErrors=${report.sensor.errors.join("; ")}` : null,
    reportPath ? `report=${reportPath}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

async function runLivePipelineInFreshRuntime(parentRuntimeRoot) {
  const livePipelineRuntime = join(parentRuntimeRoot, `live-pipeline-${randomUUID().slice(0, 8)}`);
  const livePipelineReportsDir = join(livePipelineRuntime, "reports");
  const mdPath = join(livePipelineReportsDir, "live-pipeline.md");
  const jsonPath = join(livePipelineReportsDir, "live-pipeline.json");
  const runId = randomUUID().slice(0, 8);

  await mkdir(livePipelineReportsDir, { recursive: true });

  const moduleUrl = (absPath) => JSON.stringify(pathToFileURL(absPath).href);

  const runnerCode = `
import { ensureRuntimeDirectories } from ${moduleUrl(join(ROOT, "src/engine/runtime/index.js"))};
import { clearSignalStoreForTests, initializeRuntimeSignalStore } from ${moduleUrl(join(ROOT, "src/engine/signals/index.js"))};
import { clearFactStoreForTests } from ${moduleUrl(join(ROOT, "src/engine/facts/index.js"))};
import { clearEventStoreForTests, initializeEventStore } from ${moduleUrl(join(ROOT, "src/engine/events/index.js"))};
import { clearJobStoreForTests, initializeJobStore } from ${moduleUrl(join(ROOT, "src/engine/jobs/index.js"))};
import { clearSchedulerStoreForTests } from ${moduleUrl(join(ROOT, "src/engine/scheduler/index.js"))};
import { clearDispatchStoreForTests, initializeDispatchStore } from ${moduleUrl(join(ROOT, "src/engine/execution-queue/index.js"))};
import { clearOrchestratorStoreForTests, initializeOrchestratorStore } from ${moduleUrl(join(ROOT, "src/engine/orchestrator/index.js"))};
import { clearGraphStoreForTests } from ${moduleUrl(join(ROOT, "src/engine/graph-store/index.js"))};
import { clearSituationStoreForTests } from ${moduleUrl(join(ROOT, "src/engine/situations/index.js"))};
import { clearHypothesisStoreForTests } from ${moduleUrl(join(ROOT, "src/engine/hypotheses/index.js"))};
import { clearProblemStoreForTests } from ${moduleUrl(join(ROOT, "src/engine/problems/index.js"))};
import { clearCapabilityMatchStoreForTests } from ${moduleUrl(join(ROOT, "src/engine/capability-matches/index.js"))};
import { clearOfferRecommendationStoreForTests } from ${moduleUrl(join(ROOT, "src/engine/offer-recommendations/index.js"))};
import { clearOpportunityStoreForTests } from ${moduleUrl(join(ROOT, "src/engine/opportunities/index.js"))};
import { clearCapabilityCacheForTests } from ${moduleUrl(join(ROOT, "src/engine/capabilities/index.js"))};
import { clearOfferCacheForTests } from ${moduleUrl(join(ROOT, "src/engine/offers/index.js"))};
import { runLivePipeline, clearInboxForRun } from ${moduleUrl(join(ROOT, "scripts/opportunity-engine/run-live-pipeline.js"))};

await ensureRuntimeDirectories();
await clearSignalStoreForTests();
await clearFactStoreForTests();
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
await initializeRuntimeSignalStore();
await initializeEventStore();
await initializeJobStore();
await initializeDispatchStore();
await initializeOrchestratorStore();
await clearInboxForRun();

const report = await runLivePipeline({
  runId: ${JSON.stringify(runId)},
  writeReports: true,
  reportPaths: {
    markdownPath: ${JSON.stringify(mdPath)},
    jsonPath: ${JSON.stringify(jsonPath)},
  },
});

console.log(JSON.stringify({ reportPath: ${JSON.stringify(jsonPath)}, report }));
`;

  const env = {
    ...process.env,
    OPPORTUNITY_RUNTIME_DIR: livePipelineRuntime,
    OPPORTUNITY_OS_RUNTIME_DIR: livePipelineRuntime,
    OPPORTUNITY_VALIDATION_RUNTIME_DIR: livePipelineRuntime,
  };

  try {
    const { stdout } = await execFileAsync(process.execPath, ["--input-type=module", "-e", runnerCode], {
      cwd: ROOT,
      env,
      maxBuffer: 10 * 1024 * 1024,
    });
    const lastLine = stdout.trim().split("\n").filter(Boolean).pop();
    const payload = JSON.parse(lastLine);
    return {
      report: payload.report,
      reportPath: payload.reportPath || jsonPath,
      mdPath,
      jsonPath,
      runtimePath: livePipelineRuntime,
    };
  } catch (error) {
    let report = null;
    try {
      if (await fileExists(jsonPath)) {
        report = JSON.parse(await readFile(jsonPath, "utf8"));
      }
    } catch {
      // Ignore report read failures; outer handler formats subprocess error.
    }
    return {
      report,
      reportPath: jsonPath,
      mdPath,
      jsonPath,
      runtimePath: livePipelineRuntime,
      error,
      stderr: error.stderr || "",
      stdout: error.stdout || "",
    };
  }
}

pass("engine-data guard module loads");

if (isEngineDataPath(join(ROOT, "engine-data/signals/signals.json"))) {
  pass("isEngineDataPath() detects engine-data paths");
} else {
  fail("isEngineDataPath() failed to detect engine-data/signals/signals.json");
}

expectThrows("assertNotEngineDataWritePath(engine-data)", () => {
  assertNotEngineDataWritePath(join(ROOT, "engine-data/signals/signals.json"));
});

const runtimeProbe = getRuntimePath("cache", "engine-data-guard-probe.json");
await expectThrowsAsync("writeJsonAtomic to engine-data", async () => {
  await writeJsonAtomicWithRetry(join(ROOT, "engine-data/signals/guard-probe.json"), { probe: true });
});

try {
  await writeJsonAtomicWithRetry(runtimeProbe, { probe: true, at: new Date().toISOString() });
  pass("runtime write allowed under active runtime store");
} catch (error) {
  fail(`runtime write failed: ${error.message}`);
}

assertRuntimeWritePath(runtimeProbe);
pass("assertRuntimeWritePath() accepts active runtime path");

const legacyPath = getLegacySignalStorePath();
const legacyHashBefore = await hashFile(legacyPath);

await clearSignalStoreForTests();
await initializeRuntimeSignalStore();

const unique = randomUUID();
try {
  await createSignal({
    source: "phase_4_0_6_validation",
    sourceType: "manual",
    observedAt: new Date().toISOString(),
    headline: `Phase 4.0.6 guard signal ${unique}`,
    summary: "Validation-only signal for engine-data guard testing.",
    rawTextRef: `runtime/signals/raw/validation/${unique}.json`,
    signalType: "crm_event",
    urgency: "low",
    dedupKey: `phase_4_0_6|crm_event|${unique}`,
    provenance: { ingestJobId: `validate_406_${unique}` },
  });
  pass("createSignal() writes to runtime store only");
} catch (error) {
  fail(`createSignal() failed: ${error.message}`);
}

const legacyHashAfter = await hashFile(legacyPath);
if (legacyHashBefore !== legacyHashAfter) {
  fail("engine-data/signals/signals.json was modified by signal creation");
} else {
  pass("engine-data/signals/signals.json unchanged after signal creation");
}

await clearSensorsForTests();
const inboxDir = getRuntimeInboxObservationsDirectory();
await clearInboxForRun({ inboxDir });
await ensureDirectory(inboxDir);

const dropName = `guard-file-drop-${randomUUID().slice(0, 8)}.json`;
await writeFile(
  join(inboxDir, dropName),
  `${JSON.stringify(
    {
      source: "file_drop",
      sourceType: "file",
      signalType: "expansion",
      headline: "Guard validation file drop observation",
      summary: "Phase 4.0.6 engine-data guard file drop probe.",
      location: { city: "Beaumont", state: "TX", country: "US" },
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const fileDropRun = await runFileDropSensor();
if (fileDropRun.observationsIngested < 1) {
  fail("file drop sensor did not ingest observation during guard test");
} else {
  pass("file drop pipeline ingested observation in isolated runtime");
}

try {
  await assertEngineDataClean();
  pass("engine-data/ clean after file drop pipeline");
} catch (error) {
  fail(error.message);
}

await clearInboxForRun({ inboxDir });
const validationRuntimeRoot =
  getActiveValidationContext()?.runtimePath ||
  process.env.OPPORTUNITY_VALIDATION_RUNTIME_DIR ||
  process.env.OPPORTUNITY_RUNTIME_DIR ||
  join(ROOT, "runtime-validation");

const livePipelineResult = await runLivePipelineInFreshRuntime(validationRuntimeRoot);
if (!livePipelineResult.report?.success) {
  fail(`live pipeline did not succeed: ${formatLivePipelineFailure(livePipelineResult)}`);
} else {
  pass(`live pipeline completed in fresh isolated runtime (${livePipelineResult.runtimePath})`);
}

if (!(await fileExists(livePipelineResult.jsonPath))) {
  fail(`live pipeline JSON report missing at ${livePipelineResult.jsonPath}`);
} else {
  pass(`live pipeline report written to ${livePipelineResult.jsonPath}`);
}

if (!(await fileExists(livePipelineResult.mdPath))) {
  fail(`live pipeline markdown report missing at ${livePipelineResult.mdPath}`);
} else {
  pass(`live pipeline markdown report written to ${livePipelineResult.mdPath}`);
}

try {
  await assertEngineDataClean();
  pass("engine-data/ clean after live pipeline");
} catch (error) {
  fail(error.message);
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/analyze-real-observations.js")], {
    cwd: ROOT,
    env: { ...process.env },
  });
  pass("analyze-real-observations.js completed without mutating engine-data");
} catch (error) {
  fail(`analyze-real-observations.js failed: ${error.stderr || error.message}`);
}

try {
  await assertEngineDataClean();
  pass("engine-data/ clean after real observation analysis");
} catch (error) {
  fail(error.message);
}

const graphNode = VALIDATOR_GRAPH.find((row) => row.phase === "4.0.6");
if (!graphNode) {
  fail("Phase 4.0.6 missing from VALIDATOR_GRAPH");
} else {
  pass("Phase 4.0.6 registered in release validation graph");
}

try {
  await execFileAsync(process.execPath, ["--check", join(ROOT, "scripts/opportunity-engine/validate-core.js")], {
    cwd: ROOT,
  });
  pass("validate-core.js syntax check passed");
} catch (error) {
  fail(`validate-core.js syntax check failed: ${error.message}`);
}

if (isValidationFrameworkManaged()) {
  pass("validate-core release suite executes Phase 4.0.6 when runner is active");
}

await finalizeValidator({ phase: "4.0.6", errors, startedAt: __validationStartedAt });

console.log("\nPhase 4.0.6 validation passed.");
console.log("Engine-data read-only enforcement complete. Phase 4.1 blocked. STOP.");
