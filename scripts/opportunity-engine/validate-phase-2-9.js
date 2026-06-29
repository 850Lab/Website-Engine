import { readFile, access } from "node:fs/promises";
import { bootstrapValidator, finalizeValidator, shouldSkipNestedRegressions } from "../../src/engine/validation/index.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  initializeProblemStore,
  clearProblemStoreForTests,
} from "../../src/engine/problems/index.js";
import {
  initializeCapabilityMatchStore,
  clearCapabilityMatchStoreForTests,
} from "../../src/engine/capability-matches/index.js";
import {
  initializeOfferRecommendationStore,
  clearOfferRecommendationStoreForTests,
} from "../../src/engine/offer-recommendations/index.js";
import {
  initializeOpportunityStore,
  listOpportunities,
  getOpportunityStorePath,
  clearOpportunityStoreForTests,
} from "../../src/engine/opportunities/index.js";
import { clearHypothesisStoreForTests } from "../../src/engine/hypotheses/index.js";
import { inferProblems } from "../../src/engine/problem-inference/index.js";
import { matchCapabilities } from "../../src/engine/capability-matcher/index.js";
import { recommendOffers } from "../../src/engine/offer-intelligence/index.js";
import {
  buildOpportunity,
  buildOpportunityForProblem,
  OPPORTUNITY_FACTORY_VERSION,
} from "../../src/engine/opportunity-factory/index.js";
import { validateOpportunity } from "../../src/engine/opportunity-validator/index.js";
import { clearCapabilityCacheForTests } from "../../src/engine/capabilities/index.js";
import { clearOfferCacheForTests } from "../../src/engine/offers/index.js";
import { buildGraphFromFactsAndPersist, buildSituationsFromGraph } from "../../src/engine/knowledge-graph/index.js";
import { processSignalIntoFacts } from "../../src/engine/fact-builder/pipeline.js";
import { ingestManualObservation } from "../../src/engine/signals/ingest-manual.js";
import { assertRuntimeDirectoryExists } from "./runtime-directory-assertions.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("2.9");
let exampleOpportunity = null;
let exampleValidation = null;
let incompleteValidation = null;

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

async function assertNoLlmOrNetwork() {
  const files = [
    "src/engine/opportunity-factory/index.js",
    "src/engine/opportunity-factory/explainability.js",
    "src/engine/opportunity-validator/index.js",
    "src/engine/opportunities/index.js",
  ];
  const banned = [/\bfetch\s*\(/, /\bopenai\b/i, /\banthropic\b/i, /\bllm\b/i, /\bgpt-/i];
  for (const file of files) {
    const source = await readFile(join(ROOT, file), "utf8");
    for (const pattern of banned) {
      if (pattern.test(source)) {
        fail(`Banned pattern ${pattern} found in ${file}`);
      }
    }
  }
  if (!errors.some((message) => message.includes("Banned pattern"))) {
    pass("No LLM or external API usage");
  }
}

await clearHypothesisStoreForTests();
await clearProblemStoreForTests();
await clearCapabilityMatchStoreForTests();
await clearOfferRecommendationStoreForTests();
await clearOpportunityStoreForTests();
clearCapabilityCacheForTests();
clearOfferCacheForTests();

const beforeGit = await runGit(["status", "--porcelain"]);
const beforeLines = beforeGit ? beforeGit.split("\n").filter(Boolean) : [];

await initializeProblemStore();
await initializeCapabilityMatchStore();
await initializeOfferRecommendationStore();
await initializeOpportunityStore();
pass("Stores initialized");
await assertRuntimeDirectoryExists(fail, pass, "Opportunity store directory exists", "opportunities");

const uniqueSuffix = randomUUID().slice(0, 8);
const ingestResult = await ingestManualObservation({
  source: "phase_2_9_validation",
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

const factResult = await processSignalIntoFacts(ingestResult.signal.id);
await buildGraphFromFactsAndPersist(factResult.facts);
await buildSituationsFromGraph();
const inferenceResult = await inferProblems();
const exampleProblem = inferenceResult.promoted[0];

if (!exampleProblem) {
  fail("No problem promoted for opportunity factory");
} else {
  pass("Problem available for opportunity factory");
}

const capabilityMatch = await matchCapabilities(exampleProblem);
const offerRecommendation = await recommendOffers(capabilityMatch);
const assembled = await buildOpportunity({
  problem: exampleProblem,
  capabilityMatch,
  offerRecommendation,
});

exampleValidation = validateOpportunity(assembled);
if (!exampleValidation.valid) {
  fail(`Assembled opportunity failed validation: ${exampleValidation.errors.join("; ")}`);
} else {
  pass("Opportunity validation accepts complete assembly");
}

const incomplete = { ...assembled, buyer: {} };
incompleteValidation = validateOpportunity(incomplete);
if (incompleteValidation.valid) {
  fail("Validator accepted incomplete opportunity");
} else {
  pass("Validation rejects incomplete opportunities");
}

const factoryResult = await buildOpportunityForProblem(exampleProblem.id);
exampleOpportunity = factoryResult.opportunity;

if (!(await fileExists(getOpportunityStorePath()))) {
  fail("runtime/opportunities/opportunities.json missing");
} else {
  pass("Opportunity store persisted");
}

if (exampleOpportunity.status !== "validated") {
  fail(`Expected validated status, got ${exampleOpportunity.status}`);
} else {
  pass("Opportunity factory persists validated opportunities");
}

const explainability = exampleOpportunity.explainability;
const requiredExplainabilityKeys = [
  "whatProblem",
  "whyExists",
  "evidence",
  "selectedCapability",
  "selectedOffer",
  "buyer",
  "location",
  "constraints",
  "commercialViability",
  "recommendedNextAction",
];
if (!requiredExplainabilityKeys.every((key) => explainability?.[key] != null)) {
  fail("Explainability bundle incomplete");
} else {
  pass("Explainability complete");
}

if (!exampleOpportunity.problemId || !exampleOpportunity.capabilityMatchId || !exampleOpportunity.offerRecommendationId) {
  fail("Opportunity missing upstream references");
} else {
  pass("Opportunity references problem, capability match, and offer recommendation");
}

if (exampleOpportunity.metadata?.factoryVersion !== OPPORTUNITY_FACTORY_VERSION) {
  fail("Opportunity factory version missing");
} else {
  pass("Opportunity factory version recorded");
}

const factorySource = await readFile(join(ROOT, "src/engine/opportunity-factory/index.js"), "utf8");
if (
  factorySource.includes("scoreOpportunity") ||
  factorySource.includes("score-council") ||
  factorySource.includes("buildMissionControl")
) {
  fail("Opportunity factory invokes Score Council or Mission Control");
} else {
  pass("No Score Council changes in factory");
}

const offerIntelSource = await readFile(join(ROOT, "src/engine/offer-intelligence/index.js"), "utf8");
if (offerIntelSource.includes("buildOpportunity") || offerIntelSource.includes("opportunity-factory")) {
  fail("Offer intelligence invokes opportunity factory");
} else {
  pass("Offer intelligence stops before opportunity factory");
}

const homeSource = await readFile(join(ROOT, "src/pivotal-os/pages/home.js"), "utf8");
if (
  homeSource.includes("opportunity-factory") ||
  homeSource.includes("buildOpportunityForProblem")
) {
  fail("Mission Control modified");
} else {
  pass("Mission Control unchanged");
}

const scoreCouncilSource = await readFile(join(ROOT, "src/engine/score-council/index.js"), "utf8");
if (scoreCouncilSource.includes("opportunity-factory") || scoreCouncilSource.includes("buildOpportunity")) {
  fail("Score Council modified for opportunity factory");
} else {
  pass("Score Council unchanged");
}

if (await fileExists(join(ROOT, "src/openclaw"))) {
  fail("OpenClaw module created");
} else {
  pass("No OpenClaw");
}

await assertNoLlmOrNetwork();

const stored = await listOpportunities();
if (!stored.some((row) => row.id === exampleOpportunity.id)) {
  fail("Opportunity not found in store");
} else {
  pass("Opportunity stored");
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
  fail(`Runtime opportunity dirty git: ${runtimeTrackedChanges.join(", ")}`);
} else {
  pass("Runtime git clean");
}

if (afterLines.some((line) => line.includes("engine-data/") && !beforeLines.includes(line))) {
  fail("engine-data writes detected during validation");
} else {
  pass("No engine-data writes during validation");
}

await new Promise((resolve) => setTimeout(resolve, 3000));

async function runRegression(script) {
  const scriptPath = join(ROOT, "scripts/opportunity-engine", script);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await execFileAsync(process.execPath, [scriptPath], { cwd: ROOT });
      pass(`${script} regression passes`);
      return;
    } catch (error) {
      if (attempt === 2) {
        fail(`${script} regression failed: ${error.message}`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

for (const script of [
  "validate-phase-2-8.js",
  "validate-phase-2-7.js",
  "validate-phase-2-6.js",
  "validate-phase-2-5-5.js",
]) {
  await runRegression(script);
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

await finalizeValidator({ phase: "2.9", errors, startedAt: __validationStartedAt });

console.log("\nPhase 2.9 validation passed.");
console.log("\nExample Opportunity:");
console.log(JSON.stringify({
  id: exampleOpportunity.id,
  title: exampleOpportunity.title,
  status: exampleOpportunity.status,
  problemId: exampleOpportunity.problemId,
  capabilityMatchId: exampleOpportunity.capabilityMatchId,
  offerRecommendationId: exampleOpportunity.offerRecommendationId,
  confidence: exampleOpportunity.confidence,
  executionReadiness: exampleOpportunity.executionReadiness,
  estimatedValue: exampleOpportunity.estimatedValue,
  recommendedNextAction: exampleOpportunity.recommendedNextAction,
}, null, 2));
console.log("\nExample validation output:");
console.log(JSON.stringify(exampleValidation, null, 2));
console.log("\nExample incomplete validation:");
console.log(JSON.stringify({
  valid: incompleteValidation.valid,
  status: incompleteValidation.status,
  errors: incompleteValidation.errors,
}, null, 2));
console.log("\nExample explainability keys:");
console.log(JSON.stringify(Object.keys(exampleOpportunity.explainability), null, 2));
