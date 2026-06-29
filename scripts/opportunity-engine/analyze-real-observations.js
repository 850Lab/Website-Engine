import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { clearFactStoreForTests } from "../../src/engine/facts/index.js";
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
import {
  clearSignalStoreForTests,
  listSignals,
} from "../../src/engine/signals/index.js";
import { getRuntimeInboxObservationsDirectory } from "../../src/engine/runtime/index.js";
import { listOpportunities } from "../../src/engine/opportunities/index.js";
import { listProblems } from "../../src/engine/problems/index.js";
import { listCapabilityMatches } from "../../src/engine/capability-matches/index.js";
import { listOfferRecommendations } from "../../src/engine/offer-recommendations/index.js";
import { listHypotheses } from "../../src/engine/hypotheses/index.js";
import { listSituations } from "../../src/engine/situations/index.js";
import { runLivePipeline, clearInboxForRun } from "./run-live-pipeline.js";

const ROOT = join(import.meta.dirname, "../..");
const inbox = getRuntimeInboxObservationsDirectory();

const fixtures = [
  {
    id: "expansion-company-news-json",
    ext: ".json",
    content: {
      source: "file_drop",
      sourceType: "file",
      signalType: "company_news",
      headline: "ABC Manufacturing announces expansion in Beaumont",
      summary: "ABC Manufacturing announced a $40M Beaumont expansion.",
      location: { city: "Beaumont", state: "TX", country: "US" },
    },
  },
  {
    id: "maintenance-terminal-txt",
    ext: ".txt",
    content: "Port Arthur terminal maintenance window\nScheduled maintenance on the Port Arthur terminal next week.",
  },
  {
    id: "turnaround-refinery-md",
    ext: ".md",
    content: "# Refinery turnaround notice\n\nTurnaround activity expected at the Beaumont refinery.",
  },
  {
    id: "invalid-json",
    ext: ".json",
    content: "{ not valid json",
    expectSensorError: true,
  },
  {
    id: "engine-expansion-houston",
    ext: ".json",
    content: {
      source: "manual",
      sourceType: "file",
      signalType: "expansion",
      headline: "Warehouse expansion announced in Houston",
      summary: "Warehouse expansion announced.",
      location: { city: "Houston", state: "TX", country: "US" },
      rawText: "Warehouse expansion announced.",
    },
  },
  {
    id: "engine-company-news-beaumont",
    ext: ".json",
    content: {
      source: "manual",
      sourceType: "file",
      signalType: "company_news",
      headline: "ABC Manufacturing announces new facility in Beaumont with $40M investment",
      summary: "ABC Manufacturing announces new facility in Beaumont with $40M investment.",
      location: { city: "Beaumont", state: "TX", country: "US" },
      url: "https://example.com/news/abc-manufacturing",
      rawText: "ABC Manufacturing announces new facility in Beaumont with $40M investment.",
    },
  },
  {
    id: "sparse-unknown-text",
    ext: ".txt",
    content: "Activity noted in the region.",
    expectAbstain: true,
  },
  {
    id: "live-pipeline-demo",
    useDemo: true,
  },
];

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

function dedupeBlocked(report, errorMessage) {
  const errors = [
    ...(report?.sensor?.errors || []),
    errorMessage || "",
  ].join(" ");
  return /Duplicate signal detected/i.test(errors);
}

async function buildResult(fixture, inboxFile, report, errorMessage) {
  const signals = await listSignals();
  const situations = await listSituations();
  const hypos = await listHypotheses();
  const probs = await listProblems();
  const matches = await listCapabilityMatches();
  const offers = await listOfferRecommendations();
  const opps = await listOpportunities();
  const events = report?.correlationId
    ? await listEvents({ correlationId: report.correlationId })
    : [];
  const abstainedEvents = events.filter((row) => row.type === "opportunity.abstained");

  return {
    id: fixture.id,
    inboxFile,
    success: report?.success,
    summary: report?.summary,
    durationMs: report?.durationMs,
    dedupeBlocked: dedupeBlocked(report, errorMessage),
    abstained: abstainedEvents.length > 0,
    abstention: abstainedEvents.at(-1)?.payload || null,
    sensor: report?.sensor,
    signal: signals.at(-1)
      ? {
          type: signals.at(-1).signalType,
          headline: signals.at(-1).headline,
          location: signals.at(-1).location,
          classificationMethod: signals.at(-1).provenance?.classificationMethod,
        }
      : null,
    situation: situations.at(-1)
      ? { category: situations.at(-1).category, title: situations.at(-1).title }
      : null,
    hypotheses: hypos.map((h) => ({
      title: h.title,
      polarity: h.metadata?.polarity,
      status: h.status,
      confidence: h.confidence,
    })),
    problems: probs.map((p) => ({
      title: p.title,
      category: p.category,
      confidence: p.confidence,
    })),
    capabilityMatch: matches.at(-1)
      ? {
          recommended: (matches.at(-1).recommendedCapabilities || [])
            .slice(0, 3)
            .map((c) => ({ name: c.capabilityName, fitScore: c.fitScore })),
        }
      : null,
    offer: offers.at(-1)
      ? {
          recommended: (offers.at(-1).recommendedOffers || [])
            .slice(0, 2)
            .map((x) => ({ offerId: x.offerId, name: x.offerName, fitScore: x.offerFitScore })),
        }
      : null,
    opportunities: opps.map((o) => ({
      title: o.title,
      confidence: o.confidence,
      offerId: o.metadata?.offerId,
    })),
    falsePositiveNotes: [],
  };
}

async function runFixture(fixture) {
  await resetStores();
  await clearInboxForRun();

  if (fixture.useDemo) {
    try {
      const report = await runLivePipeline({ writeReports: false });
      const result = await buildResult(fixture, "demo-template", report);
      return result;
    } catch (error) {
      return { id: fixture.id, success: false, error: error.message, dedupeBlocked: dedupeBlocked(null, error.message) };
    }
  }

  const runId = randomUUID().slice(0, 8);
  const outName = `real-${fixture.id}-${runId}${fixture.ext}`;
  const body =
    typeof fixture.content === "string"
      ? fixture.content
      : `${JSON.stringify(fixture.content, null, 2)}\n`;
  await writeFile(join(inbox, outName), body, "utf8");

  try {
    const report = await runLivePipeline({ mode: "inbox", clearInbox: false, writeReports: false });
    return buildResult(fixture, outName, report);
  } catch (error) {
    return {
      id: fixture.id,
      inboxFile: outName,
      success: false,
      expectSensorError: fixture.expectSensorError === true,
      expectAbstain: fixture.expectAbstain === true,
      dedupeBlocked: dedupeBlocked(null, error.message),
      error: error.message,
    };
  }
}

function buildMarkdown(summary) {
  const lines = [
    "# Real Observations Analysis",
    "",
    `Run at: ${summary.runAt}`,
    "",
    "## Summary",
    "",
    `- Fixtures: ${summary.totalFixtures}`,
    `- Opportunities produced (fixtures with ≥1 opp): ${summary.opportunitiesProduced}`,
    `- Total opportunities: ${summary.totalOpportunities}`,
    `- Abstentions: ${summary.abstentionCount}`,
    `- Dedupe blocks: ${summary.dedupeBlockCount}`,
    `- Pipeline successes: ${summary.pipelineSuccesses}`,
    `- Pipeline failures: ${summary.pipelineFailures}`,
    "",
    "## Results",
    "",
  ];

  for (const row of summary.results) {
    lines.push(`### ${row.id}`);
    lines.push("");
    lines.push(`- Signal: ${row.signal?.type || "none"} (${row.signal?.headline || "n/a"})`);
    lines.push(`- Situation: ${row.situation?.category || "none"}`);
    lines.push(`- Problems: ${(row.problems || []).map((p) => `${p.category} (${p.confidence})`).join(", ") || "none"}`);
    lines.push(
      `- Capabilities: ${(row.capabilityMatch?.recommended || []).map((c) => `${c.name} (${c.fitScore})`).join(", ") || "none"}`,
    );
    lines.push(
      `- Offers: ${(row.offer?.recommended || []).map((o) => `${o.offerId} (${o.fitScore})`).join(", ") || "none"}`,
    );
    lines.push(`- Opportunities: ${row.opportunities?.length || 0}`);
    lines.push(`- Abstained: ${row.abstained ? row.abstention?.reason || "yes" : "no"}`);
    lines.push(`- Dedupe blocked: ${row.dedupeBlocked ? "yes" : "no"}`);
    if (row.falsePositiveNotes?.length) {
      lines.push(`- False positive notes: ${row.falsePositiveNotes.join("; ")}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

const results = [];
for (const fixture of fixtures) {
  results.push(await runFixture(fixture));
}

for (const row of results) {
  if (row.id === "engine-company-news-beaumont" && row.problems?.some((p) => p.category === "capital_project_services_demand")) {
    row.falsePositiveNotes.push("Generic Capital Project problem category on expansion news");
  }
  if (row.capabilityMatch?.recommended?.[0]?.name === "Maintenance Support" && row.situation?.category === "Expansion") {
    row.falsePositiveNotes.push("Maintenance Support ranked above labor on expansion signal");
  }
}

const summary = {
  runAt: new Date().toISOString(),
  phase: "4.0",
  totalFixtures: fixtures.length,
  opportunitiesProduced: results.filter((r) => r.opportunities?.length).length,
  totalOpportunities: results.reduce((n, r) => n + (r.opportunities?.length || 0), 0),
  abstentionCount: results.filter((r) => r.abstained).length,
  dedupeBlockCount: results.filter((r) => r.dedupeBlocked).length,
  pipelineSuccesses: results.filter((r) => r.success).length,
  pipelineFailures: results.filter((r) => !r.success).length,
  classificationResults: results.map((r) => ({
    id: r.id,
    signalType: r.signal?.type || null,
    method: r.signal?.classificationMethod || null,
  })),
  results,
};

await mkdir(join(ROOT, "reports"), { recursive: true });
await writeFile(
  join(ROOT, "reports/real-observations-analysis.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);
await writeFile(join(ROOT, "reports/real-observations-analysis.md"), buildMarkdown(summary), "utf8");
console.log(JSON.stringify(summary, null, 2));
