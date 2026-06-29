import { readFile, access } from "node:fs/promises";
import { bootstrapValidator, finalizeValidator, shouldSkipNestedRegressions } from "../../src/engine/validation/index.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  ensureRuntimeDirectories,
  getRuntimePath,
  getRuntimeRoot,
  getRuntimeSignalStorePath,
  getRuntimeRawSignalPath,
} from "../../src/engine/runtime/index.js";
import {
  initializeRuntimeSignalStore,
  getSignalStorePaths,
} from "../../src/engine/signals/index.js";
import {
  registerConnector,
  listConnectors,
  getConnectorById,
  runConnector,
  ingestConnectorResult,
  clearConnectorsForTests,
} from "../../src/engine/connectors/index.js";
import { registerManualDemoConnector } from "../../src/engine/connectors/demo/manual-demo-connector.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("2.2.5");

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

const runtimeDirs = [
  "runtime",
  "runtime/signals",
  "runtime/signals/raw",
  "runtime/logs",
  "runtime/cache",
];

for (const dir of runtimeDirs) {
  if (!(await fileExists(join(ROOT, dir)))) {
    fail(`Missing runtime directory: ${dir}`);
  }
}
if (!errors.some((message) => message.includes("Missing runtime directory"))) {
  pass("Runtime directories exist");
}

await ensureRuntimeDirectories();
const runtimeRoot = getRuntimeRoot();
const signalStorePath = getRuntimeSignalStorePath();
const rawPath = getRuntimeRawSignalPath("2026", "01", "01");

if (!runtimeRoot.includes("runtime") && !process.env.OPPORTUNITY_OS_RUNTIME_DIR) {
  fail("Runtime root does not resolve to runtime/");
} else {
  pass("Runtime paths resolve");
}

await initializeRuntimeSignalStore();
if (!(await fileExists(signalStorePath))) {
  fail("Runtime signal store could not be initialized");
} else {
  pass("Runtime signal store initialized");
}

const storePaths = getSignalStorePaths();
if (storePaths.writeTarget !== signalStorePath) {
  fail("Signal store write target is not runtime path");
} else {
  pass("Signal store write target uses runtime");
}

const gitignore = await readFile(join(ROOT, ".gitignore"), "utf8");
if (!gitignore.includes("runtime/**")) {
  fail(".gitignore does not ignore runtime data");
} else {
  pass("Runtime data is gitignored");
}

for (const forbidden of [
  join(ROOT, "src/engine/facts"),
  join(ROOT, "src/engine/problems"),
  join(ROOT, "engine-data/facts"),
]) {
  if (await fileExists(forbidden)) {
    fail(`Forbidden layer exists: ${forbidden}`);
  }
}
if (!errors.some((message) => message.includes("Forbidden layer"))) {
  pass("No facts/problems/opportunities modules added");
}

const homeSource = await readFile(join(ROOT, "src/pivotal-os/pages/home.js"), "utf8");
if (homeSource.includes("connectors") || homeSource.includes("ingestConnectorResult")) {
  fail("Mission Control appears modified for connectors");
} else {
  pass("No Mission Control changes");
}

clearConnectorsForTests();
registerManualDemoConnector();

if (!listConnectors().length) {
  fail("Connector registry did not load demo connector");
} else {
  pass("Connector registry loads");
}

if (!getConnectorById("manual_demo")) {
  fail("Demo connector not registered");
} else {
  pass("Demo connector registers");
}

const uniqueSuffix = randomUUID();
const connectorResult = await runConnector("manual_demo", { uniqueSuffix });
if (!connectorResult.observations.length || !connectorResult.signalInputs.length) {
  fail("Demo connector did not produce observations");
} else {
  pass("Demo connector runs");
}

const observation = connectorResult.observations[0];
for (const field of ["originalText", "headline", "summary", "source"]) {
  if (!observation[field]) fail(`Demo observation missing ${field}`);
}
if (!errors.some((message) => message.includes("Demo observation missing"))) {
  pass("Demo connector produces canonical observation");
}

const demoSource = await readFile(
  join(ROOT, "src/engine/connectors/demo/manual-demo-connector.js"),
  "utf8",
);
if (/\bfetch\s*\(/.test(demoSource) || /https?:\/\//.test(demoSource)) {
  fail("Demo connector source appears to use network calls");
} else {
  pass("Demo connector has no external network calls");
}

const beforeGit = await runGit(["status", "--porcelain"]);
const beforeLines = beforeGit ? beforeGit.split("\n").filter(Boolean) : [];

const ingested = await ingestConnectorResult(connectorResult);
const signal = ingested[0]?.signal;
if (!signal || signal.processingState !== "classified") {
  fail("Connector output did not complete manual ingestion path");
} else if (!signal.rawTextRef.startsWith("runtime/signals/raw/")) {
  fail("Ingested signal rawTextRef does not use runtime raw archive");
} else {
  pass("Connector output passes through manual ingestion path");
}

if (signal.factIds?.length || signal.problemIds?.length || signal.opportunityIds?.length) {
  fail("Connector ingest produced facts/problems/opportunities");
} else {
  pass("No facts/problems/opportunities generated");
}

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
  pass("Runtime signal ingestion does not dirty git");
}

const newTrackedChanges = afterLines.filter((line) => !beforeLines.includes(line));
const engineDataSignalDirty = newTrackedChanges.some((line) =>
  line.includes("engine-data/signals/signals.json"),
);
if (engineDataSignalDirty) {
  fail("New signal writes modified git-tracked engine-data/signals/signals.json");
} else {
  pass("New writes avoid git-tracked engine-data signal store");
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/autopilot-status.js")], {
    cwd: ROOT,
  });
  pass("Autopilot status runs");
} catch (error) {
  fail(`Autopilot status failed: ${error.message}`);
}

await finalizeValidator({ phase: "2.2.5", errors, startedAt: __validationStartedAt });

console.log("\nPhase 2.2.5 validation passed.");