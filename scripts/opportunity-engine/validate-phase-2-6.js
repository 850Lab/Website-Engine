import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  initializeHypothesisStore,
  listHypotheses,
  getHypothesis,
  getHypothesisStorePath,
  clearHypothesisStoreForTests,
} from "../../src/engine/hypotheses/index.js";
import {
  initializeProblemStore,
  listProblems,
  getProblem,
  getProblemStorePath,
  clearProblemStoreForTests,
} from "../../src/engine/problems/index.js";
import { generateHypothesesFromSituation } from "../../src/engine/hypothesis-generator/index.js";
import { collectEvidenceForHypothesis } from "../../src/engine/evidence-engine/index.js";
import { calculateHypothesisConfidence } from "../../src/engine/confidence-engine/index.js";
import { findContradictions } from "../../src/engine/contradictions/index.js";
import { inferProblems } from "../../src/engine/problem-inference/index.js";
import { buildGraphFromFactsAndPersist, buildSituationsFromGraph } from "../../src/engine/knowledge-graph/index.js";
import { processSignalIntoFacts } from "../../src/engine/fact-builder/pipeline.js";
import { ingestManualObservation } from "../../src/engine/signals/ingest-manual.js";
import { getRuntimePath } from "../../src/engine/runtime/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
let exampleSituation = null;
let exampleHypothesis = null;
let exampleContradiction = null;
let exampleProblem = null;

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
    "src/engine/hypotheses/index.js",
    "src/engine/hypothesis-generator/index.js",
    "src/engine/evidence-engine/index.js",
    "src/engine/confidence-engine/index.js",
    "src/engine/contradictions/index.js",
    "src/engine/problems/index.js",
    "src/engine/problem-inference/index.js",
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

if (!(await fileExists(getRuntimePath("hypotheses", ".gitkeep")))) {
  fail("runtime/hypotheses missing");
} else {
  pass("Hypothesis store directory exists");
}

if (!(await fileExists(getRuntimePath("problems", ".gitkeep")))) {
  fail("runtime/problems missing");
} else {
  pass("Problem store directory exists");
}

await initializeHypothesisStore();
await initializeProblemStore();
pass("Hypothesis and problem stores load");

const uniqueSuffix = randomUUID().slice(0, 8);
const ingestResult = await ingestManualObservation({
  source: "phase_2_6_validation",
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
const situationResult = await buildSituationsFromGraph();
exampleSituation = situationResult.situations[0];

if (!exampleSituation) {
  fail("No situation available for inference");
} else {
  pass("Situation available for inference");
}

const drafts = await generateHypothesesFromSituation(exampleSituation.id);
if (!drafts.length || !drafts[0].originatingSituationIds.includes(exampleSituation.id)) {
  fail("Hypotheses not generated from situation");
} else {
  pass("Hypotheses generated from situations");
}

const inferenceResult = await inferProblems({ situationId: exampleSituation.id });
exampleHypothesis = inferenceResult.hypotheses.find(
  (row) => row.metadata?.polarity === "positive",
);
exampleContradiction = inferenceResult.contradictions[0];
exampleProblem = inferenceResult.promoted[0];

if (!(await fileExists(getHypothesisStorePath()))) {
  fail("runtime/hypotheses/hypotheses.json missing");
} else {
  pass("Hypothesis store persisted");
}

if (!(await fileExists(getProblemStorePath()))) {
  fail("runtime/problems/problems.json missing");
} else {
  pass("Problem store persisted");
}

if (!inferenceResult.hypotheses.length) {
  fail("No hypotheses persisted");
} else {
  pass("Hypotheses stored");
}

const positive = inferenceResult.hypotheses.find((row) => row.metadata?.polarity === "positive");
if (!positive?.confidenceBreakdown?.situationConfidence) {
  fail("Confidence not propagated with breakdown");
} else {
  pass("Confidence propagated");
}

if (!inferenceResult.contradictions.length) {
  fail("Contradictions not detected for expansion pair");
} else {
  pass("Contradictions detected");
}

if (!exampleProblem) {
  fail("No problem promoted");
} else {
  pass("Problems promoted through hypotheses");
}

if (!exampleProblem.supportingHypothesisIds?.length) {
  fail("Problem missing supportingHypothesisIds");
} else {
  pass("Problems reference hypotheses");
}

const directProblemAttempt = inferenceResult.problems.every((problem) =>
  problem.supportingHypothesisIds?.length,
);
if (!directProblemAttempt) {
  fail("Problem exists without hypothesis reference");
} else {
  pass("No direct situation-to-problem bypass");
}

const explainability = exampleProblem.explainability;
if (
  !explainability?.why ||
  !explainability?.situations?.length ||
  !explainability?.facts?.length ||
  !explainability?.signals?.length ||
  explainability?.missingEvidence == null
) {
  fail("Explainability bundle incomplete");
} else {
  pass("Explainability complete");
}

if (await fileExists(join(ROOT, "src/engine/capability-matcher"))) {
  fail("Capability matcher module created");
} else {
  pass("No capability matching");
}

if (await fileExists(join(ROOT, "src/engine/opportunity-factory"))) {
  fail("Opportunity factory module created");
} else {
  pass("No opportunity factory");
}

const homeSource = await readFile(join(ROOT, "src/pivotal-os/pages/home.js"), "utf8");
if (
  homeSource.includes("problem-inference") ||
  homeSource.includes("inferProblems")
) {
  fail("Mission Control modified");
} else {
  pass("Mission Control unchanged");
}

await assertNoLlmOrNetwork();

const afterGit = await runGit(["status", "--porcelain"]);
const afterLines = afterGit ? afterGit.split("\n").filter(Boolean) : [];
const runtimeTrackedChanges = afterLines.filter((line) => {
  const path = line.slice(2).trimStart();
  if (path === "runtime/" || path === "runtime") return false;
  if (path.endsWith(".gitkeep")) return false;
  return path.startsWith("runtime/");
});

if (runtimeTrackedChanges.length) {
  fail(`Runtime reasoning dirty git: ${runtimeTrackedChanges.join(", ")}`);
} else {
  pass("Runtime git clean");
}

if (afterLines.some((line) => line.includes("engine-data/"))) {
  fail("engine-data writes detected");
} else {
  pass("No engine-data writes");
}

const evidence = await collectEvidenceForHypothesis(await getHypothesis(exampleHypothesis.id));
const confidence = calculateHypothesisConfidence(exampleHypothesis, evidence, {
  contradictions: inferenceResult.contradictions.filter((row) =>
    row.hypothesisIds.includes(exampleHypothesis.id),
  ),
});
if (typeof confidence.confidence !== "number" || !confidence.confidenceBreakdown.final) {
  fail("Confidence engine recalculation failed");
} else {
  pass("Confidence engine traceable");
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-2-5-5.js")], {
    cwd: ROOT,
  });
  pass("Phase 2.5.5 regression passes");
} catch (error) {
  fail(`Phase 2.5.5 regression failed: ${error.message}`);
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-2-5.js")], {
    cwd: ROOT,
  });
  pass("Phase 2.5 regression passes");
} catch (error) {
  fail(`Phase 2.5 regression failed: ${error.message}`);
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-2-4.js")], {
    cwd: ROOT,
  });
  pass("Phase 2.4 regression passes");
} catch (error) {
  fail(`Phase 2.4 regression failed: ${error.message}`);
}

if (errors.length) {
  console.error(`\nPhase 2.6 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 2.6 validation passed.");
console.log("\nExample Situation:");
console.log(JSON.stringify({
  id: exampleSituation.id,
  title: exampleSituation.title,
  category: exampleSituation.category,
  confidence: exampleSituation.confidence,
}, null, 2));
console.log("\nExample Hypothesis:");
console.log(JSON.stringify({
  id: exampleHypothesis.id,
  title: exampleHypothesis.title,
  status: exampleHypothesis.status,
  confidence: exampleHypothesis.confidence,
  confidenceBreakdown: exampleHypothesis.confidenceBreakdown,
}, null, 2));
console.log("\nExample contradiction:");
console.log(JSON.stringify(exampleContradiction, null, 2));
console.log("\nExample promoted Problem:");
console.log(JSON.stringify({
  id: exampleProblem.id,
  title: exampleProblem.title,
  confidence: exampleProblem.confidence,
  supportingHypothesisIds: exampleProblem.supportingHypothesisIds,
  explainability: {
    why: exampleProblem.explainability.why,
    supports: exampleProblem.explainability.supports,
    contradicts: exampleProblem.explainability.contradicts,
  },
}, null, 2));
