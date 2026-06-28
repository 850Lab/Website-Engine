import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  initializeGraphStore,
  listGraphEdges,
  listGraphNodes,
  readGraphStore,
  getPersistentGraphSummary,
  getGraphStorePath,
  clearGraphStoreForTests,
} from "../../src/engine/graph-store/index.js";
import {
  normalizeEntityLabel,
  resolveEntity,
  mergeEntityAliases,
  getEntityResolutionSummary,
} from "../../src/engine/entity-resolution/index.js";
import {
  buildRelationshipsFromFact,
  processFactsIntoRelationships,
} from "../../src/engine/relationship-builder/index.js";
import {
  buildGraphFromFactsAndPersist,
  getKnowledgeGraphSummary,
  findRelatedNodes,
  findRelationshipsByType,
  findEntityNeighborhood,
} from "../../src/engine/knowledge-graph/index.js";
import { processSignalIntoFacts } from "../../src/engine/fact-builder/pipeline.js";
import { ingestManualObservation } from "../../src/engine/signals/ingest-manual.js";
import { getRuntimePath } from "../../src/engine/runtime/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
let exampleFacts = [];
let exampleAliases = [];
let exampleRelationships = [];
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
    "src/engine/graph-store/index.js",
    "src/engine/entity-resolution/index.js",
    "src/engine/relationship-builder/index.js",
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
    pass("No LLM or external API usage in Phase 2.5 modules");
  }
}

await clearGraphStoreForTests();

if (!(await fileExists(getRuntimePath("graph", ".gitkeep")))) {
  fail("runtime/graph/.gitkeep missing");
} else {
  pass("runtime/graph exists");
}

try {
  await initializeGraphStore();
  pass("Graph store initializes");
} catch (error) {
  fail(`Graph store initialization failed: ${error.message}`);
}

const normalized = normalizeEntityLabel("ABC Manufacturing, Inc.");
if (normalized !== "abc manufacturing") {
  fail(`Entity label normalization failed: ${normalized}`);
} else {
  pass("Entity resolution normalizes labels");
}

const entity = await resolveEntity({
  label: "ABC Manufacturing, Inc.",
  sourceFactIds: [],
  sourceSignalIds: [],
});
const merged = await mergeEntityAliases(entity.id, ["ABC Mfg", "ABC Manufacturing Company"]);
exampleAliases = merged.aliases;

if (!merged.aliases.includes("ABC Mfg")) {
  fail("Entity alias merge failed");
} else {
  pass("Entity aliases work");
}

const aliasSummary = await getEntityResolutionSummary();
if (!aliasSummary.aliasCount) {
  fail("Entity resolution summary empty");
} else {
  pass("Entity resolution summary works");
}

const uniqueSuffix = randomUUID().slice(0, 8);
const ingestResult = await ingestManualObservation({
  source: "phase_2_5_validation",
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
exampleFacts = factResult.facts;

if (!exampleFacts.length) {
  fail("Demo facts were not created");
} else {
  pass("Demo facts available");
}

const built = await buildRelationshipsFromFact(exampleFacts[0]);
if (!built.edges.length || !built.nodes.length) {
  fail("buildRelationshipsFromFact returned empty graph fragments");
} else {
  pass("Relationships built from fact");
}

exampleRelationships = built.edges.slice(0, 3);

const persistResult = await buildGraphFromFactsAndPersist(exampleFacts);
exampleGraphSummary = await getKnowledgeGraphSummary();

if (!persistResult.nodeIds.length || !persistResult.edgeIds.length) {
  fail("Facts were not processed into persistent graph");
} else {
  pass("Facts processed into graph nodes and edges");
}

if (!(await fileExists(getGraphStorePath()))) {
  fail("Persistent graph store file missing");
} else {
  pass("Persistent graph store file created");
}

const edges = await listGraphEdges();
for (const edge of edges) {
  if (!edge.factIds?.length) {
    fail(`Graph edge missing factIds: ${edge.id}`);
  }
}
if (!errors.some((message) => message.includes("missing factIds"))) {
  pass("Every edge references factIds");
}

const graph = await readGraphStore();
if (!graph.relationshipEvents.length) {
  fail("Relationship events were not recorded");
} else {
  pass("Relationship events recorded");
}

const summary = await getPersistentGraphSummary();
if (!summary.nodeCount || !summary.edgeCount) {
  fail("Persistent graph summary empty");
} else {
  pass("Graph summary works");
}

const factNodeId = `fact:${exampleFacts[0].id}`;
const related = await findRelatedNodes(factNodeId);
if (!related.nodes.length || !related.edges.length) {
  fail("Related-node lookup failed");
} else {
  pass("Related-node lookup works");
}

const announcedEdges = await findRelationshipsByType("ANNOUNCED");
if (!announcedEdges.length) {
  fail("findRelationshipsByType failed for ANNOUNCED");
} else {
  pass("Relationship lookup by type works");
}

const neighborhood = await findEntityNeighborhood(entity.id, 1);
if (!neighborhood.nodes.length) {
  fail("Entity neighborhood lookup failed");
} else {
  pass("Entity neighborhood lookup works");
}

pass("Problem inference not invoked in Phase 2.5 run");

if (ingestResult.signal.problemIds?.length || ingestResult.signal.opportunityIds?.length) {
  fail("Problems or opportunities generated on signal");
} else {
  pass("No opportunities generated");
}

const homeSource = await readFile(join(ROOT, "src/pivotal-os/pages/home.js"), "utf8");
if (
  homeSource.includes("relationship-builder") ||
  homeSource.includes("entity-resolution") ||
  homeSource.includes("graph-store")
) {
  fail("Mission Control modified for graph enrichment");
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
  fail(`Graph writes dirty git: ${runtimeTrackedChanges.join(", ")}`);
} else {
  pass("Git remains clean after runtime graph writes");
}

if (await fileExists(join(ROOT, "engine-data/graph/graph.json"))) {
  fail("engine-data graph file exists");
} else {
  pass("No engine-data graph writes");
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
  console.error(`\nPhase 2.5 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 2.5 validation passed.");
console.log("\nExample facts processed:");
console.log(JSON.stringify(exampleFacts.slice(0, 2).map((fact) => ({
  id: fact.id,
  predicate: fact.predicate,
  object: fact.object,
})), null, 2));
console.log("\nExample entity aliases:");
console.log(JSON.stringify(exampleAliases.slice(0, 5), null, 2));
console.log("\nExample relationships:");
console.log(JSON.stringify(exampleRelationships.map((edge) => ({
  id: edge.id,
  type: edge.type,
  fromNodeId: edge.fromNodeId,
  toNodeId: edge.toNodeId,
  factIds: edge.factIds,
})), null, 2));
console.log("\nPersistent graph summary:");
console.log(JSON.stringify(exampleGraphSummary, null, 2));
