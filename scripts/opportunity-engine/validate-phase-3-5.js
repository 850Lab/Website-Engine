import { readFile, access, writeFile, readdir, rm } from "node:fs/promises";
import { bootstrapValidator, finalizeValidator, shouldSkipNestedRegressions } from "../../src/engine/validation/index.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  collectFileDropObservations,
  clearSensorsForTests,
  runFileDropSensor,
} from "../../src/engine/sensors/index.js";
import { listFacts } from "../../src/engine/facts/index.js";
import { listGraphEdges, listGraphNodes } from "../../src/engine/graph-store/index.js";
import { listCapabilityMatches } from "../../src/engine/capability-matches/index.js";
import { listOfferRecommendations } from "../../src/engine/offer-recommendations/index.js";
import { listSignals } from "../../src/engine/signals/index.js";
import { listSituations } from "../../src/engine/situations/index.js";
import { listProblems } from "../../src/engine/problems/index.js";
import { listOpportunities } from "../../src/engine/opportunities/index.js";
import {
  ensureDirectory,
  ensureRuntimeDirectories,
  getRuntimeInboxObservationsDirectory,
  getRuntimeInboxProcessedDirectory,
  getRuntimePath,
} from "../../src/engine/runtime/index.js";
import { assertRuntimeDirectoryExists } from "./runtime-directory-assertions.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SENSOR_FILE = "src/engine/sensors/live/file-drop-sensor.js";
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("3.5");

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

async function snapshotDownstreamCounts() {
  return {
    facts: (await listFacts()).length,
    situations: (await listSituations()).length,
    problems: (await listProblems()).length,
    opportunities: (await listOpportunities()).length,
    capabilityMatches: (await listCapabilityMatches()).length,
    offerRecommendations: (await listOfferRecommendations()).length,
    graph: (await listGraphNodes()).length + (await listGraphEdges()).length,
  };
}

async function clearInboxForTests() {
  const inboxDir = getRuntimeInboxObservationsDirectory();
  const processedDir = getRuntimeInboxProcessedDirectory();
  if (await fileExists(inboxDir)) {
    const entries = await readdir(inboxDir);
    for (const entry of entries) {
      if (entry === "processed" || entry === ".gitkeep") continue;
      await rm(join(inboxDir, entry), { force: true });
    }
  }
  if (await fileExists(processedDir)) {
    await rm(processedDir, { recursive: true, force: true });
  }
}

async function assertSensorBoundaries() {
  const source = await readFile(join(ROOT, SENSOR_FILE), "utf8");
  const banned = [
    { pattern: /\bfetch\s*\(/, label: "fetch" },
    { pattern: /\bhttps?:\/\//, label: "http URL" },
    { pattern: /\bbuildMissionControl\s*\(/, label: "Mission Control" },
    { pattern: /\bscoreOpportunity\s*\(/, label: "Score Council" },
    { pattern: /\brunOpenClaw/i, label: "OpenClaw Execution" },
    { pattern: /\bprocessSignalIntoFacts\s*\(/, label: "fact builder" },
    { pattern: /\binferProblems\s*\(/, label: "reasoning" },
    { pattern: /\bsetInterval\s*\(/, label: "setInterval" },
  ];

  for (const rule of banned) {
    if (rule.pattern.test(source)) {
      fail(`Banned ${rule.label} in ${SENSOR_FILE}`);
    }
  }

  if (!errors.some((message) => message.includes("Banned"))) {
    pass("No network calls, Mission Control, Score Council, or OpenClaw Execution in file drop sensor");
  }
}

clearSensorsForTests();

const beforeGit = await runGit(["status", "--porcelain"]);
const beforeCounts = await snapshotDownstreamCounts();

await clearInboxForTests();

await ensureRuntimeDirectories();
await assertRuntimeDirectoryExists(fail, pass, "Runtime inbox exists", "inbox");
await ensureDirectory(getRuntimeInboxObservationsDirectory());
await assertRuntimeDirectoryExists(fail, pass, "Runtime observation drop directory exists", "inbox", "observations");

pass("File drop sensor module loads");

const suffix = randomUUID().slice(0, 8);
const jsonName = `phase-3-5-${suffix}.json`;
const txtName = `phase-3-5-${suffix}.txt`;
const mdName = `phase-3-5-${suffix}.md`;
const badName = `phase-3-5-${suffix}-bad.json`;
const inboxDir = getRuntimeInboxObservationsDirectory();

await writeFile(
  join(inboxDir, jsonName),
  JSON.stringify(
    {
      source: "file_drop",
      sourceType: "file",
      signalType: "company_news",
      headline: `ABC Manufacturing announces expansion ${suffix}`,
      summary: `ABC Manufacturing announced a $40M Beaumont expansion (${suffix}).`,
      location: { city: "Beaumont", state: "TX", country: "US" },
    },
    null,
    2,
  ),
  "utf8",
);

await writeFile(
  join(inboxDir, txtName),
  `Port Arthur terminal maintenance window ${suffix}\nScheduled maintenance on the Port Arthur terminal next week.`,
  "utf8",
);

await writeFile(
  join(inboxDir, mdName),
  `# Refinery turnaround notice ${suffix}\n\nTurnaround activity expected at the Beaumont refinery.`,
  "utf8",
);

await writeFile(join(inboxDir, badName), "{ not valid json", "utf8");

const collected = await collectFileDropObservations();
if (collected.observations.length !== 3) {
  fail(`Expected 3 parsed observations, got ${collected.observations.length}`);
} else {
  pass("JSON, TXT, and MD observations are parsed");
}

const jsonObservation = collected.observations.find((row) => row.metadata?.fileName === jsonName);
if (!jsonObservation || jsonObservation.signalType !== "company_news") {
  fail("JSON observation parsing failed");
} else {
  pass(".json observation is parsed");
}

const txtObservation = collected.observations.find((row) => row.metadata?.fileName === txtName);
if (!txtObservation || !txtObservation.headline.includes("Port Arthur")) {
  fail("TXT observation parsing failed");
} else {
  pass(".txt observation is parsed");
}

const mdObservation = collected.observations.find((row) => row.metadata?.fileName === mdName);
if (!mdObservation || !mdObservation.headline.includes("Refinery turnaround")) {
  fail("MD observation parsing failed");
} else {
  pass(".md observation is parsed");
}

if (!collected.errors.some((message) => message.includes(badName))) {
  fail("Invalid JSON should be reported without crash");
} else {
  pass("Invalid JSON is reported without crash");
}

const signalsBefore = (await listSignals()).length;
const firstRun = await runFileDropSensor();
if (firstRun.observationsIngested !== 3 || firstRun.signalsCreated.length !== 3) {
  fail(`Expected 3 ingested signals, got ${firstRun.observationsIngested}`);
} else {
  pass("Observations ingest through existing sensor path and create signals");
}

const signalsAfter = (await listSignals()).length;
if (signalsAfter < signalsBefore + 3) {
  fail("Signal registry did not grow after file drop ingest");
} else {
  pass("Signals are created in the Signal Registry");
}

for (const fileName of [jsonName, txtName, mdName]) {
  const markerPath = join(getRuntimeInboxProcessedDirectory(), `${fileName}.marker.json`);
  if (!(await fileExists(markerPath))) {
    fail(`Processed marker missing for ${fileName}`);
  }
}

if (!errors.some((message) => message.includes("Processed marker missing"))) {
  pass("Processed markers are created in runtime inbox processed folder");
}

if (!(await fileExists(join(getRuntimeInboxProcessedDirectory(), "archive", jsonName)))) {
  fail("Processed archive copy missing");
} else {
  pass("Processed files are archived without deleting originals");
}

for (const fileName of [jsonName, txtName, mdName]) {
  if (!(await fileExists(join(inboxDir, fileName)))) {
    fail(`Input file should remain in inbox: ${fileName}`);
  }
}

if (!errors.some((message) => message.includes("Input file should remain"))) {
  pass("Input files are not deleted");
}

const secondRun = await runFileDropSensor();
if (secondRun.observationsIngested !== 0 || secondRun.signalsCreated.length !== 0) {
  fail("Re-running sensor should not duplicate processed files");
} else {
  pass("Re-running sensor does not duplicate processed files");
}

if ((await listSignals()).length !== signalsAfter) {
  fail("Re-run created duplicate signals");
} else {
  pass("Re-run does not create duplicate signals");
}

const afterCounts = await snapshotDownstreamCounts();
for (const [key, beforeValue] of Object.entries(beforeCounts)) {
  if (afterCounts[key] !== beforeValue) {
    fail(`Downstream ${key} changed during file drop ingest (${beforeValue} -> ${afterCounts[key]})`);
  }
}

if (!errors.some((message) => message.includes("Downstream"))) {
  pass("No facts, graph, situations, problems, capabilities, offers, or opportunities created");
}

await assertSensorBoundaries();

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
  pass("Runtime git clean");
}

await new Promise((resolve) => setTimeout(resolve, 1500));

if (!shouldSkipNestedRegressions()) {
try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-3-4.js")], {
    cwd: ROOT,
  });
  pass("validate-phase-3-4.js regression passes");
} catch (error) {
  fail(`validate-phase-3-4.js regression failed: ${error.message}`);
}


}
try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-3-3.js")], {
    cwd: ROOT,
  });
  pass("validate-phase-3-3.js regression passes");
} catch (error) {
  fail(`validate-phase-3-3.js regression failed: ${error.message}`);
}

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
await finalizeValidator({ phase: "3.5", errors, startedAt: __validationStartedAt });

console.log("\nPhase 3.5 validation passed.");
console.log("File Drop → Live Sensor → Observation → Signal Registry. STOP.");
