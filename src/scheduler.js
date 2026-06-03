import {
  appendOrchestrationLog,
  listOrchestratableWebsites,
  orchestrateWebsite,
} from "./orchestrator.js";
import { getAutomationConfig, updateAutomationConfig } from "./automation.js";

let schedulerTimer = null;

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function clampNumber(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

export async function runAutomationSchedulerOnce({
  dryRun,
  maxWebsites = 25,
  maxDepth = 1,
  requestedBy = "manual",
} = {}) {
  const config = await getAutomationConfig();
  const effectiveDryRun = dryRun ?? Boolean(config.dryRun || config.safety?.forceDryRun);
  const websites = await listOrchestratableWebsites();
  const limit = clampNumber(maxWebsites, 25, { min: 1, max: 500 });
  const selected = websites.slice(0, limit);
  const results = [];

  await appendOrchestrationLog({
    event: "scheduler_started",
    status: effectiveDryRun ? "dry_run" : "running",
    message: `Scheduler scan started for ${selected.length} Website(s).`,
    metadata: { requestedBy, maxWebsites: limit, maxDepth },
  });

  for (const website of selected) {
    const result = await orchestrateWebsite(website.websiteId, {
      dryRun: effectiveDryRun,
      executeCycles: !effectiveDryRun,
      maxDepth,
      requestedBy: `scheduler:${requestedBy}`,
    });
    results.push(result);
  }

  await appendOrchestrationLog({
    event: "scheduler_completed",
    status: "completed",
    message: `Scheduler scan completed for ${selected.length} Website(s).`,
    metadata: {
      requestedBy,
      dryRun: effectiveDryRun,
      results: results.map((result) => ({
        websiteId: result.websiteId,
        status: result.status,
      })),
      completedAt: nowIso(),
    },
  });

  return {
    dryRun: effectiveDryRun,
    websitesScanned: selected.length,
    results,
  };
}

export async function setSchedulerEnabled(enabled) {
  return updateAutomationConfig({ intervalEnabled: Boolean(enabled) });
}

export async function getSchedulerStatus() {
  const config = await getAutomationConfig();
  return {
    enabled: Boolean(config.intervalEnabled),
    runningInProcess: Boolean(schedulerTimer),
    dryRun: Boolean(config.dryRun || config.safety?.forceDryRun),
    manualRunOnly: Boolean(config.manualRunOnly),
  };
}

export async function maybeStartScheduler({ intervalMs = 60000, onError = console.error } = {}) {
  const config = await getAutomationConfig();
  if (!config.intervalEnabled || config.manualRunOnly) {
    await appendOrchestrationLog({
      event: "scheduler_startup_skipped",
      status: "disabled",
      message: "Automation scheduler did not start because intervalEnabled is false or manualRunOnly is true.",
      metadata: {
        intervalEnabled: Boolean(config.intervalEnabled),
        manualRunOnly: Boolean(config.manualRunOnly),
      },
    });
    return false;
  }
  if (schedulerTimer) return true;
  await appendOrchestrationLog({
    event: "scheduler_started",
    status: "running",
    message: `Automation scheduler started with ${intervalMs}ms interval.`,
    metadata: { intervalMs },
  });
  runAutomationSchedulerOnce({
    requestedBy: "startup",
    maxDepth: 1,
  }).catch(onError);
  schedulerTimer = setInterval(() => {
    runAutomationSchedulerOnce({
      requestedBy: "interval",
      maxDepth: 1,
    }).catch(onError);
  }, intervalMs);
  return true;
}

export async function stopScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = null;
  return getSchedulerStatus();
}

export function schedulerLabel(value) {
  return cleanText(value) || "manual";
}
