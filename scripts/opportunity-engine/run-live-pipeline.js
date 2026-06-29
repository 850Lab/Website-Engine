import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { appendEvent, initializeEventStore, listEvents } from "../../src/engine/events/index.js";
import { initializeJobStore, listJobs } from "../../src/engine/jobs/index.js";
import { orchestrateEvent } from "../../src/engine/orchestrator/index.js";
import { PIPELINE_EVENT_ROUTES } from "../../src/engine/orchestrator/registry.js";
import { processNextJob } from "../../src/engine/processor/index.js";
import { runFileDropSensor } from "../../src/engine/sensors/index.js";
import {
  ensureDirectory,
  getRuntimeInboxObservationsDirectory,
  getRuntimeInboxProcessedDirectory,
} from "../../src/engine/runtime/index.js";
import { listFacts } from "../../src/engine/facts/index.js";
import { listGraphEdges, listGraphNodes } from "../../src/engine/graph-store/index.js";
import { listHypotheses } from "../../src/engine/hypotheses/index.js";
import { listProblems } from "../../src/engine/problems/index.js";
import { listCapabilityMatches } from "../../src/engine/capability-matches/index.js";
import { listOfferRecommendations } from "../../src/engine/offer-recommendations/index.js";
import { listOpportunities } from "../../src/engine/opportunities/index.js";
import { listSignals } from "../../src/engine/signals/index.js";
import { listSituations } from "../../src/engine/situations/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const REPORT_MD_PATH = join(ROOT, "reports/live-pipeline.md");
export const REPORT_JSON_PATH = join(ROOT, "reports/live-pipeline.json");

export const ORCHESTRATABLE_EVENT_TYPES = Object.freeze(Object.keys(PIPELINE_EVENT_ROUTES));

export const DEMO_OBSERVATION_TEMPLATE = Object.freeze({
  source: "file_drop",
  sourceType: "file",
  signalType: "expansion",
  summary:
    "ABC Manufacturing announced a major facility expansion investment in Beaumont, TX.",
  location: { city: "Beaumont", state: "TX", country: "US" },
  affectedMarkets: ["industrial_construction"],
  affectedCapabilities: ["site_services"],
  entitiesMentioned: ["ABC Manufacturing"],
  urgency: "high",
});

function nowIso() {
  return new Date().toISOString();
}

function buildDemoObservationContent(runId) {
  const headline = `ABC Manufacturing announces $40M facility expansion in Beaumont (${runId})`;
  return {
    ...DEMO_OBSERVATION_TEMPLATE,
    headline,
    rawText: `${headline}. ${DEMO_OBSERVATION_TEMPLATE.summary}`,
  };
}


export async function clearInboxForRun(options = {}) {
  const inboxDir = options.inboxDir || getRuntimeInboxObservationsDirectory();
  const processedDir = getRuntimeInboxProcessedDirectory();

  await ensureDirectory(inboxDir);
  const entries = await readdir(inboxDir).catch(() => []);
  for (const entry of entries) {
    if (entry === "processed" || entry === ".gitkeep") continue;
    await rm(join(inboxDir, entry), { force: true });
  }

  await rm(processedDir, { recursive: true, force: true }).catch(() => {});
  await ensureDirectory(processedDir);
}

export async function dropDemoObservation(options = {}) {
  const runId = options.runId || randomUUID().slice(0, 8);
  const inboxDir = options.inboxDir || getRuntimeInboxObservationsDirectory();
  await clearInboxForRun({ inboxDir });

  const fileName = options.fileName || `live-pipeline-${runId}.json`;
  const content = buildDemoObservationContent(runId);
  const absolutePath = join(inboxDir, fileName);

  await writeFile(absolutePath, `${JSON.stringify(content, null, 2)}\n`, "utf8");

  return {
    runId,
    fileName,
    absolutePath,
    content,
  };
}

export async function emitSignalCreatedEvent(signalId, options = {}) {
  return appendEvent({
    type: "signal.created",
    subjectType: "signal",
    subjectId: signalId,
    payload: {
      signalId,
      subjectType: "signal",
      subjectId: signalId,
    },
    correlationId: options.correlationId,
    causationId: options.causationId ?? null,
  });
}

export async function orchestratePendingEvents(correlationId, orchestratedIds = new Set()) {
  const events = await listEvents({ correlationId });
  let orchestrated = 0;

  for (const event of events) {
    if (!ORCHESTRATABLE_EVENT_TYPES.includes(event.type)) continue;
    if (orchestratedIds.has(event.id)) continue;
    await orchestrateEvent(event, { correlationId });
    orchestratedIds.add(event.id);
    orchestrated += 1;
  }

  return orchestrated;
}

export async function countRunnableJobs(now = new Date()) {
  const pending = await listJobs({ status: "pending" });
  const retryable = await listJobs({ status: "retry_wait" });
  return [...pending, ...retryable].filter((job) => {
    if (!job.runAfter) return true;
    return new Date(job.runAfter).getTime() <= now.getTime();
  }).length;
}

export async function drainJobQueue(options = {}) {
  const correlationId = options.correlationId;
  const orchestratedIds = options.orchestratedIds || new Set();
  const maxIterations = options.maxIterations || 100;
  const processed = [];

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    await orchestratePendingEvents(correlationId, orchestratedIds);

    const runnableBefore = await countRunnableJobs();
    if (runnableBefore === 0) {
      await orchestratePendingEvents(correlationId, orchestratedIds);
      const runnableAfter = await countRunnableJobs();
      if (runnableAfter === 0) {
        return { processed, iterations: iteration + 1, idle: true };
      }
    }

    const result = await processNextJob({ correlationId });
    if (result.status === "idle") {
      await orchestratePendingEvents(correlationId, orchestratedIds);
      if ((await countRunnableJobs()) === 0) {
        return { processed, iterations: iteration + 1, idle: true };
      }
      continue;
    }

    processed.push({
      iteration,
      jobId: result.jobId,
      handler: result.handler,
      jobStatus: result.jobStatus,
    });

    await orchestratePendingEvents(correlationId, orchestratedIds);
  }

  return { processed, iterations: maxIterations, idle: false };
}

async function snapshotPipelineObjects(baseline = {}) {
  return {
    signals: (await listSignals()).length - (baseline.signals || 0),
    facts: (await listFacts()).length - (baseline.facts || 0),
    graphNodes: (await listGraphNodes()).length - (baseline.graphNodes || 0),
    graphEdges: (await listGraphEdges()).length - (baseline.graphEdges || 0),
    situations: (await listSituations()).length - (baseline.situations || 0),
    hypotheses: (await listHypotheses()).length - (baseline.hypotheses || 0),
    problems: (await listProblems()).length - (baseline.problems || 0),
    capabilityMatches: (await listCapabilityMatches()).length - (baseline.capabilityMatches || 0),
    offerRecommendations:
      (await listOfferRecommendations()).length - (baseline.offerRecommendations || 0),
    opportunities: (await listOpportunities()).length - (baseline.opportunities || 0),
  };
}

async function snapshotBaseline() {
  return {
    signals: (await listSignals()).length,
    facts: (await listFacts()).length,
    graphNodes: (await listGraphNodes()).length,
    graphEdges: (await listGraphEdges()).length,
    situations: (await listSituations()).length,
    hypotheses: (await listHypotheses()).length,
    problems: (await listProblems()).length,
    capabilityMatches: (await listCapabilityMatches()).length,
    offerRecommendations: (await listOfferRecommendations()).length,
    opportunities: (await listOpportunities()).length,
  };
}

function summarizeJobs(jobs) {
  const byStatus = {};
  const byType = {};
  for (const job of jobs) {
    byStatus[job.status] = (byStatus[job.status] || 0) + 1;
    byType[job.type] = (byType[job.type] || 0) + 1;
  }
  return {
    total: jobs.length,
    byStatus,
    byType,
    completed: jobs.filter((row) => row.status === "completed").length,
    pending: jobs.filter((row) => row.status === "pending").length,
    failed: jobs.filter((row) => ["dead_letter", "failed"].includes(row.status)).length,
  };
}

function summarizeEvents(events) {
  const byType = {};
  for (const event of events) {
    byType[event.type] = (byType[event.type] || 0) + 1;
  }
  return {
    total: events.length,
    byType,
  };
}

function buildMarkdownReport(report) {
  const lines = [
    "# Live Pipeline Run",
    "",
    `- **Started:** ${report.startedAt}`,
    `- **Completed:** ${report.completedAt}`,
    `- **Duration:** ${report.durationMs}ms`,
    `- **Correlation ID:** \`${report.correlationId}\``,
    `- **Run ID:** \`${report.runId}\``,
    `- **Idle:** ${report.idle ? "yes" : "no"}`,
    "",
    "## Summary",
    "",
    report.summary,
    "",
    "## Objects Created",
    "",
    ...Object.entries(report.objectsCreated).map(([key, value]) => `- **${key}:** ${value}`),
    "",
    "## Jobs",
    "",
    `- Total: ${report.jobs.total}`,
    `- Completed: ${report.jobs.completed}`,
    `- Pending: ${report.jobs.pending}`,
    `- Failed: ${report.jobs.failed}`,
    "",
    "## Opportunity IDs",
    "",
    ...(report.opportunityIds.length
      ? report.opportunityIds.map((id) => `- \`${id}\``)
      : ["- _none_"]),
    "",
    "## Events Emitted",
    "",
    ...Object.entries(report.events.byType)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, count]) => `- \`${type}\`: ${count}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

export async function writeLivePipelineReports(report, options = {}) {
  const mdPath = options.markdownPath || REPORT_MD_PATH;
  const jsonPath = options.jsonPath || REPORT_JSON_PATH;
  await mkdir(dirname(mdPath), { recursive: true });
  await writeFile(mdPath, buildMarkdownReport(report), "utf8");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { markdownPath: mdPath, jsonPath };
}

export async function runLivePipeline(options = {}) {
  const startedAtMs = Date.now();
  const startedAt = nowIso();
  const correlationId = options.correlationId || `live_${randomUUID()}`;
  const orchestratedIds = new Set();

  await initializeEventStore();
  await initializeJobStore();

  const baseline = await snapshotBaseline();
  const mode = options.mode || "demo";
  let drop = null;

  if (mode === "demo") {
    drop = await dropDemoObservation({
      runId: options.runId,
      inboxDir: options.inboxDir,
      fileName: options.fileName,
    });
  } else if (options.clearInbox !== false) {
    await clearInboxForRun({ inboxDir: options.inboxDir });
  }

  const sensorResult = await runFileDropSensor(options.sensorOptions || {});

  if (!sensorResult.signalsCreated?.length) {
    throw new Error(
      `File drop sensor created no signals (errors: ${sensorResult.errors?.join("; ") || "none"})`,
    );
  }

  drop = drop || {
    runId: options.runId || randomUUID().slice(0, 8),
    fileName: sensorResult.filesProcessed?.[0]?.fileName || "inbox",
    content: { headline: sensorResult.signalsCreated[0] },
  };

  for (const signalId of sensorResult.signalsCreated) {
    const signalEvent = await emitSignalCreatedEvent(signalId, { correlationId });
    await orchestrateEvent(signalEvent, { correlationId });
    orchestratedIds.add(signalEvent.id);
  }

  const drainResult = await drainJobQueue({
    correlationId,
    orchestratedIds,
    maxIterations: options.maxIterations || 100,
  });

  const completedAt = nowIso();
  const durationMs = Date.now() - startedAtMs;
  const jobs = await listJobs();
  const events = await listEvents({ correlationId });
  const opportunities = await listOpportunities();
  const opportunityIds = opportunities.map((row) => row.id);
  const objectsCreated = await snapshotPipelineObjects(baseline);
  const pendingJobs = jobs.filter((row) => row.status === "pending").length;
  const retryJobs = jobs.filter((row) => row.status === "retry_wait").length;

  const report = {
    startedAt,
    completedAt,
    durationMs,
    correlationId,
    runId: drop.runId,
    fileName: drop.fileName,
    idle: drainResult.idle,
    summary:
      drainResult.idle && objectsCreated.opportunities > 0 && pendingJobs === 0 && retryJobs === 0
        ? "Live pipeline completed end-to-end with opportunity output."
        : "Live pipeline finished with incomplete queue or missing opportunity output.",
    sensor: {
      observationsFound: sensorResult.observationsFound,
      observationsIngested: sensorResult.observationsIngested,
      signalsCreated: sensorResult.signalsCreated,
      errors: sensorResult.errors || [],
    },
    observation: {
      fileName: drop.fileName,
      headline: drop.content.headline,
    },
    objectsCreated,
    jobs: summarizeJobs(jobs),
    jobsCreated: jobs.length,
    jobsCompleted: jobs.filter((row) => row.status === "completed").length,
    processorRuns: drainResult.processed,
    events: summarizeEvents(events),
    eventsEmitted: events.length,
    opportunityIds,
    pendingJobs,
    retryJobs,
    success:
      drainResult.idle &&
      objectsCreated.opportunities > 0 &&
      pendingJobs === 0 &&
      retryJobs === 0,
  };

  if (options.writeReports !== false) {
    await writeLivePipelineReports(report, options.reportPaths || {});
  }

  return report;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  try {
    const report = await runLivePipeline();
    console.log(`Live pipeline ${report.success ? "completed" : "finished incomplete"}.`);
    console.log(`Correlation ID: ${report.correlationId}`);
    console.log(`Duration: ${report.durationMs}ms`);
    console.log(`Reports: ${REPORT_MD_PATH}, ${REPORT_JSON_PATH}`);
    if (!report.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`Live pipeline failed: ${error.message}`);
    process.exit(1);
  }
}
