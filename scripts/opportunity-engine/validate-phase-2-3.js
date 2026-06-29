import { readFile, access } from "node:fs/promises";
import { bootstrapValidator, finalizeValidator, shouldSkipNestedRegressions } from "../../src/engine/validation/index.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  registerSensor,
  unregisterSensor,
  listSensors,
  getSensor,
  runSensor,
  runAllSensors,
  healthReport,
  clearSensorsForTests,
  SENSOR_LIFECYCLE,
} from "../../src/engine/sensors/index.js";
import { registerDemoSensors } from "../../src/engine/sensors/demo/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("2.3");

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

async function assertNoNetworkInSensorSources() {
  const files = [
    "src/engine/sensors/index.js",
    "src/engine/sensors/demo/web-sensor.js",
    "src/engine/sensors/demo/document-sensor.js",
    "src/engine/sensors/demo/crm-sensor.js",
  ];
  for (const file of files) {
    const source = await readFile(join(ROOT, file), "utf8");
    if (/\bfetch\s*\(/.test(source) || /\bhttps?:\/\//.test(source)) {
      if (file.includes("demo") && /\bhttps?:\/\//.test(source)) {
        continue;
      }
      if (/\bfetch\s*\(/.test(source)) {
        fail(`Network call pattern found in ${file}`);
      }
    }
  }
  if (!errors.some((message) => message.includes("Network call pattern"))) {
    pass("No external API calls in sensor framework sources");
  }
}

clearSensorsForTests();
registerDemoSensors();

if (listSensors().length !== 3) {
  fail("Expected three demo sensors to register");
} else {
  pass("Sensors register");
}

for (const id of ["sensor_web_demo", "sensor_document_demo", "sensor_crm_demo"]) {
  if (!getSensor(id)) fail(`Missing demo sensor: ${id}`);
}
if (!errors.some((message) => message.includes("Missing demo sensor"))) {
  pass("Demo sensors registered");
}

const beforeGit = await runGit(["status", "--porcelain"]);
const beforeLines = beforeGit ? beforeGit.split("\n").filter(Boolean) : [];

const uniqueSuffix = randomUUID();
const webResult = await runSensor("sensor_web_demo", { uniqueSuffix }, { publish: true });
if (!webResult.observations.length || !webResult.ingested.length) {
  fail("Web demo sensor did not emit and ingest observations");
} else if (webResult.ingested[0].signal.processingState !== "classified") {
  fail("Web sensor ingest did not reach classified state");
} else if (!webResult.ingested[0].signal.rawTextRef.startsWith("runtime/signals/raw/")) {
  fail("Web sensor ingest did not use runtime raw archive");
} else {
  pass("Demo sensors run and observations ingest correctly");
}

const collectOnly = await runSensor(
  "sensor_document_demo",
  { uniqueSuffix: randomUUID() },
  { publish: false },
);
if (!collectOnly.observations.length || collectOnly.ingested.length !== 0) {
  fail("Document sensor collect-only mode failed");
} else {
  pass("Demo sensors emit canonical observations");
}

await runAllSensors({ uniqueSuffix: randomUUID() }, { publish: true });

const report = healthReport();
const webHealth = report.sensors.find((row) => row.id === "sensor_web_demo")?.health;
if (!webHealth?.lastRun || webHealth.successes < 1 || webHealth.observationsEmitted < 1) {
  fail("Sensor health report missing expected metrics");
} else {
  pass("Sensor health tracked");
}

if (getSensor("sensor_crm_demo") && listSensors().every((row) => row.lifecycle === SENSOR_LIFECYCLE.IDLE)) {
  pass("Sensor lifecycle returns to idle");
} else {
  fail("Sensor lifecycle did not return to idle");
}

unregisterSensor("sensor_web_demo");
if (getSensor("sensor_web_demo")) {
  fail("unregisterSensor did not remove sensor");
} else {
  pass("unregisterSensor works");
}
registerDemoSensors();
if (!getSensor("sensor_web_demo")) {
  fail("Could not re-register web sensor after unregister test");
}

const signal = webResult.ingested[0].signal;
if (signal.factIds?.length || signal.problemIds?.length || signal.opportunityIds?.length) {
  fail("Sensor ingest produced facts/problems/opportunities");
} else {
  pass("No facts/problems/opportunities generated");
}

const homeSource = await readFile(join(ROOT, "src/pivotal-os/pages/home.js"), "utf8");
if (homeSource.includes("runSensor") || homeSource.includes("sensors/index")) {
  fail("Mission Control modified for sensors");
} else {
  pass("Mission Control unchanged");
}

await assertNoNetworkInSensorSources();

const afterGit = await runGit(["status", "--porcelain"]);
const afterLines = afterGit ? afterGit.split("\n").filter(Boolean) : [];
const runtimeTrackedChanges = afterLines.filter((line) => {
  const path = line.slice(2).trimStart();
  if (path === "runtime/" || path === "runtime") return false;
  if (path.endsWith(".gitkeep")) return false;
  return path.startsWith("runtime/");
});

if (runtimeTrackedChanges.length) {
  fail(`Runtime files appear in git status: ${runtimeTrackedChanges.join(", ")}`);
} else {
  pass("Runtime remains clean after sensor ingestion");
}

const engineDataDirty = afterLines.some((line) => line.includes("engine-data/signals/signals.json"));
if (engineDataDirty && !beforeLines.some((line) => line.includes("engine-data/signals/signals.json"))) {
  fail("Sensor ingestion modified git-tracked engine-data signal store");
} else {
  pass("Git-tracked engine-data signal store not modified by new writes");
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/autopilot-status.js")], {
    cwd: ROOT,
  });
  pass("Autopilot status runs");
} catch (error) {
  fail(`Autopilot status failed: ${error.message}`);
}

await finalizeValidator({ phase: "2.3", errors, startedAt: __validationStartedAt });

console.log("\nPhase 2.3 validation passed.");