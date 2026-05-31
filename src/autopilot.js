import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";
import { executeLeadGenerationRun } from "./lead-generation-runs.js";

export const AUTOPILOT_CONFIG_FILE = join(DATA_DIR, "autopilot.json");
export const AUTOPILOT_RUNS_FILE = join(DATA_DIR, "autopilot-runs.json");

const FREQUENCIES = {
  once_now: 0,
  every_30_minutes: 30 * 60 * 1000,
  hourly: 60 * 60 * 1000,
  every_2_hours: 2 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

const DEFAULT_CONFIG = {
  enabled: false,
  niches: [],
  cities: [],
  maxResults: 5,
  runFrequency: "hourly",
  minScore: 10,
  excludeChains: true,
  requirePhone: false,
  requireWeakOrMissingWebsite: true,
  autoGeneratePreviews: true,
  autoPrepareAssets: true,
  autoRenderScreenshots: true,
  requireApprovalBeforeOutreach: true,
  maxRunsPerDay: 8,
  maxLeadsPerDay: 50,
  maxPreviewsPerDay: 20,
  repeatedErrorLimit: 3,
  errorCooldownMinutes: 60,
  cursor: { nicheIndex: 0, cityIndex: 0 },
  nextRunAt: null,
  lastRunAt: null,
  pausedAt: null,
  updatedAt: null,
};

let running = false;
let timer = null;

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeList(value) {
  const rows = Array.isArray(value) ? value : String(value ?? "").split(/[\n,]/);
  return [...new Set(rows.map(cleanText).filter(Boolean))];
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeConfig(input = {}) {
  const runFrequency = FREQUENCIES[cleanText(input.runFrequency)] === undefined
    ? DEFAULT_CONFIG.runFrequency
    : cleanText(input.runFrequency);
  const config = {
    ...DEFAULT_CONFIG,
    ...input,
    enabled: Boolean(input.enabled),
    niches: normalizeList(input.niches),
    cities: normalizeList(input.cities),
    maxResults: clampNumber(input.maxResults, DEFAULT_CONFIG.maxResults, 1, 50),
    runFrequency,
    minScore: clampNumber(input.minScore, DEFAULT_CONFIG.minScore, 0, 100),
    excludeChains: input.excludeChains === undefined ? true : Boolean(input.excludeChains),
    requirePhone: Boolean(input.requirePhone),
    requireWeakOrMissingWebsite: input.requireWeakOrMissingWebsite === undefined
      ? true
      : Boolean(input.requireWeakOrMissingWebsite),
    autoGeneratePreviews: Boolean(input.autoGeneratePreviews),
    autoPrepareAssets: Boolean(input.autoPrepareAssets),
    autoRenderScreenshots: Boolean(input.autoRenderScreenshots),
    requireApprovalBeforeOutreach: input.requireApprovalBeforeOutreach === undefined
      ? true
      : Boolean(input.requireApprovalBeforeOutreach),
    maxRunsPerDay: clampNumber(input.maxRunsPerDay, DEFAULT_CONFIG.maxRunsPerDay, 1, 100),
    maxLeadsPerDay: clampNumber(input.maxLeadsPerDay, DEFAULT_CONFIG.maxLeadsPerDay, 1, 500),
    maxPreviewsPerDay: clampNumber(input.maxPreviewsPerDay, DEFAULT_CONFIG.maxPreviewsPerDay, 0, 500),
    repeatedErrorLimit: clampNumber(input.repeatedErrorLimit, DEFAULT_CONFIG.repeatedErrorLimit, 1, 10),
    errorCooldownMinutes: clampNumber(input.errorCooldownMinutes, DEFAULT_CONFIG.errorCooldownMinutes, 5, 1440),
    cursor: {
      nicheIndex: clampNumber(input.cursor?.nicheIndex, 0, 0, 100000),
      cityIndex: clampNumber(input.cursor?.cityIndex, 0, 0, 100000),
    },
    nextRunAt: input.nextRunAt ?? null,
    lastRunAt: input.lastRunAt ?? null,
    pausedAt: input.pausedAt ?? null,
    updatedAt: input.updatedAt ?? null,
  };
  return config;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

export async function readAutopilotConfig() {
  return normalizeConfig(await readJson(AUTOPILOT_CONFIG_FILE, DEFAULT_CONFIG));
}

async function writeAutopilotConfig(config) {
  await writeJsonFileSafe(AUTOPILOT_CONFIG_FILE, normalizeConfig(config));
}

export async function patchAutopilotConfig(patch) {
  const current = await readAutopilotConfig();
  const next = normalizeConfig({
    ...current,
    ...patch,
    cursor: patch.cursor ? patch.cursor : current.cursor,
    updatedAt: new Date().toISOString(),
  });
  if (next.enabled && !next.nextRunAt) {
    next.nextRunAt = new Date().toISOString();
  }
  if (!next.enabled) {
    next.pausedAt = next.pausedAt ?? new Date().toISOString();
  } else {
    next.pausedAt = null;
  }
  await writeAutopilotConfig(next);
  return next;
}

export async function listAutopilotRuns({ limit = 100 } = {}) {
  const runs = await readJson(AUTOPILOT_RUNS_FILE, []);
  return (Array.isArray(runs) ? runs : [])
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
    .slice(0, Math.max(1, Math.min(500, Number(limit) || 100)));
}

async function appendAutopilotRun(row) {
  const runs = await readJson(AUTOPILOT_RUNS_FILE, []);
  runs.push(row);
  await writeJsonFileSafe(AUTOPILOT_RUNS_FILE, runs.slice(-500));
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= startOfToday();
}

function todayStats(runs) {
  const today = runs.filter((run) => isToday(run.startedAt));
  return {
    runs: today.length,
    leads: today.reduce((sum, run) => sum + (Number(run.qualified) || 0), 0),
    previews: today.reduce((sum, run) => sum + (Number(run.previewsGenerated) || 0), 0),
    errors: today.flatMap((run) => run.errors ?? []),
  };
}

function consecutiveFailures(runs) {
  let count = 0;
  for (const run of runs) {
    if (run.status === "completed") break;
    if (run.status === "failed") count += 1;
  }
  return count;
}

function cooldownUntil(config, runs) {
  const failures = consecutiveFailures(runs);
  if (failures < config.repeatedErrorLimit) return null;
  const latestFailure = runs.find((run) => run.status === "failed");
  if (!latestFailure?.completedAt && !latestFailure?.startedAt) return null;
  const base = new Date(latestFailure.completedAt ?? latestFailure.startedAt);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + config.errorCooldownMinutes * 60 * 1000).toISOString();
}

function computeNextRunAt(config, from = new Date()) {
  const ms = FREQUENCIES[config.runFrequency] ?? FREQUENCIES.hourly;
  if (config.runFrequency === "once_now") return null;
  return new Date(from.getTime() + ms).toISOString();
}

function chooseCombo(config) {
  if (!config.niches.length) throw new Error("Autopilot needs at least one niche.");
  if (!config.cities.length) throw new Error("Autopilot needs at least one city.");
  const nicheIndex = config.cursor.nicheIndex % config.niches.length;
  const cityIndex = config.cursor.cityIndex % config.cities.length;
  const niche = config.niches[nicheIndex];
  const city = config.cities[cityIndex];
  let nextCityIndex = cityIndex + 1;
  let nextNicheIndex = nicheIndex;
  if (nextCityIndex >= config.cities.length) {
    nextCityIndex = 0;
    nextNicheIndex = (nicheIndex + 1) % config.niches.length;
  }
  return {
    niche,
    city,
    nextCursor: { nicheIndex: nextNicheIndex, cityIndex: nextCityIndex },
  };
}

function parseCityState(value) {
  const [city, state] = cleanText(value).split(",").map(cleanText);
  return {
    city: city || cleanText(value),
    state: state || "",
  };
}

function buildLeadGenerationConfig(config, combo, runId) {
  const { city, state } = parseCityState(combo.city);
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  return {
    runTitle: `Autopilot: ${combo.niche} in ${combo.city} - ${stamp}`,
    searchTerm: combo.niche,
    city,
    state,
    maxResults: config.maxResults,
    runMode: config.autoGeneratePreviews ? "full_preview_package" : "research_score_enrich",
    filters: {
      minScore: config.minScore,
      mustHavePhone: config.requirePhone,
      websiteStatus: config.requireWeakOrMissingWebsite ? "weak_or_missing" : "any",
      excludeDuplicates: true,
      excludeChains: config.excludeChains,
    },
    opportunitySignals: {},
    outreachReadiness: {
      hasPhone: config.requirePhone,
      enoughPublicInfoForPersonalization: true,
      enoughInfoForPreview: config.autoGeneratePreviews,
    },
    previewSettings: {
      autoGeneratePreview: config.autoGeneratePreviews,
      autoPrepareAssets: config.autoPrepareAssets,
      autoRenderScreenshots: config.autoRenderScreenshots,
      useAIImagesWhenRealImagesLowConfidence: true,
      requireApprovalBeforeOutreach: true,
    },
    autopilot: {
      runId,
      requireManualApprovalBeforeOutreach: true,
    },
  };
}

function enforceDailyLimits(config, stats) {
  if (stats.runs >= config.maxRunsPerDay) throw new Error(`Autopilot daily run cap reached (${stats.runs}/${config.maxRunsPerDay}).`);
  if (stats.leads >= config.maxLeadsPerDay) throw new Error(`Autopilot daily lead cap reached (${stats.leads}/${config.maxLeadsPerDay}).`);
  if (config.autoGeneratePreviews && stats.previews >= config.maxPreviewsPerDay) {
    throw new Error(`Autopilot daily preview cap reached (${stats.previews}/${config.maxPreviewsPerDay}).`);
  }
}

export async function runAutopilotNow({ source = "manual", ignoreDisabled = true } = {}) {
  if (running) throw new Error("Autopilot run already in progress.");
  running = true;
  const runId = `autopilot_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const startedAt = new Date().toISOString();
  let config = await readAutopilotConfig();
  const runs = await listAutopilotRuns({ limit: 500 });
  const combo = { niche: null, city: null, nextCursor: config.cursor };
  const errors = [];

  try {
    if (!ignoreDisabled && !config.enabled) throw new Error("Autopilot is disabled.");
    const blockedUntil = cooldownUntil(config, runs);
    if (blockedUntil && new Date(blockedUntil) > new Date()) {
      throw new Error(`Autopilot is cooling down after repeated errors until ${blockedUntil}.`);
    }
    enforceDailyLimits(config, todayStats(runs));
    Object.assign(combo, chooseCombo(config));
    const leadConfig = buildLeadGenerationConfig(config, combo, runId);
    const progress = [];
    const result = await executeLeadGenerationRun(leadConfig, (entry) => progress.push(entry), {
      runId,
    });
    const completedAt = new Date().toISOString();
    const row = {
      id: runId,
      title: leadConfig.runTitle,
      source,
      startedAt,
      completedAt,
      niche: combo.niche,
      city: combo.city,
      status: result.status === "failed" ? "failed" : "completed",
      totalDiscovered: result.summary.discovered,
      qualified: result.summary.qualified,
      rejected: result.summary.rejected,
      previewsGenerated: result.summary.previewsGenerated,
      assetsPrepared: result.summary.assetsPrepared,
      screenshotsRendered: result.summary.screenshotsRendered,
      errors: result.logs.filter((entry) => entry.error).map((entry) => entry.error),
      qualifiedLeadIds: result.qualifiedLeads.map((lead) => lead.id).filter(Boolean),
      qualifiedLeads: result.qualifiedLeads,
      rejectedLeads: result.rejectedLeads,
      targetLeadGroupId: result.targetLeadGroup?.id ?? runId,
      logs: progress.slice(-200),
    };
    await appendAutopilotRun(row);
    config = await readAutopilotConfig();
    await writeAutopilotConfig({
      ...config,
      cursor: combo.nextCursor,
      lastRunAt: completedAt,
      nextRunAt: config.runFrequency === "once_now" ? null : computeNextRunAt(config, new Date()),
      enabled: config.runFrequency === "once_now" ? false : config.enabled,
      pausedAt: config.runFrequency === "once_now" ? completedAt : config.pausedAt,
      updatedAt: completedAt,
    });
    return row;
  } catch (err) {
    const completedAt = new Date().toISOString();
    errors.push(err.message);
    const row = {
      id: runId,
      title: combo.niche ? `Autopilot: ${combo.niche} in ${combo.city}` : "Autopilot run failed before discovery",
      source,
      startedAt,
      completedAt,
      niche: combo.niche,
      city: combo.city,
      status: "failed",
      totalDiscovered: 0,
      qualified: 0,
      rejected: 0,
      previewsGenerated: 0,
      errors,
      qualifiedLeadIds: [],
      qualifiedLeads: [],
      rejectedLeads: [],
      logs: [{ at: completedAt, step: "failed", message: err.message, error: err.message }],
    };
    await appendAutopilotRun(row);
    config = await readAutopilotConfig();
    await writeAutopilotConfig({
      ...config,
      lastRunAt: completedAt,
      nextRunAt: computeNextRunAt(config, new Date()),
      updatedAt: completedAt,
    });
    throw err;
  } finally {
    running = false;
  }
}

export async function pauseAutopilot() {
  return patchAutopilotConfig({ enabled: false, pausedAt: new Date().toISOString() });
}

export async function resumeAutopilot() {
  return patchAutopilotConfig({ enabled: true, pausedAt: null, nextRunAt: new Date().toISOString() });
}

export async function getAutopilotStatus() {
  const [config, runs] = await Promise.all([
    readAutopilotConfig(),
    listAutopilotRuns({ limit: 500 }),
  ]);
  const stats = todayStats(runs);
  const blockedUntil = cooldownUntil(config, runs);
  return {
    enabled: config.enabled,
    running,
    lastRun: runs[0] ?? null,
    nextRunAt: config.enabled ? config.nextRunAt : null,
    cooldownUntil: blockedUntil && new Date(blockedUntil) > new Date() ? blockedUntil : null,
    opportunitiesFoundToday: stats.leads,
    previewsGeneratedToday: stats.previews,
    runsToday: stats.runs,
    errorsToday: stats.errors,
    warnings: [
      !config.niches.length ? "No niches configured." : null,
      !config.cities.length ? "No cities configured." : null,
      stats.runs >= config.maxRunsPerDay ? "Daily run cap reached." : null,
      stats.leads >= config.maxLeadsPerDay ? "Daily lead cap reached." : null,
      stats.previews >= config.maxPreviewsPerDay ? "Daily preview cap reached." : null,
    ].filter(Boolean),
    config,
  };
}

export async function maybeRunScheduledAutopilot() {
  const status = await getAutopilotStatus();
  if (!status.enabled || status.running || status.cooldownUntil) return null;
  if (!status.nextRunAt) return null;
  if (new Date(status.nextRunAt) > new Date()) return null;
  try {
    return await runAutopilotNow({ source: "scheduled", ignoreDisabled: false });
  } catch {
    return null;
  }
}

export function startAutopilotWorker({ intervalMs = 60 * 1000, onError = console.error } = {}) {
  if (timer) return;
  timer = setInterval(() => {
    maybeRunScheduledAutopilot().catch(onError);
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
}

export async function buildOpportunityInbox(leads) {
  const runs = await listAutopilotRuns({ limit: 200 });
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const opportunityById = new Map();
  const rejectedByFilter = [];
  const errors = [];

  for (const run of runs) {
    for (const id of run.qualifiedLeadIds ?? []) {
      if (opportunityById.has(id)) continue;
      const lead = leadById.get(id);
      if (!lead) continue;
      opportunityById.set(id, {
        ...lead,
        sourceRunId: run.id,
        sourceRunTitle: run.title,
        sourceRunStartedAt: run.startedAt,
        sourceNiche: run.niche,
        sourceCity: run.city,
      });
    }
    for (const item of run.rejectedLeads ?? []) {
      rejectedByFilter.push({
        ...item,
        sourceRunId: run.id,
        sourceRunTitle: run.title,
        sourceNiche: run.niche,
        sourceCity: run.city,
      });
    }
    if (run.status === "failed" || (run.errors ?? []).length) {
      errors.push({
        id: run.id,
        title: run.title,
        startedAt: run.startedAt,
        errors: run.errors ?? [],
        status: run.status,
      });
    }
  }

  const items = [...opportunityById.values()];
  return {
    generatedAt: new Date().toISOString(),
    sections: {
      newOpportunities: items.filter((lead) => lead.previewStatus === "not_generated" && lead.status !== "SKIP"),
      previewReady: items.filter((lead) => ["generated", "assets_ready", "rendered", "approved"].includes(lead.previewStatus)),
      needsReview: items.filter((lead) => ["generated", "assets_ready", "rendered"].includes(lead.previewStatus)),
      highPriority: items.filter((lead) => lead.outreachPriority === "High Priority"),
      rejectedByFilter: rejectedByFilter.slice(0, 100),
      errors: errors.slice(0, 50),
    },
  };
}
