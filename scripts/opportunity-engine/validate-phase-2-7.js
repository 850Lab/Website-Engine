import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  initializeProblemStore,
  listProblems,
  clearProblemStoreForTests,
} from "../../src/engine/problems/index.js";
import {
  initializeCapabilityMatchStore,
  listCapabilityMatches,
  getCapabilityMatchStorePath,
  clearCapabilityMatchStoreForTests,
} from "../../src/engine/capability-matches/index.js";
import { clearHypothesisStoreForTests } from "../../src/engine/hypotheses/index.js";
import { inferProblems } from "../../src/engine/problem-inference/index.js";
import { matchCapabilities, MATCHER_VERSION } from "../../src/engine/capability-matcher/index.js";
import { clearCapabilityCacheForTests } from "../../src/engine/capabilities/index.js";
import { buildGraphFromFactsAndPersist, buildSituationsFromGraph } from "../../src/engine/knowledge-graph/index.js";
import { processSignalIntoFacts } from "../../src/engine/fact-builder/pipeline.js";
import { ingestManualObservation } from "../../src/engine/signals/ingest-manual.js";
import { getRuntimePath } from "../../src/engine/runtime/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
let exampleProblem = null;
let exampleMatch = null;

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
    "src/engine/capability-matcher/index.js",
    "src/engine/capability-matcher/candidates.js",
    "src/engine/capability-matcher/constraints.js",
    "src/engine/capability-matcher/fit-score.js",
    "src/engine/capability-matcher/composition.js",
    "src/engine/capability-matcher/explainability.js",
    "src/engine/capability-matches/index.js",
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
clearCapabilityCacheForTests();

if (!(await fileExists(getRuntimePath("capability-matches", ".gitkeep")))) {
  fail("runtime/capability-matches missing");
} else {
  pass("Capability match store directory exists");
}

await initializeProblemStore();
await initializeCapabilityMatchStore();
pass("Problem and capability match stores load");

const uniqueSuffix = randomUUID().slice(0, 8);
const ingestResult = await ingestManualObservation({
  source: "phase_2_7_validation",
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
exampleProblem = inferenceResult.promoted[0];

if (!exampleProblem) {
  fail("No problem promoted for capability matching");
} else {
  pass("Problem available for capability matching");
}

if (!exampleProblem.metadata?.entityContext?.location?.state) {
  fail("Problem missing entityContext.location for constraint matching");
} else {
  pass("Problem carries entityContext for matching");
}

exampleMatch = await matchCapabilities(exampleProblem);

if (!(await fileExists(getCapabilityMatchStorePath()))) {
  fail("runtime/capability-matches/capability-matches.json missing");
} else {
  pass("Capability match store persisted");
}

if (!exampleMatch.recommendedCapabilities?.length) {
  fail("No recommended capabilities");
} else {
  pass("Recommended capabilities produced");
}

const top = exampleMatch.recommendedCapabilities[0];
if (typeof top.fitScore !== "number" || top.fitScore <= 0) {
  fail("Top recommendation missing fit score");
} else {
  pass("Fit score computed");
}

if (!top.dimensionBreakdown || !Object.keys(top.dimensionBreakdown).length) {
  fail("Fit score missing dimension breakdown");
} else {
  pass("Fit score dimension breakdown present");
}

const laborMatch = exampleMatch.recommendedCapabilities.find(
  (row) => row.capabilityId === "ktm_labor",
);
if (!laborMatch) {
  fail("Expansion problem should recommend ktm_labor");
} else {
  pass("Industrial expansion recommends KTM Labor");
}

if (!exampleMatch.explainability?.selected?.length) {
  fail("Explainability bundle incomplete");
} else {
  pass("Explainability bundle complete");
}

if (!exampleMatch.explainability.rejected?.length) {
  fail("Rejected capabilities not recorded");
} else {
  pass("Rejected capabilities visible");
}

if (!exampleMatch.matcherVersion || exampleMatch.matcherVersion !== MATCHER_VERSION) {
  fail("Matcher version missing or incorrect");
} else {
  pass("Matcher version recorded");
}

if (!exampleMatch.inputHash) {
  fail("Input hash missing for reproducibility");
} else {
  pass("Input hash recorded");
}

const replay = await matchCapabilities(exampleProblem, { persist: false });
if (replay.inputHash !== exampleMatch.inputHash) {
  fail("Capability matching not reproducible");
} else {
  pass("Capability matching reproducible");
}

const matcherSource = await readFile(join(ROOT, "src/engine/capability-matcher/index.js"), "utf8");
if (matcherSource.includes("recommendOffers") || matcherSource.includes("offer-intelligence")) {
  fail("Capability matcher invokes offer intelligence");
} else {
  pass("Capability matcher stops before offer intelligence");
}

if (matcherSource.includes("listOffers") || matcherSource.includes("createOpportunity") || matcherSource.includes("buildOpportunity")) {
  fail("Capability matcher invokes offers or opportunities");
} else {
  pass("Capability matcher stops before offers");
}

const problemInferenceSource = await readFile(
  join(ROOT, "src/engine/problem-inference/index.js"),
  "utf8",
);
if (problemInferenceSource.includes("matchCapabilities")) {
  fail("Problem inference invokes capability matching");
} else {
  pass("Problem inference stops before capability matching");
}

const homeSource = await readFile(join(ROOT, "src/pivotal-os/pages/home.js"), "utf8");
if (
  homeSource.includes("capability-matcher") ||
  homeSource.includes("matchCapabilities")
) {
  fail("Mission Control modified");
} else {
  pass("Mission Control unchanged");
}

await assertNoLlmOrNetwork();

const stored = await listCapabilityMatches();
if (!stored.some((row) => row.problemId === exampleProblem.id)) {
  fail("Capability match not found in store");
} else {
  pass("Capability match stored by problemId");
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
  fail(`Runtime capability match dirty git: ${runtimeTrackedChanges.join(", ")}`);
} else {
  pass("Runtime git clean");
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-2-6.js")], {
    cwd: ROOT,
  });
  pass("Phase 2.6 regression passes");
} catch (error) {
  fail(`Phase 2.6 regression failed: ${error.message}`);
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-2-5-5.js")], {
    cwd: ROOT,
  });
  pass("Phase 2.5.5 regression passes");
} catch (error) {
  fail(`Phase 2.5.5 regression failed: ${error.message}`);
}

if (errors.length) {
  console.error(`\nPhase 2.7 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 2.7 validation passed.");
console.log("\nExample Problem:");
console.log(JSON.stringify({
  id: exampleProblem.id,
  title: exampleProblem.title,
  category: exampleProblem.category,
  confidence: exampleProblem.confidence,
  entityContext: exampleProblem.metadata?.entityContext,
}, null, 2));
console.log("\nExample Capability Recommendation:");
console.log(JSON.stringify({
  id: exampleMatch.id,
  problemId: exampleMatch.problemId,
  matcherVersion: exampleMatch.matcherVersion,
  topRecommendations: exampleMatch.recommendedCapabilities.slice(0, 3),
  rejectedCount: exampleMatch.rejectedCapabilities.length,
  compositionPlan: exampleMatch.compositionPlan,
  explainability: {
    selectedCount: exampleMatch.explainability.selected.length,
    rejectedCount: exampleMatch.explainability.rejected.length,
    constraintSummary: exampleMatch.explainability.constraintSummary,
  },
}, null, 2));
