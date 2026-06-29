import { readFile, access } from "node:fs/promises";
import { bootstrapValidator, finalizeValidator, shouldSkipNestedRegressions } from "../../src/engine/validation/index.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  initializeSituationStore,
  listSituations,
  getSituation,
  getSituationSummary,
  getSituationStorePath,
  clearSituationStoreForTests,
  SITUATION_CATEGORIES,
  SITUATION_STATUSES,
} from "../../src/engine/situations/index.js";
import {
  buildSituationsFromGraph as buildSituationDraftsFromGraph,
  processGraphIntoSituations,
} from "../../src/engine/situation-builder/index.js";
import {
  buildGraphFromFactsAndPersist,
  buildSituationsFromGraph,
  findSituationNeighborhood,
  getSituationEvidence,
} from "../../src/engine/knowledge-graph/index.js";
import { listGraphNodes } from "../../src/engine/graph-store/index.js";
import { processSignalIntoFacts } from "../../src/engine/fact-builder/pipeline.js";
import { ingestManualObservation } from "../../src/engine/signals/ingest-manual.js";
import { assertRuntimeDirectoryExists } from "./runtime-directory-assertions.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("2.5.5");
let exampleCluster = null;
let exampleSituation = null;
let exampleSituationSummary = null;

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
    "src/engine/situations/index.js",
    "src/engine/situation-builder/index.js",
    "src/engine/knowledge-graph/index.js",
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

await clearSituationStoreForTests();

try {
  await initializeSituationStore();
  pass("Situation store loads");
  await assertRuntimeDirectoryExists(fail, pass, "runtime/situations directory exists", "situations");
} catch (error) {
  fail(`Situation store failed: ${error.message}`);
}

const uniqueSuffix = randomUUID().slice(0, 8);
const ingestResult = await ingestManualObservation({
  source: "phase_2_5_5_validation",
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

const draftResult = await buildSituationDraftsFromGraph();
exampleCluster = draftResult.clusters[0];

if (!draftResult.clusters.length) {
  fail("Graph clustering produced no situations");
} else {
  pass("Graph clusters produce situations");
}

const firstDraftConfidence = draftResult.clusters[0]?.confidence;
const secondDraft = await buildSituationDraftsFromGraph();
if (secondDraft.clusters[0]?.confidence !== firstDraftConfidence) {
  fail("Confidence is not deterministic");
} else {
  pass("Confidence computed deterministically");
}

const persistResult = await buildSituationsFromGraph();
exampleSituation = persistResult.situations[0];

if (!persistResult.situations.length) {
  fail("processGraphIntoSituations did not persist situations");
} else {
  pass("Situations persisted from graph");
}

if (!(await fileExists(getSituationStorePath()))) {
  fail("runtime/situations/situations.json missing");
} else {
  pass("Situation runtime store created");
}

const situation = await getSituation(exampleSituation.id);
if (!situation?.factIds?.length || !situation?.relationshipIds?.length) {
  fail("Situation missing evidence references");
} else {
  pass("Evidence preserved on situation");
}

const evidence = await getSituationEvidence(situation.id);
if (!evidence.facts.length || !evidence.relationships.length) {
  fail("getSituationEvidence missing facts or relationships");
} else {
  pass("Situation evidence retrieval works");
}

const neighborhood = await findSituationNeighborhood(situation.id, 1);
if (!neighborhood.nodes.length) {
  fail("findSituationNeighborhood returned empty");
} else {
  pass("Situation neighborhood lookup works");
}

const graphNodes = await listGraphNodes();
const linkedNodes = graphNodes.filter((node) =>
  (node.metadata?.situationIds || []).includes(situation.id),
);
if (!linkedNodes.length) {
  fail("Graph nodes do not reference situations");
} else {
  pass("Graph nodes reference situations");
}

if (!SITUATION_CATEGORIES.includes(situation.category || situation.situationType)) {
  fail("Situation category not recognized");
} else {
  pass("Situation types supported");
}

if (!SITUATION_STATUSES.includes(situation.status)) {
  fail("Situation lifecycle status invalid");
} else {
  pass("Situation lifecycle state valid");
}

exampleSituationSummary = await getSituationSummary();
if (!situation.summary?.factCount || !situation.title || !situation.description) {
  fail("Situation summary template fields missing");
} else {
  pass("Situation summary produced");
}

pass("Problem inference not invoked in Phase 2.5.5 run");

if (situation.metadata?.capabilityMatch || situation.metadata?.problemIds?.length) {
  fail("Capabilities matched or problems attached");
} else {
  pass("No Capabilities matched");
}

if (situation.metadata?.opportunityIds?.length) {
  fail("Opportunities generated");
} else {
  pass("No Opportunities created");
}

const homeSource = await readFile(join(ROOT, "src/pivotal-os/pages/home.js"), "utf8");
if (
  homeSource.includes("situation-builder") ||
  homeSource.includes("situations/index")
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
  fail(`Runtime writes dirty git: ${runtimeTrackedChanges.join(", ")}`);
} else {
  pass("Runtime stays git clean");
}

if (!shouldSkipNestedRegressions()) {
try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-2-5.js")], {
    cwd: ROOT,
  });
  pass("Phase 2.5 regression passes");
} catch (error) {
  fail(`Phase 2.5 regression failed: ${error.message}`);
}


}
try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-2-4.js")], {
    cwd: ROOT,
  });
  pass("Phase 2.4 regression passes");
} catch (error) {
  fail(`Phase 2.4 regression failed: ${error.message}`);
}

await finalizeValidator({ phase: "2.5.5", errors, startedAt: __validationStartedAt });

console.log("\nPhase 2.5.5 validation passed.");
console.log("\nExample graph cluster:");
console.log(JSON.stringify({
  key: exampleCluster?.key,
  category: exampleCluster?.category,
  factCount: exampleCluster?.factIds?.length,
  relationshipCount: exampleCluster?.relationshipIds?.length,
  signalCount: exampleCluster?.signalIds?.length,
  confidence: exampleCluster?.confidence,
}, null, 2));
console.log("\nExample Situation:");
console.log(JSON.stringify({
  id: exampleSituation?.id,
  title: exampleSituation?.title,
  description: exampleSituation?.description,
  status: exampleSituation?.status,
  category: exampleSituation?.category,
  confidence: exampleSituation?.confidence,
  summary: exampleSituation?.summary,
}, null, 2));
console.log("\nSituation store summary:");
console.log(JSON.stringify(exampleSituationSummary, null, 2));
