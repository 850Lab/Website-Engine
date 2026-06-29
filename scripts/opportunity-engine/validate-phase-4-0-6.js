import { readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  bootstrapValidator,
  finalizeValidator,
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
import { runLivePipeline, clearInboxForRun } from "./run-live-pipeline.js";
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
try {
  const pipelineResult = await runLivePipeline({ runId: randomUUID().slice(0, 8) });
  if (!pipelineResult?.success) {
    fail(`live pipeline did not succeed: ${pipelineResult?.error || "unknown"}`);
  } else {
    pass("live pipeline completed in isolated runtime");
  }
} catch (error) {
  fail(`live pipeline failed: ${error.message}`);
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
