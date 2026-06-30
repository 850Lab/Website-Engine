import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bootstrapValidator, finalizeValidator } from "../../src/engine/validation/index.js";
import {
  collectFileDropObservations,
  runFileDropSensor,
  clearSensorsForTests,
} from "../../src/engine/sensors/index.js";
import { clearSignalStoreForTests, listSignals } from "../../src/engine/signals/index.js";
import { listFacts } from "../../src/engine/facts/index.js";
import { listSituations } from "../../src/engine/situations/index.js";
import { listProblems } from "../../src/engine/problems/index.js";
import { listOpportunities } from "../../src/engine/opportunities/index.js";
import {
  ensureDirectory,
  getRuntimeInboxObservationsDirectory,
} from "../../src/engine/runtime/index.js";
import { assertEngineDataClean } from "./assert-engine-data-clean.js";

const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("4.2");

function fail(message) {
  errors.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function downstreamCounts() {
  return {
    facts: (await listFacts()).length,
    situations: (await listSituations()).length,
    problems: (await listProblems()).length,
    opportunities: (await listOpportunities()).length,
  };
}

await clearSignalStoreForTests();
clearSensorsForTests();

const inboxDir = getRuntimeInboxObservationsDirectory();
await ensureDirectory(inboxDir);
const fileName = `mission-aware-file-drop-${Date.now()}.json`;
const payload = {
  source: "Commercial property watchlist",
  sourceLabel: "Beaumont commercial property feed",
  headline: "Shopping center remodel creates pressure washing opportunity",
  summary:
    "A Beaumont-area shopping center announced exterior remodel work and tenant turnover that may require entryway and sidewalk cleaning.",
  signalType: "company_news",
  location: { city: "Beaumont", state: "TX", country: "US" },
  candidateMissionIds: ["mission_pressure_washing_beaumont_500"],
  missionHints: ["pressure_washing", "commercial_property", "beaumont_500"],
};
await writeFile(join(inboxDir, fileName), JSON.stringify(payload, null, 2), "utf8");

const collected = await collectFileDropObservations();
const observation = collected.observations.find((row) => row.metadata?.fileName === fileName);
if (!observation) {
  fail("Mission-aware file drop observation was not collected");
} else {
  pass("Mission-aware file drop observation is collected");
}

if (!observation?.metadata?.candidateMissionIds?.includes("mission_pressure_washing_beaumont_500")) {
  fail("Collected observation missing candidate mission id metadata");
} else {
  pass("Collected observation carries candidate mission ids");
}

if (observation?.metadata?.sourceLabel !== "Beaumont commercial property feed") {
  fail("Collected observation missing source label metadata");
} else {
  pass("Collected observation carries source label");
}

const before = await downstreamCounts();
const signalCountBefore = (await listSignals()).length;
const run = await runFileDropSensor();
if (run.observationsIngested !== 1 || run.signalsCreated.length !== 1) {
  fail(`Expected one mission-aware signal, got ${run.observationsIngested}`);
} else {
  pass("Mission-aware file drop ingests through existing signal path");
}

const signals = await listSignals();
const created = signals.find((signal) => signal.id === run.signalsCreated[0]);
if (!created) {
  fail("Created mission-aware signal not found");
} else {
  pass("Created mission-aware signal is persisted");
}

if (!created?.provenance?.candidateMissionIds?.includes("mission_pressure_washing_beaumont_500")) {
  fail("Created signal missing candidate mission ids in provenance");
} else {
  pass("Created signal carries candidate mission ids in provenance");
}

if (created?.provenance?.sourceLabel !== "Beaumont commercial property feed") {
  fail("Created signal missing source label in provenance");
} else {
  pass("Created signal carries source label in provenance");
}

if ((await listSignals()).length !== signalCountBefore + 1) {
  fail("Mission-aware file drop should create exactly one signal");
} else {
  pass("Mission-aware file drop creates only a signal");
}

const after = await downstreamCounts();
for (const [key, count] of Object.entries(before)) {
  if (after[key] !== count) {
    fail(`Mission-aware file drop changed downstream ${key}: ${count} -> ${after[key]}`);
  }
}
if (!errors.some((message) => message.includes("downstream"))) {
  pass("Mission-aware file drop does not create facts, situations, problems, or opportunities");
}

try {
  await assertEngineDataClean();
  pass("engine-data/ unchanged by business discovery validation");
} catch (error) {
  fail(error.message);
}

await finalizeValidator({ phase: "4.2", errors, startedAt: __validationStartedAt });

console.log("\nBusiness discovery validation passed.");
