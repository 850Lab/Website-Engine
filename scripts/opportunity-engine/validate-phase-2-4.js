import { readFile, access } from "node:fs/promises";
import { bootstrapValidator, finalizeValidator, shouldSkipNestedRegressions } from "../../src/engine/validation/index.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  listFacts,
  getFactById,
  createFact,
  getFactsBySignalId,
  getFactsByPredicate,
  getFactSummary,
  initializeRuntimeFactStore,
  getFactStorePath,
} from "../../src/engine/facts/index.js";
import { buildFactsFromSignal } from "../../src/engine/fact-builder/index.js";
import { processSignalIntoFacts } from "../../src/engine/fact-builder/pipeline.js";
import {
  buildGraphProjectionFromFacts,
  getGraphSummary,
  mapFactToGraphRefs,
} from "../../src/engine/knowledge-graph/index.js";
import { ingestManualObservation } from "../../src/engine/signals/ingest-manual.js";
import { assertRuntimeDirectoryExists } from "./runtime-directory-assertions.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("2.4");
let exampleSignal = null;
let exampleFacts = [];
let exampleGraphSummary = null;

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
    "src/engine/facts/index.js",
    "src/engine/fact-builder/index.js",
    "src/engine/fact-builder/pipeline.js",
    "src/engine/knowledge-graph/index.js",
  ];
  const banned = [
    /\bfetch\s*\(/,
    /\bopenai\b/i,
    /\banthropic\b/i,
    /\bllm\b/i,
    /\bgpt-/i,
  ];
  for (const file of files) {
    const source = await readFile(join(ROOT, file), "utf8");
    for (const pattern of banned) {
      if (pattern.test(source)) {
        fail(`Banned pattern ${pattern} found in ${file}`);
      }
    }
  }
  if (!errors.some((message) => message.includes("Banned pattern"))) {
    pass("No LLM or external API usage in Phase 2.4 modules");
  }
}

const beforeGit = await runGit(["status", "--porcelain"]);
const beforeLines = beforeGit ? beforeGit.split("\n").filter(Boolean) : [];

try {
  await initializeRuntimeFactStore();
  pass("Facts module loads");
  await assertRuntimeDirectoryExists(fail, pass, "runtime/facts directory exists", "facts");
} catch (error) {
  fail(`Facts module failed to load: ${error.message}`);
}

const uniqueSuffix = randomUUID().slice(0, 8);
const ingestResult = await ingestManualObservation({
  source: "phase_2_4_validation",
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
  url: null,
  urgency: "high",
});

exampleSignal = ingestResult.signal;

if (ingestResult.signal.processingState !== "classified") {
  fail("Demo signal did not reach classified state");
} else {
  pass("Classified demo signal created");
}

const draftFacts = buildFactsFromSignal(ingestResult.signal);
if (!draftFacts.length) {
  fail("buildFactsFromSignal returned no facts");
} else {
  pass("Facts built from signal");
}

const pipelineResult = await processSignalIntoFacts(ingestResult.signal.id);
exampleFacts = pipelineResult.facts;

if (!pipelineResult.facts.length) {
  fail("processSignalIntoFacts did not create facts");
} else {
  pass("Facts stored via pipeline");
}

if (!(await fileExists(getFactStorePath()))) {
  fail("runtime/facts/facts.json was not created");
} else {
  pass("Facts persisted to runtime/facts/facts.json");
}

for (const fact of pipelineResult.facts) {
  if (!fact.signalIds?.includes(ingestResult.signal.id)) {
    fail(`Fact ${fact.id} missing signalId reference`);
  }
}
if (!errors.some((message) => message.includes("missing signalId"))) {
  pass("Each fact references signalId");
}

if (await fileExists(join(ROOT, "engine-data/facts/facts.json"))) {
  fail("engine-data facts file exists");
} else {
  pass("No engine-data facts file");
}

const projection = buildGraphProjectionFromFacts(pipelineResult.facts);
exampleGraphSummary = getGraphSummary(projection);

if (!projection.nodes.length || !projection.edges.length) {
  fail("Graph projection missing nodes or edges");
} else {
  pass("Graph projection builds nodes and edges");
}

if (!mapFactToGraphRefs(pipelineResult.facts[0]).length) {
  fail("mapFactToGraphRefs returned empty refs");
} else {
  pass("mapFactToGraphRefs works");
}

const updatedSignal = pipelineResult.signal;
if (updatedSignal?.problemIds?.length || updatedSignal?.opportunityIds?.length) {
  fail("Pipeline generated problems or opportunities on signal");
} else {
  pass("No opportunities or problems generated");
}

if (updatedSignal?.processingState === "problem_inferred") {
  fail("Signal processingState moved to problem_inferred");
} else {
  pass("Signal processingState unchanged beyond fact linking");
}

pass("Problem inference not invoked in Phase 2.4 run");

const homeSource = await readFile(join(ROOT, "src/pivotal-os/pages/home.js"), "utf8");
if (
  homeSource.includes("processSignalIntoFacts") ||
  homeSource.includes("fact-builder") ||
  homeSource.includes("knowledge-graph")
) {
  fail("Mission Control modified for fact builder");
} else {
  pass("Mission Control unchanged");
}

await assertNoLlmOrNetwork();

const listed = await listFacts();
const byId = await getFactById(pipelineResult.facts[0].id);
const bySignal = await getFactsBySignalId(ingestResult.signal.id);
const byPredicate = await getFactsByPredicate("has_signal_type");
const summary = await getFactSummary();

if (!listed.length || !byId || !bySignal.length || !byPredicate.length || !summary.total) {
  fail("Fact store query APIs failed");
} else {
  pass("Fact store query APIs work");
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
  pass("Git remains clean after runtime fact creation");
}

const engineDataFactsDirty = afterLines.some((line) => line.includes("engine-data/facts"));
if (engineDataFactsDirty) {
  fail("Git-tracked engine-data facts were modified");
} else {
  pass("Git-tracked engine-data untouched");
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/autopilot-status.js")], {
    cwd: ROOT,
  });
  pass("Autopilot status runs");
} catch (error) {
  fail(`Autopilot status failed: ${error.message}`);
}

await finalizeValidator({ phase: "2.4", errors, startedAt: __validationStartedAt });

console.log("\nPhase 2.4 validation passed.");
console.log("\nExample signal:");
console.log(JSON.stringify({
  id: exampleSignal.id,
  headline: exampleSignal.headline,
  signalType: exampleSignal.signalType,
  processingState: exampleSignal.processingState,
}, null, 2));
console.log("\nExample facts (first 3):");
console.log(JSON.stringify(exampleFacts.slice(0, 3).map((fact) => ({
  id: fact.id,
  predicate: fact.predicate,
  subjectLabel: fact.subjectLabel,
  object: fact.object,
  signalIds: fact.signalIds,
})), null, 2));
console.log("\nExample graph projection summary:");
console.log(JSON.stringify(exampleGraphSummary, null, 2));
