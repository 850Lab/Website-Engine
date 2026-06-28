import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { readGraphStore } from "../../src/engine/graph-store/index.js";
import { listSignals } from "../../src/engine/signals/index.js";
import { listFacts } from "../../src/engine/facts/index.js";
import { listSituations } from "../../src/engine/situations/index.js";
import { listHypotheses } from "../../src/engine/hypotheses/index.js";
import { listProblems } from "../../src/engine/problems/index.js";
import { listCapabilityMatches } from "../../src/engine/capability-matches/index.js";
import { listOfferRecommendations } from "../../src/engine/offer-recommendations/index.js";
import { listOpportunities } from "../../src/engine/opportunities/index.js";
import { buildGraphFromFactsAndPersist, buildSituationsFromGraph } from "../../src/engine/knowledge-graph/index.js";
import { processSignalIntoFacts } from "../../src/engine/fact-builder/pipeline.js";
import { ingestManualObservation } from "../../src/engine/signals/ingest-manual.js";
import { inferProblems } from "../../src/engine/problem-inference/index.js";
import { matchCapabilities } from "../../src/engine/capability-matcher/index.js";
import { recommendOffers } from "../../src/engine/offer-intelligence/index.js";
import { buildOpportunityForProblem } from "../../src/engine/opportunity-factory/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_MD = join(ROOT, "reports/performance-baseline.md");
const REPORT_JSON = join(ROOT, "reports/performance-baseline.json");

async function runPipeline() {
  const uniqueSuffix = randomUUID().slice(0, 8);
  const started = Date.now();

  const ingestResult = await ingestManualObservation({
    source: "performance_baseline",
    sourceType: "manual",
    observedAt: new Date().toISOString(),
    headline: `Baseline facility expansion signal (${uniqueSuffix})`,
    summary: "Performance baseline demo signal for full commercial intelligence pipeline.",
    originalText: `Baseline facility expansion signal (${uniqueSuffix})`,
    signalType: "expansion",
    location: { city: "Beaumont", state: "TX", country: "US" },
    affectedMarkets: ["industrial_construction"],
    affectedCapabilities: ["site_services"],
    entitiesMentioned: ["Baseline Manufacturing"],
    urgency: "high",
  });

  const factResult = await processSignalIntoFacts(ingestResult.signal.id);
  await buildGraphFromFactsAndPersist(factResult.facts);
  await buildSituationsFromGraph();
  const inferenceResult = await inferProblems();
  const problem = inferenceResult.promoted[0];
  if (!problem) {
    throw new Error("Performance baseline: no problem promoted");
  }

  const capabilityMatch = await matchCapabilities(problem);
  await recommendOffers(capabilityMatch);
  await buildOpportunityForProblem(problem.id);

  const graph = await readGraphStore();
  const metrics = {
    pipelineDurationMs: Date.now() - started,
    signalCount: (await listSignals()).length,
    factCount: (await listFacts()).length,
    graphNodeCount: graph.nodes.length,
    graphEdgeCount: graph.edges.length,
    situationCount: (await listSituations()).length,
    hypothesisCount: (await listHypotheses()).length,
    problemCount: (await listProblems()).length,
    capabilityMatchCount: (await listCapabilityMatches()).length,
    offerRecommendationCount: (await listOfferRecommendations()).length,
    opportunityCount: (await listOpportunities()).length,
  };

  return metrics;
}

const metrics = await runPipeline();

const summary = {
  generatedAt: new Date().toISOString(),
  ...metrics,
};

const markdown = `# Performance Baseline

Generated: ${summary.generatedAt}

## Pipeline

- **Full opportunity pipeline duration:** ${summary.pipelineDurationMs}ms

## Counts

| Metric | Count |
|---|---:|
| Signals | ${summary.signalCount} |
| Facts | ${summary.factCount} |
| Graph nodes | ${summary.graphNodeCount} |
| Graph edges | ${summary.graphEdgeCount} |
| Situations | ${summary.situationCount} |
| Hypotheses | ${summary.hypothesisCount} |
| Problems | ${summary.problemCount} |
| Capability matches | ${summary.capabilityMatchCount} |
| Offer recommendations | ${summary.offerRecommendationCount} |
| Opportunities | ${summary.opportunityCount} |
`;

await mkdir(dirname(REPORT_MD), { recursive: true });
await writeFile(REPORT_MD, markdown, "utf8");
await writeFile(REPORT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

console.log("Performance baseline");
console.log(`  Pipeline duration: ${summary.pipelineDurationMs}ms`);
console.log(`  Signals: ${summary.signalCount}`);
console.log(`  Facts: ${summary.factCount}`);
console.log(`  Graph nodes: ${summary.graphNodeCount}`);
console.log(`  Graph edges: ${summary.graphEdgeCount}`);
console.log(`  Situations: ${summary.situationCount}`);
console.log(`  Hypotheses: ${summary.hypothesisCount}`);
console.log(`  Problems: ${summary.problemCount}`);
console.log(`  Capability matches: ${summary.capabilityMatchCount}`);
console.log(`  Offer recommendations: ${summary.offerRecommendationCount}`);
console.log(`  Opportunities: ${summary.opportunityCount}`);
console.log(`  Report: reports/performance-baseline.md`);
