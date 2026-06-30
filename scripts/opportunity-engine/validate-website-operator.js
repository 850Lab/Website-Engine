import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapValidator, finalizeValidator } from "../../src/engine/validation/index.js";
import {
  collectLegacyWebsiteScanObservations,
  runWebsiteScanBridgeSensor,
  WEBSITE_AGENCY_MISSION_ID,
  WEBSITE_SCAN_BRIDGE_SENSOR_ID,
  clearSensorsForTests,
} from "../../src/engine/sensors/index.js";
import { clearSignalStoreForTests, listSignals } from "../../src/engine/signals/index.js";
import { listFacts } from "../../src/engine/facts/index.js";
import { listSituations } from "../../src/engine/situations/index.js";
import { listProblems } from "../../src/engine/problems/index.js";
import { listOpportunities } from "../../src/engine/opportunities/index.js";
import { assertEngineDataClean } from "./assert-engine-data-clean.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
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

const documents = {
  qualifiedBusinesses: {
    version: 1,
    records: [
      {
        id: "qbd_website_bridge_fixture",
        businessName: "Bayou Plumbing",
        industry: "Plumbing",
        category: "Plumber",
        city: "Beaumont",
        state: "TX",
        address: "100 Main St, Beaumont, TX",
        websiteUrl: "https://example.com/bayou-plumbing",
        websiteStatus: "poor_website",
        websiteScore: 45,
        phone: "(409) 555-0100",
        email: "owner@example.com",
        businessIdentityId: "bid_website_bridge_fixture",
      },
    ],
  },
  websiteQualityScores: {
    version: 1,
    scores: [
      {
        businessId: "qbd_website_bridge_fixture",
        businessName: "Bayou Plumbing",
        websiteUrl: "https://example.com/bayou-plumbing",
        websiteScore: 45,
        websiteStatus: "poor_website",
        reasons: ["No clear call to action", "No contact form detected"],
        confidence: "estimated",
        scoredAt: "2026-06-30T12:00:00.000Z",
      },
    ],
  },
  angleAnalyses: {
    version: 1,
    analyses: {
      qbd_website_bridge_fixture: {
        businessId: "qbd_website_bridge_fixture",
        business_name: "Bayou Plumbing",
        industry: "Plumbing",
        city: "Beaumont",
        detected_problem: "Website exists but does not convert searchers into calls",
        primary_angle: "Turn local searches into booked jobs",
        confidence_score: 82,
        folder: "weak_conversion",
        signal_summary: {
          websiteStatus: "poor_website",
          websiteScore: 45,
        },
        analyzedAt: "2026-06-30T12:01:00.000Z",
      },
    },
  },
};

await clearSignalStoreForTests();
clearSensorsForTests();

const collected = await collectLegacyWebsiteScanObservations({ documents, limit: 5 });
if (collected.errors.length) {
  fail(`Website scan bridge should not report fixture errors: ${collected.errors.join("; ")}`);
} else {
  pass("Website scan bridge collects fixture without errors");
}

const observation = collected.observations[0];
if (!observation) {
  fail("Website scan bridge did not create an observation from fixture data");
} else {
  pass("Website scan bridge creates an observation from fixture data");
}

if (observation?.metadata?.candidateMissionIds?.[0] !== WEBSITE_AGENCY_MISSION_ID) {
  fail("Website scan observation missing website agency mission candidate");
} else {
  pass("Website scan observation carries website agency mission candidate");
}

if (observation?.metadata?.phone || observation?.metadata?.email) {
  fail("Website scan observation must not copy contact fields into metadata");
} else {
  pass("Website scan observation avoids contact-field metadata");
}

const before = await downstreamCounts();
const signalCountBefore = (await listSignals()).length;
const run = await runWebsiteScanBridgeSensor({ documents, limit: 1 });
if (run.sensorId !== WEBSITE_SCAN_BRIDGE_SENSOR_ID || run.observationsIngested !== 1 || run.signalsCreated.length !== 1) {
  fail(`Expected one website scan signal, got ${run.observationsIngested}`);
} else {
  pass("Website scan bridge ingests through existing signal path");
}

const signals = await listSignals();
const created = signals.find((signal) => signal.id === run.signalsCreated[0]);
if (!created) {
  fail("Created website scan signal not found");
} else {
  pass("Created website scan signal is persisted");
}

if (created?.provenance?.legacySource !== "data/website-quality-scores.json") {
  fail("Website scan signal missing legacy source provenance");
} else {
  pass("Website scan signal carries legacy source provenance");
}

if (!created?.provenance?.candidateMissionIds?.includes(WEBSITE_AGENCY_MISSION_ID)) {
  fail("Website scan signal missing website mission candidate provenance");
} else {
  pass("Website scan signal carries website mission candidate provenance");
}

if ((await listSignals()).length !== signalCountBefore + 1) {
  fail("Website scan bridge should create exactly one signal");
} else {
  pass("Website scan bridge creates only a signal");
}

const after = await downstreamCounts();
for (const [key, count] of Object.entries(before)) {
  if (after[key] !== count) {
    fail(`Website scan bridge changed downstream ${key}: ${count} -> ${after[key]}`);
  }
}
if (!errors.some((message) => message.includes("downstream"))) {
  pass("Website scan bridge does not create facts, situations, problems, or opportunities");
}

const source = await readFile(join(ROOT, "src/engine/sensors/live/website-scan-bridge.js"), "utf8");
for (const forbidden of ["writeFile", "saveMission", "createOpportunity", "createJob", "runOpenClaw", "sendEmail"]) {
  if (source.includes(forbidden)) {
    fail(`Website scan bridge contains forbidden execution or write pattern: ${forbidden}`);
  }
}
if (!errors.some((message) => message.includes("forbidden execution or write pattern"))) {
  pass("Website scan bridge remains read-only observation mapping");
}

try {
  await assertEngineDataClean();
  pass("engine-data/ unchanged by website operator validation");
} catch (error) {
  fail(error.message);
}

await finalizeValidator({ phase: "4.2", errors, startedAt: __validationStartedAt });

console.log("\nWebsite operator validation passed.");
