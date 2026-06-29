import { access } from "node:fs/promises";
import { bootstrapValidator, finalizeValidator, shouldSkipNestedRegressions } from "../../src/engine/validation/index.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { clearEventStoreForTests, initializeEventStore, listEvents } from "../../src/engine/events/index.js";
import { clearJobStoreForTests, initializeJobStore } from "../../src/engine/jobs/index.js";
import { clearSchedulerStoreForTests } from "../../src/engine/scheduler/index.js";
import { clearDispatchStoreForTests } from "../../src/engine/execution-queue/index.js";
import { clearOrchestratorStoreForTests } from "../../src/engine/orchestrator/index.js";
import { clearGraphStoreForTests } from "../../src/engine/graph-store/index.js";
import { clearSituationStoreForTests } from "../../src/engine/situations/index.js";
import { clearHypothesisStoreForTests } from "../../src/engine/hypotheses/index.js";
import { clearProblemStoreForTests } from "../../src/engine/problems/index.js";
import { clearCapabilityMatchStoreForTests } from "../../src/engine/capability-matches/index.js";
import { clearOfferRecommendationStoreForTests } from "../../src/engine/offer-recommendations/index.js";
import { clearOpportunityStoreForTests } from "../../src/engine/opportunities/index.js";
import { clearCapabilityCacheForTests } from "../../src/engine/capabilities/index.js";
import { clearOfferCacheForTests } from "../../src/engine/offers/index.js";
import { clearFactStoreForTests } from "../../src/engine/facts/index.js";
import {
  clearSignalStoreForTests,
  getSignalById,
  listSignals,
} from "../../src/engine/signals/index.js";
import { classifySignalRules } from "../../src/engine/signals/classify.js";
import { buildCalibratedDedupKey } from "../../src/engine/signals/dedup.js";
import { evaluateCommercialActionability } from "../../src/engine/opportunity-factory/abstention.js";
import { getRuntimeInboxObservationsDirectory } from "../../src/engine/runtime/index.js";
import { listOpportunities } from "../../src/engine/opportunities/index.js";
import { listProblems } from "../../src/engine/problems/index.js";
import { listSituations } from "../../src/engine/situations/index.js";
import { runLivePipeline, clearInboxForRun } from "./run-live-pipeline.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("4.0");

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

async function resetStores() {
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
  await initializeEventStore();
  await initializeJobStore();
}

function assertClassification(input, expectedType, label) {
  const result = classifySignalRules(input);
  if (result.signalType !== expectedType) {
    fail(`${label}: expected ${expectedType}, got ${result.signalType}`);
  } else {
    pass(`${label} classified as ${expectedType}`);
  }
}

assertClassification(
  { signalType: "company_news", headline: "ABC announces expansion in Beaumont" },
  "expansion",
  "company_news + expansion headline",
);
assertClassification(
  { headline: "Warehouse expansion announced in Houston" },
  "expansion",
  "warehouse expansion headline",
);
assertClassification({ headline: "Port Arthur terminal maintenance window" }, "maintenance", "maintenance window");
assertClassification({ headline: "Turnaround expected at refinery" }, "turnaround", "turnaround expected");
assertClassification({ headline: "RFP issued for terminal services" }, "rfp", "RFP issued");
assertClassification({ headline: "Permit approved for new tank farm" }, "permit", "permit approved");

const maintenanceKey = buildCalibratedDedupKey({
  source: "file_drop",
  signalType: "maintenance",
  headline: "Port Arthur terminal maintenance window",
  contentHash: "hash-maintenance",
});
const turnaroundKey = buildCalibratedDedupKey({
  source: "file_drop",
  signalType: "turnaround",
  headline: "Turnaround activity expected at the Beaumont refinery",
  contentHash: "hash-turnaround",
});
if (maintenanceKey === turnaroundKey) {
  fail("Maintenance and turnaround dedupe keys must be distinct");
} else {
  pass("Calibrated dedupe keys distinguish maintenance vs turnaround");
}

const sparseActionability = evaluateCommercialActionability({
  problem: {
    id: "prob_test",
    category: "general_services_demand",
    confidence: 0.52,
    supportingFactIds: [],
    supportingSignalIds: [],
    metadata: { situationCategory: "Unknown" },
  },
  capabilityMatch: {
    recommendedCapabilities: [{ capabilityId: "ktm_labor", fitScore: 0.45 }],
  },
  offerRecommendation: {
    recommendedOffers: [{ offerId: "offer_ktm_manpower", offerFitScore: 0.5 }],
  },
  signal: { signalType: "unknown" },
});
if (sparseActionability.actionable) {
  fail("Sparse unknown signal should abstain");
} else {
  pass(`Sparse unknown abstains with reason ${sparseActionability.abstained.reason}`);
}

async function runObservationFixture(fixture) {
  await resetStores();
  await clearInboxForRun();

  if (fixture.useDemo) {
    const report = await runLivePipeline({ writeReports: false });
    return { report, error: null };
  }

  const outName = `phase40-${fixture.id}-${randomUUID().slice(0, 8)}${fixture.ext}`;
  const body =
    typeof fixture.content === "string"
      ? fixture.content
      : `${JSON.stringify(fixture.content, null, 2)}\n`;
  await writeFile(join(getRuntimeInboxObservationsDirectory(), outName), body, "utf8");

  try {
    const report = await runLivePipeline({ mode: "inbox", clearInbox: false, writeReports: false });
    return { report, error: null, inboxFile: outName };
  } catch (error) {
    return { report: null, error: error.message, inboxFile: outName };
  }
}

const integrationFixtures = [
  {
    id: "expansion-company-news-json",
    ext: ".json",
    content: {
      source: "file_drop",
      signalType: "company_news",
      headline: "ABC Manufacturing announces expansion in Beaumont",
      summary: "ABC Manufacturing announced a $40M Beaumont expansion.",
      location: { city: "Beaumont", state: "TX", country: "US" },
    },
    expectOpportunity: true,
    expectSignalType: "expansion",
  },
  {
    id: "engine-expansion-houston",
    ext: ".json",
    content: {
      source: "manual",
      signalType: "expansion",
      headline: "Warehouse expansion announced in Houston",
      summary: "Warehouse expansion announced.",
      location: { city: "Houston", state: "TX", country: "US" },
    },
    expectOpportunity: true,
    expectSituationCategory: "Expansion",
  },
  {
    id: "engine-company-news-beaumont",
    ext: ".json",
    content: {
      source: "manual",
      signalType: "company_news",
      headline: "ABC Manufacturing announces new facility in Beaumont with $40M investment",
      summary: "ABC Manufacturing announces new facility in Beaumont with $40M investment.",
      location: { city: "Beaumont", state: "TX", country: "US" },
    },
    expectOpportunity: true,
    rejectProblemCategory: "capital_project_services_demand",
    expectSituationCategory: "Expansion",
  },
  {
    id: "maintenance-terminal-txt",
    ext: ".txt",
    content: "Port Arthur terminal maintenance window\nScheduled maintenance on the Port Arthur terminal next week.",
    expectSignalType: "maintenance",
    rejectDedupeBlock: true,
    expectSituationCategory: "Maintenance",
  },
  {
    id: "turnaround-refinery-md",
    ext: ".md",
    content: "# Refinery turnaround notice\n\nTurnaround activity expected at the Beaumont refinery.",
    expectSignalType: "turnaround",
    rejectDedupeBlock: true,
    expectSituationCategory: "Turnaround",
  },
  {
    id: "invalid-json",
    ext: ".json",
    content: "{ not valid json",
    expectSensorError: true,
    expectNoOpportunity: true,
  },
  {
    id: "sparse-unknown-text",
    ext: ".txt",
    content: "Activity noted in the region.",
    expectAbstainOrNoOpportunity: true,
  },
];

for (const fixture of integrationFixtures) {
  const { report, error } = await runObservationFixture(fixture);
  const situations = await listSituations();
  const signalId = report?.sensor?.signalsCreated?.[0] || null;
  const signal = signalId ? await getSignalById(signalId) : (await listSignals()).at(-1);
  const situation =
    situations.find((row) => signalId && row.signalIds?.includes(signalId)) || situations.at(-1);
  const dedupeBlocked = /Duplicate signal detected/i.test(
    `${error || ""} ${(report?.sensor?.errors || []).join(" ")}`,
  );
  const problems = await listProblems();
  const opps = await listOpportunities();
  const events = report?.correlationId ? await listEvents({ correlationId: report.correlationId }) : [];
  const abstained = events.some((row) => row.type === "opportunity.abstained");

  if (fixture.expectSensorError) {
    if (!error && !report?.sensor?.errors?.length) {
      fail(`${fixture.id}: expected sensor rejection`);
    } else {
      pass(`${fixture.id}: invalid JSON rejected at sensor`);
    }
  }

  if (fixture.rejectDedupeBlock && dedupeBlocked) {
    fail(`${fixture.id}: dedupe blocked distinct sparse observation`);
  } else if (fixture.rejectDedupeBlock) {
    pass(`${fixture.id}: distinct signal ingested without dedupe block`);
  }

  if (fixture.expectSignalType) {
    if (signal?.signalType !== fixture.expectSignalType) {
      fail(`${fixture.id}: expected signal type ${fixture.expectSignalType}, got ${signal?.signalType}`);
    } else {
      pass(`${fixture.id}: signal type ${fixture.expectSignalType}`);
    }
  }

  if (fixture.expectSituationCategory) {
    if (situation?.category !== fixture.expectSituationCategory) {
      fail(
        `${fixture.id}: expected situation ${fixture.expectSituationCategory}, got ${situation?.category}`,
      );
    } else {
      pass(`${fixture.id}: situation category ${fixture.expectSituationCategory}`);
    }
  }

  if (fixture.rejectProblemCategory) {
    if (problems.some((row) => row.category === fixture.rejectProblemCategory)) {
      fail(`${fixture.id}: should not produce ${fixture.rejectProblemCategory}`);
    } else {
      pass(`${fixture.id}: avoided generic ${fixture.rejectProblemCategory}`);
    }
  }

  if (fixture.expectOpportunity && opps.length === 0) {
    fail(`${fixture.id}: expected opportunity`);
  } else if (fixture.expectOpportunity) {
    pass(`${fixture.id}: opportunity produced`);
  }

  if (fixture.expectNoOpportunity && opps.length > 0) {
    fail(`${fixture.id}: should not produce opportunity`);
  } else if (fixture.expectNoOpportunity) {
    pass(`${fixture.id}: no opportunity produced`);
  }

  if (fixture.expectAbstainOrNoOpportunity) {
    if (!abstained && opps.length > 0) {
      fail(`${fixture.id}: sparse unknown should abstain or produce no opportunity`);
    } else {
      pass(`${fixture.id}: sparse unknown abstained or produced no opportunity`);
    }
  }
}

const calibrationFiles = [
  "src/engine/signals/dedup.js",
  "src/engine/signals/classify.js",
  "src/engine/capability-matcher/calibration.js",
  "src/engine/opportunity-factory/abstention.js",
  "scripts/opportunity-engine/validate-phase-4-0.js",
];

for (const rel of calibrationFiles) {
  if (!(await fileExists(join(ROOT, rel)))) {
    fail(`Missing calibration artifact ${rel}`);
  } else {
    pass(`Calibration artifact present: ${rel}`);
  }
}

if (!shouldSkipNestedRegressions()) {
for (const script of ["analyze-real-observations.js", "validate-phase-4-0.js"]) {
  try {
    await execFileAsync(process.execPath, ["--check", join(ROOT, `scripts/opportunity-engine/${script}`)], {
      cwd: ROOT,
    });
    pass(`${script} syntax check passed`);
  } catch (error) {
    fail(`${script} syntax check failed: ${error.message}`);
  }
}

await resetStores();
await clearInboxForRun();

for (const regression of ["validate-phase-3-6.js", "validate-phase-3-7.js", "validate-phase-3-8.js"]) {
  try {
    await execFileAsync(process.execPath, [join(ROOT, `scripts/opportunity-engine/${regression}`)], {
      cwd: ROOT,
      env: { ...process.env, OPENCLAW_WORKER_RUN: process.env.OPENCLAW_WORKER_RUN || "" },
    });
    pass(`${regression} regression passed`);
  } catch (error) {
    fail(`${regression} regression failed: ${error.stderr || error.message}`);
  }
}

}
await finalizeValidator({ phase: "4.0", errors, startedAt: __validationStartedAt });

console.log("\nPhase 4.0 validation passed.");
console.log("Intelligence calibration complete. Phase 4.1 blocked. STOP.");
