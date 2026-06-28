import { readFile, access } from "node:fs/promises";
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
  listOfferRecommendations,
  getOfferRecommendationStorePath,
  clearOfferRecommendationStoreForTests,
} from "../../src/engine/offer-recommendations/index.js";
import { clearHypothesisStoreForTests } from "../../src/engine/hypotheses/index.js";
import { inferProblems } from "../../src/engine/problem-inference/index.js";
import { matchCapabilities } from "../../src/engine/capability-matcher/index.js";
import {
  recommendOffers,
  OFFER_INTELLIGENCE_VERSION,
} from "../../src/engine/offer-intelligence/index.js";
import { clearCapabilityCacheForTests } from "../../src/engine/capabilities/index.js";
import { clearOfferCacheForTests } from "../../src/engine/offers/index.js";
import { buildGraphFromFactsAndPersist, buildSituationsFromGraph } from "../../src/engine/knowledge-graph/index.js";
import { processSignalIntoFacts } from "../../src/engine/fact-builder/pipeline.js";
import { ingestManualObservation } from "../../src/engine/signals/ingest-manual.js";
import { getRuntimePath } from "../../src/engine/runtime/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
let exampleCapabilityMatch = null;
let exampleOfferRecommendation = null;

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
    "src/engine/offer-intelligence/index.js",
    "src/engine/offer-intelligence/candidates.js",
    "src/engine/offer-intelligence/eligibility.js",
    "src/engine/offer-intelligence/fit-score.js",
    "src/engine/offer-intelligence/explainability.js",
    "src/engine/offer-recommendations/index.js",
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
clearCapabilityCacheForTests();
clearOfferCacheForTests();

if (!(await fileExists(getRuntimePath("offer-recommendations", ".gitkeep")))) {
  fail("runtime/offer-recommendations missing");
} else {
  pass("Offer recommendation store directory exists");
}

await initializeProblemStore();
await initializeCapabilityMatchStore();
await initializeOfferRecommendationStore();
pass("Stores initialized");

const uniqueSuffix = randomUUID().slice(0, 8);
const ingestResult = await ingestManualObservation({
  source: "phase_2_8_validation",
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
  fail("No problem promoted for offer intelligence");
} else {
  pass("Problem available for offer intelligence");
}

exampleCapabilityMatch = await matchCapabilities(exampleProblem);
exampleOfferRecommendation = await recommendOffers(exampleCapabilityMatch);

if (!(await fileExists(getOfferRecommendationStorePath()))) {
  fail("runtime/offer-recommendations/offer-recommendations.json missing");
} else {
  pass("Offer recommendation store persisted");
}

if (!exampleOfferRecommendation.recommendedOffers?.length) {
  fail("No recommended offers");
} else {
  pass("Recommended offers produced");
}

const top = exampleOfferRecommendation.recommendedOffers[0];
if (typeof top.offerFitScore !== "number" || top.offerFitScore <= 0) {
  fail("Top offer missing offer fit score");
} else {
  pass("Offer fit score computed");
}

if (!top.dimensionBreakdown || !top.dimensionBreakdown.capabilityCoverage) {
  fail("Offer fit missing dimension breakdown");
} else {
  pass("Offer fit dimension breakdown present");
}

if (top.offerId !== "offer_ktm_manpower") {
  fail("Industrial expansion should recommend offer_ktm_manpower");
} else {
  pass("Expansion problem recommends KTM Manpower offer");
}

if (!exampleOfferRecommendation.explainability?.selected?.length) {
  fail("Offer explainability bundle incomplete");
} else {
  pass("Offer explainability complete");
}

if (!exampleOfferRecommendation.explainability.rejected?.length) {
  fail("Rejected offers not recorded");
} else {
  pass("Rejected offers visible");
}

if (!exampleOfferRecommendation.capabilityMatchId) {
  fail("Offer recommendation missing capabilityMatchId");
} else {
  pass("Offer recommendation references capability match");
}

if (exampleOfferRecommendation.offerIntelligenceVersion !== OFFER_INTELLIGENCE_VERSION) {
  fail("Offer intelligence version missing or incorrect");
} else {
  pass("Offer intelligence version recorded");
}

const replay = await recommendOffers(exampleCapabilityMatch, { persist: false });
if (replay.inputHash !== exampleOfferRecommendation.inputHash) {
  fail("Offer intelligence not reproducible");
} else {
  pass("Offer intelligence reproducible");
}

const matcherSource = await readFile(join(ROOT, "src/engine/capability-matcher/index.js"), "utf8");
if (matcherSource.includes("recommendOffers") || matcherSource.includes("offer-intelligence")) {
  fail("Capability matcher invokes offer intelligence");
} else {
  pass("Capability matcher stops before offer intelligence");
}

const offerIntelSource = await readFile(join(ROOT, "src/engine/offer-intelligence/index.js"), "utf8");
if (
  offerIntelSource.includes("buildOpportunity") ||
  offerIntelSource.includes("opportunity-factory") ||
  offerIntelSource.includes("createOpportunity") ||
  offerIntelSource.includes("scoreOpportunity") ||
  offerIntelSource.includes("buildMissionControl")
) {
  fail("Offer intelligence invokes opportunity factory, scoring, or Mission Control");
} else {
  pass("Offer intelligence stops before opportunity factory");
}

const homeSource = await readFile(join(ROOT, "src/pivotal-os/pages/home.js"), "utf8");
if (
  homeSource.includes("offer-intelligence") ||
  homeSource.includes("recommendOffers")
) {
  fail("Mission Control modified");
} else {
  pass("Mission Control unchanged");
}

await assertNoLlmOrNetwork();

const stored = await listOfferRecommendations();
if (!stored.some((row) => row.problemId === exampleProblem.id)) {
  fail("Offer recommendation not found in store");
} else {
  pass("Offer recommendation stored by problemId");
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
  fail(`Runtime offer recommendation dirty git: ${runtimeTrackedChanges.join(", ")}`);
} else {
  pass("Runtime git clean");
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-2-7.js")], {
    cwd: ROOT,
  });
  pass("Phase 2.7 regression passes");
} catch (error) {
  fail(`Phase 2.7 regression failed: ${error.message}`);
}

if (errors.length) {
  console.error(`\nPhase 2.8 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 2.8 validation passed.");
console.log("\nExample Capability Match:");
console.log(JSON.stringify({
  id: exampleCapabilityMatch.id,
  problemId: exampleCapabilityMatch.problemId,
  topCapabilities: exampleCapabilityMatch.recommendedCapabilities.slice(0, 3).map((row) => ({
    capabilityId: row.capabilityId,
    fitScore: row.fitScore,
  })),
}, null, 2));
console.log("\nExample Offer Recommendation:");
console.log(JSON.stringify({
  id: exampleOfferRecommendation.id,
  capabilityMatchId: exampleOfferRecommendation.capabilityMatchId,
  offerIntelligenceVersion: exampleOfferRecommendation.offerIntelligenceVersion,
  recommendedOffers: exampleOfferRecommendation.recommendedOffers,
  rejectedCount: exampleOfferRecommendation.rejectedOffers.length,
  explainability: {
    selectedCount: exampleOfferRecommendation.explainability.selected.length,
    rejectedCount: exampleOfferRecommendation.explainability.rejected.length,
  },
}, null, 2));
