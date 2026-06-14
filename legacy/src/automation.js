import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";
import { enrichLead as enrichLeadFields } from "./enrich.js";
import { findLead, } from "./leads.js";
import {
  findLeadWithMeta,
  listLeadsWithMeta,
  updateLeadMissionControl,
} from "./mission-control.js";
import { generatePreviewSiteV3 } from "./preview-v3.js";
import { prepareAssetsForLead } from "./assets/asset-pipeline.js";
import { renderPreviewV3Screenshots } from "./render-preview-v3.js";
import { getClientOperationsView } from "./client-operations.js";
import {
  createRevenueRecordForLead,
  getRevenueRecord,
  listRevenueRecords,
  logRevenueReply,
  markRevenueLost,
  markRevenueWon,
  transitionRevenueStageIfEarlier,
} from "./revenue-pipeline.js";
import { listFulfillmentRecords } from "./fulfillment.js";
import {
  appendWebsiteEvent,
  buildWebsiteFactoryView,
  getWebsiteById,
} from "./website-factory.js";
import { recordWebsiteFactoryFailure, setWebsiteFactoryStatus } from "./website-state.js";
import { latestWebsiteQcRecord, runWebsiteQc } from "./qc.js";
import {
  deployStaticPreview,
  getDeploymentProviderStatus,
  latestDeploymentForWebsite,
  refreshDeploymentRecord,
  updateDeploymentRecord,
} from "./deployment.js";
import {
  approveAndQueueOutreach,
  createOutreachDraft,
  latestOutreachForWebsite,
  markOutreachSent,
} from "./outreach-queue.js";
import {
  createPlaceholderInboundReply,
  listInboundReplies,
  updateInboundReply,
} from "./reply-inbox.js";

export const AUTOMATION_CONFIG_FILE = join(DATA_DIR, "automation-config.json");
export const AUTOMATION_JOBS_FILE = join(DATA_DIR, "automation-jobs.json");
export const AUTOMATION_RUNS_FILE = join(DATA_DIR, "automation-runs.json");
export const AUTOMATION_LOGS_FILE = join(DATA_DIR, "automation-logs.json");

export const AUTOMATION_WORKER_TYPES = [
  "research_worker",
  "preview_worker",
  "asset_worker",
  "screenshot_worker",
  "qc_worker",
  "deployment_worker",
  "deployment_refresh_worker",
  "outreach_draft_worker",
  "outreach_approval_policy_worker",
  "outreach_sender_worker",
  "reply_capture_worker",
  "reply_classifier_worker",
  "revenue_close_worker",
];

export const AUTOMATION_JOB_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "retry_scheduled",
];

const STALE_RUNNING_JOB_MS = 10 * 60 * 1000;

const DEFAULT_STAGE_FLAGS = {
  research_worker: true,
  preview_worker: true,
  asset_worker: true,
  screenshot_worker: true,
  qc_worker: true,
  deployment_worker: true,
  deployment_refresh_worker: true,
  outreach_draft_worker: true,
  outreach_approval_policy_worker: true,
  outreach_sender_worker: true,
  reply_capture_worker: true,
  reply_classifier_worker: true,
  revenue_close_worker: true,
};

const DEFAULT_CONFIG = {
  version: 1,
  globalEnabled: true,
  dryRun: false,
  manualRunOnly: false,
  intervalEnabled: true,
  maxJobsPerCycle: 5,
  retryDefaults: {
    maxAttempts: 3,
    retryDelayMs: 300000,
  },
  stages: DEFAULT_STAGE_FLAGS,
  safety: {
    forceDryRun: false,
    allowFactoryStateWrites: true,
    allowPreviewGeneration: true,
    allowAssetPreparation: true,
    allowScreenshotRendering: true,
    allowQcExecution: true,
    allowDeployment: true,
    allowDeploymentRefresh: true,
    allowOutreachDraft: true,
    allowAutoOutreachApproval: true,
    allowSimulatedSend: true,
    allowReplyCapture: true,
    allowReplyClassification: true,
    allowAutoLostFromReply: false,
    allowRevenueReconciliation: true,
    allowOutreachSend: false,
    allowRevenueMutation: false,
    allowAutonomousEnqueue: true,
  },
  updatedAt: "",
};

const PREVIEWS_ROOT = join(DATA_DIR, "..", "previews-v3");

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

function recoveryEscalationLevel(attempts, maxAttempts) {
  if (attempts >= maxAttempts) return "human_review";
  if (attempts >= 2) return "watch";
  return "retry";
}

function clampWorkerType(workerType) {
  const clean = cleanText(workerType);
  if (!AUTOMATION_WORKER_TYPES.includes(clean)) {
    throw new Error(`Unsupported automation workerType: ${clean || "missing"}.`);
  }
  return clean;
}

function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeWorkerType(workerType) {
  const legacy = {
    research: "research_worker",
    preview_generation: "preview_worker",
    screenshot_capture: "screenshot_worker",
    qc: "qc_worker",
    deployment: "deployment_worker",
    outreach: "outreach_draft_worker",
    reply_capture: "reply_capture_worker",
    revenue_reconciliation: "revenue_close_worker",
  };
  const clean = cleanText(workerType);
  return legacy[clean] || clean;
}

function normalizeStageFlags(stages = {}) {
  const mapped = { ...DEFAULT_STAGE_FLAGS };
  for (const [key, value] of Object.entries(stages)) {
    const workerType = normalizeWorkerType(key);
    if (AUTOMATION_WORKER_TYPES.includes(workerType)) mapped[workerType] = Boolean(value);
  }
  return mapped;
}

function normalizeConfig(input = {}) {
  return {
    ...DEFAULT_CONFIG,
    version: 1,
    globalEnabled: normalizeBoolean(input.globalEnabled, DEFAULT_CONFIG.globalEnabled),
    dryRun: normalizeBoolean(input.dryRun, DEFAULT_CONFIG.dryRun),
    manualRunOnly: normalizeBoolean(input.manualRunOnly, DEFAULT_CONFIG.manualRunOnly),
    intervalEnabled: normalizeBoolean(input.intervalEnabled, DEFAULT_CONFIG.intervalEnabled),
    maxJobsPerCycle: clampNumber(input.maxJobsPerCycle, DEFAULT_CONFIG.maxJobsPerCycle, { min: 1, max: 100 }),
    retryDefaults: {
      maxAttempts: clampNumber(
        input.retryDefaults?.maxAttempts,
        DEFAULT_CONFIG.retryDefaults.maxAttempts,
        { min: 1, max: 20 }
      ),
      retryDelayMs: clampNumber(
        input.retryDefaults?.retryDelayMs,
        DEFAULT_CONFIG.retryDefaults.retryDelayMs,
        { min: 1000, max: 86400000 }
      ),
    },
    stages: normalizeStageFlags(input.stages),
    safety: {
      ...DEFAULT_CONFIG.safety,
      ...Object.fromEntries(
        Object.entries(input.safety ?? {}).filter(([, value]) => typeof value === "boolean")
      ),
      allowOutreachSend: false,
      allowRevenueMutation: false,
    },
    updatedAt: cleanText(input.updatedAt) || nowIso(),
  };
}

function normalizeJob(job = {}) {
  const createdAt = cleanText(job.createdAt) || nowIso();
  const workerType = clampWorkerType(normalizeWorkerType(job.workerType));
  const attempts = clampNumber(job.attempts, 0, { min: 0, max: 1000 });
  const maxAttempts = clampNumber(job.maxAttempts, DEFAULT_CONFIG.retryDefaults.maxAttempts, { min: 1, max: 1000 });
  return {
    jobId: cleanText(job.jobId) || `automation_job_${randomUUID()}`,
    websiteId: cleanText(job.websiteId),
    leadId: cleanText(job.leadId),
    workerType,
    status: AUTOMATION_JOB_STATUSES.includes(cleanText(job.status)) ? cleanText(job.status) : "queued",
    priority: clampNumber(job.priority, 50, { min: 0, max: 1000 }),
    attempts,
    maxAttempts,
    createdAt,
    updatedAt: cleanText(job.updatedAt) || createdAt,
    runAfter: cleanText(job.runAfter) || createdAt,
    lockedAt: cleanText(job.lockedAt),
    completedAt: cleanText(job.completedAt),
    failedAt: cleanText(job.failedAt),
    error: cleanText(job.error),
    input: job.input && typeof job.input === "object" ? job.input : {},
    output: job.output && typeof job.output === "object" ? job.output : {},
    dryRun: normalizeBoolean(job.dryRun, true),
  };
}

function normalizeRun(run = {}) {
  const startedAt = cleanText(run.startedAt) || nowIso();
  return {
    runId: cleanText(run.runId) || `automation_run_${randomUUID()}`,
    startedAt,
    completedAt: cleanText(run.completedAt),
    status: ["running", "completed", "failed"].includes(cleanText(run.status)) ? cleanText(run.status) : "running",
    dryRun: normalizeBoolean(run.dryRun, true),
    jobsScanned: clampNumber(run.jobsScanned, 0),
    jobsClaimed: clampNumber(run.jobsClaimed, 0),
    jobsCompleted: clampNumber(run.jobsCompleted, 0),
    jobsFailed: clampNumber(run.jobsFailed, 0),
    skipped: clampNumber(run.skipped, 0),
    errors: Array.isArray(run.errors) ? run.errors.map(cleanText).filter(Boolean) : [],
  };
}

function normalizeLog(log = {}) {
  const createdAt = cleanText(log.createdAt) || nowIso();
  return {
    logId: cleanText(log.logId) || `automation_log_${randomUUID()}`,
    jobId: cleanText(log.jobId),
    runId: cleanText(log.runId),
    websiteId: cleanText(log.websiteId),
    workerType: cleanText(log.workerType),
    event: cleanText(log.event) || "log",
    message: cleanText(log.message),
    metadata: log.metadata && typeof log.metadata === "object" ? log.metadata : {},
    createdAt,
  };
}

async function readJsonFile(filePath, fallback, normalizer) {
  try {
    return normalizer(JSON.parse(await readFile(filePath, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return normalizer(fallback);
    throw err;
  }
}

async function writeConfig(config) {
  const normalized = normalizeConfig(config);
  await writeJsonFileSafe(AUTOMATION_CONFIG_FILE, normalized);
  return normalized;
}

async function readJobsState() {
  return readJsonFile(AUTOMATION_JOBS_FILE, { version: 1, jobs: [] }, (input) => ({
    version: 1,
    jobs: Array.isArray(input.jobs) ? input.jobs.map(normalizeJob) : [],
  }));
}

async function writeJobsState(state) {
  const normalized = {
    version: 1,
    jobs: Array.isArray(state.jobs) ? state.jobs.map(normalizeJob) : [],
  };
  await writeJsonFileSafe(AUTOMATION_JOBS_FILE, normalized);
  return normalized;
}

async function readRunsState() {
  return readJsonFile(AUTOMATION_RUNS_FILE, { version: 1, runs: [] }, (input) => ({
    version: 1,
    runs: Array.isArray(input.runs) ? input.runs.map(normalizeRun) : [],
  }));
}

async function writeRunsState(state) {
  const normalized = {
    version: 1,
    runs: Array.isArray(state.runs) ? state.runs.map(normalizeRun) : [],
  };
  await writeJsonFileSafe(AUTOMATION_RUNS_FILE, normalized);
  return normalized;
}

async function readLogsState() {
  return readJsonFile(AUTOMATION_LOGS_FILE, { version: 1, logs: [] }, (input) => ({
    version: 1,
    logs: Array.isArray(input.logs) ? input.logs.map(normalizeLog) : [],
  }));
}

async function writeLogsState(state) {
  const normalized = {
    version: 1,
    logs: Array.isArray(state.logs) ? state.logs.map(normalizeLog).slice(-1000) : [],
  };
  await writeJsonFileSafe(AUTOMATION_LOGS_FILE, normalized);
  return normalized;
}

export async function getAutomationConfig() {
  try {
    return normalizeConfig(JSON.parse(await readFile(AUTOMATION_CONFIG_FILE, "utf8")));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    return writeConfig(DEFAULT_CONFIG);
  }
}

export async function updateAutomationConfig(patch = {}) {
  const current = await getAutomationConfig();
  return writeConfig({
    ...current,
    ...patch,
    retryDefaults: { ...current.retryDefaults, ...(patch.retryDefaults ?? {}) },
    stages: { ...current.stages, ...(patch.stages ?? {}) },
    safety: { ...current.safety, ...(patch.safety ?? {}) },
    updatedAt: nowIso(),
  });
}

export function listAutomationWorkers() {
  const implemented = new Set([
    "research_worker",
    "preview_worker",
    "asset_worker",
    "screenshot_worker",
    "qc_worker",
    "deployment_worker",
    "deployment_refresh_worker",
    "outreach_draft_worker",
    "outreach_approval_policy_worker",
    "outreach_sender_worker",
    "reply_capture_worker",
    "reply_classifier_worker",
    "revenue_close_worker",
  ]);
  const phase3 = new Set(["qc_worker", "deployment_worker", "deployment_refresh_worker"]);
  const phase4 = new Set(["outreach_draft_worker", "outreach_approval_policy_worker", "outreach_sender_worker"]);
  const phase5 = new Set(["reply_capture_worker", "reply_classifier_worker", "revenue_close_worker"]);
  return AUTOMATION_WORKER_TYPES.map((workerType) => ({
    workerType,
    phase: phase5.has(workerType) ? "phase_5_reply_revenue_chain" : phase4.has(workerType) ? "phase_4_outreach_chain" : phase3.has(workerType) ? "phase_3_qc_deployment_chain" : implemented.has(workerType) ? "phase_2_preview_chain" : "placeholder",
    sideEffects: implemented.has(workerType),
    dryRunOnly: !implemented.has(workerType),
    description: implemented.has(workerType)
      ? `${workerType.replace(/_/g, " ")}. Runs only when config and safety gates allow it.`
      : `Placeholder ${workerType.replace(/_/g, " ")} worker. No Phase 2 side effects.`,
  }));
}

export async function appendAutomationLog(log) {
  const state = await readLogsState();
  const next = normalizeLog(log);
  state.logs.push(next);
  await writeLogsState(state);
  return next;
}

export async function listAutomationLogs({ limit = 100 } = {}) {
  const state = await readLogsState();
  return state.logs
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, clampNumber(limit, 100, { min: 1, max: 500 }));
}

export async function listAutomationJobs({ limit = 100, status = "" } = {}) {
  const state = await readJobsState();
  return state.jobs
    .filter((job) => !status || job.status === status)
    .sort((a, b) => Number(b.priority) - Number(a.priority) || String(a.runAfter).localeCompare(String(b.runAfter)))
    .slice(0, clampNumber(limit, 100, { min: 1, max: 500 }));
}

export async function createAutomationJob(input = {}) {
  const config = await getAutomationConfig();
  const dryRun = config.safety.forceDryRun ? true : normalizeBoolean(input.dryRun, config.dryRun);
  const job = normalizeJob({
    ...input,
    maxAttempts: input.maxAttempts ?? config.retryDefaults.maxAttempts,
    dryRun,
  });
  if (!job.websiteId) throw new Error("websiteId is required for automation jobs.");
  const state = await readJobsState();
  const duplicate = state.jobs.find((item) =>
    item.websiteId === job.websiteId &&
    normalizeWorkerType(item.workerType) === job.workerType &&
    isActiveJobStatus(item.status)
  );
  if (duplicate && !input.allowDuplicate) {
    await appendAutomationLog({
      jobId: duplicate.jobId,
      websiteId: duplicate.websiteId,
      workerType: duplicate.workerType,
      event: "job_skipped",
      message: `Duplicate ${job.workerType} job was not created for this Website.`,
      metadata: { duplicateOf: duplicate.jobId },
    });
    return duplicate;
  }
  state.jobs.push(job);
  await writeJobsState(state);
  await appendAutomationLog({
    jobId: job.jobId,
    websiteId: job.websiteId,
    workerType: job.workerType,
    event: "job_created",
    message: `Created ${job.workerType} automation job${job.dryRun ? " in dry-run mode" : ""}.`,
    metadata: { priority: job.priority, runAfter: job.runAfter, dryRun: job.dryRun },
  });
  return job;
}

export async function listAutomationRuns({ limit = 50 } = {}) {
  const state = await readRunsState();
  return state.runs
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
    .slice(0, clampNumber(limit, 50, { min: 1, max: 500 }));
}

function isRunnableStatus(status) {
  return status === "queued" || status === "retry_scheduled";
}

function isActiveJobStatus(status) {
  return status === "queued" || status === "running" || status === "retry_scheduled";
}

function nextRetryAt(config) {
  return new Date(Date.now() + config.retryDefaults.retryDelayMs).toISOString();
}

function isStaleRunningJob(job, nowMs = Date.now()) {
  if (job.status !== "running" || !job.lockedAt) return false;
  const lockedAtMs = new Date(job.lockedAt).getTime();
  if (Number.isNaN(lockedAtMs)) return false;
  return nowMs - lockedAtMs > STALE_RUNNING_JOB_MS;
}

async function recoverStaleRunningJobs(jobsState) {
  const now = nowIso();
  const nowMs = Date.now();
  const recovered = [];
  jobsState.jobs = jobsState.jobs.map((job) => {
    if (!isStaleRunningJob(job, nowMs)) return job;
    const canRetry = job.attempts < job.maxAttempts;
    const next = normalizeJob({
      ...job,
      status: canRetry ? "retry_scheduled" : "failed",
      lockedAt: "",
      failedAt: now,
      runAfter: canRetry ? now : job.runAfter,
      error: "Recovered stale running job lock.",
      updatedAt: now,
    });
    recovered.push(next);
    return next;
  });
  if (!recovered.length) return jobsState;
  await writeJobsState(jobsState);
  for (const job of recovered) {
    await appendAutomationLog({
      jobId: job.jobId,
      websiteId: job.websiteId,
      workerType: job.workerType,
      event: "stale_job_recovered",
      message: `Recovered stale running ${job.workerType} job lock.`,
      metadata: { status: job.status, runAfter: job.runAfter },
    });
  }
  return jobsState;
}

async function buildAutomationWebsiteView() {
  const fulfillmentRecords = await listFulfillmentRecords();
  const [leads, revenueRecords, operations] = await Promise.all([
    listLeadsWithMeta(),
    listRevenueRecords(),
    getClientOperationsView({ fulfillmentRecords }),
  ]);
  return buildWebsiteFactoryView({
    leads,
    revenueRecords,
    fulfillmentRecords,
    operations,
  });
}

async function getAutomationWebsite(websiteId) {
  const view = await buildAutomationWebsiteView();
  const website = getWebsiteById(view, websiteId);
  if (!website) throw new Error("Website not found.");
  return website;
}

function previewChainPlanForWebsite(website) {
  const jobs = [];
  const leadId = website.mapping?.leadId || website.lead?.id || "";
  const factoryStatus = website.factoryStatus || website.currentStage;
  const researchApproved = Boolean(website.lead?.websiteResearchApprovedAt) || factoryStatus === "researched";
  const researchPending = ["discovered", "research_pending", "intake", "research"].includes(factoryStatus);

  if (leadId && researchPending && !researchApproved) {
    jobs.push({
      workerType: "research_worker",
      reason: "Website has a lead and research has not been approved or completed.",
      priority: 80,
    });
  }
  if (factoryStatus === "researched" && !website.preview?.previewExists) {
    jobs.push({
      workerType: "preview_worker",
      reason: "Website is researched and no generated preview exists.",
      priority: 70,
    });
  }
  if (website.preview?.previewExists && !website.preview?.assetsReady) {
    jobs.push({
      workerType: "asset_worker",
      reason: "Preview exists but assets are missing or not ready.",
      priority: 60,
    });
  }
  if (
    website.preview?.previewExists &&
    website.preview?.assetsReady &&
    (!website.preview?.desktopExists || !website.preview?.mobileExists)
  ) {
    jobs.push({
      workerType: "screenshot_worker",
      reason: "Preview and assets are ready, but desktop or mobile screenshots are missing.",
      priority: 50,
    });
  }
  return jobs.map((job) => ({
    ...job,
    websiteId: website.websiteId,
    leadId,
  }));
}

async function existingActiveJob(websiteId, workerType) {
  const state = await readJobsState();
  const normalizedWorkerType = normalizeWorkerType(workerType);
  return state.jobs.find((job) =>
    job.websiteId === websiteId &&
    normalizeWorkerType(job.workerType) === normalizedWorkerType &&
    isActiveJobStatus(job.status)
  ) ?? null;
}

export async function planPreviewChainJobs(websiteId) {
  const website = await getAutomationWebsite(websiteId);
  const planned = await Promise.all(
    previewChainPlanForWebsite(website).map(async (job) => ({
      ...job,
      duplicateJobId: (await existingActiveJob(job.websiteId, job.workerType))?.jobId || "",
    }))
  );
  return {
    websiteId: website.websiteId,
    businessName: website.businessName,
    factoryStatus: website.factoryStatus,
    preview: website.preview,
    planned,
  };
}

export async function enqueuePreviewChainJobs(websiteId, { dryRun = true } = {}) {
  const plan = await planPreviewChainJobs(websiteId);
  const created = [];
  const skipped = [];
  for (const job of plan.planned) {
    if (job.duplicateJobId) {
      skipped.push({ ...job, reason: `Duplicate active job exists: ${job.duplicateJobId}` });
      await appendAutomationLog({
        jobId: job.duplicateJobId,
        websiteId: job.websiteId,
        workerType: job.workerType,
        event: "job_skipped",
        message: `Preview-chain enqueue skipped duplicate ${job.workerType}.`,
        metadata: { reason: job.reason },
      });
      continue;
    }
    if (dryRun) {
      skipped.push({ ...job, reason: `Dry-run enqueue would create ${job.workerType}.` });
      await appendAutomationLog({
        websiteId: job.websiteId,
        workerType: job.workerType,
        event: "dry_run_result",
        message: `Dry-run enqueue would create ${job.workerType}.`,
        metadata: { reason: job.reason },
      });
      continue;
    }
    created.push(await createAutomationJob({
      websiteId: job.websiteId,
      leadId: job.leadId,
      workerType: job.workerType,
      priority: job.priority,
      input: { reason: job.reason, chain: "preview" },
      dryRun,
    }));
  }
  return { ...plan, dryRun, created, skipped };
}

function deterministicQcIsStale(website, qc) {
  if (!qc) return true;
  if (!qc.passed) return true;
  const statusUpdatedAt = website.factoryState?.statusUpdatedAt || website.lead?.previewRenderedAt || website.lead?.previewGeneratedAt || "";
  if (!statusUpdatedAt) return false;
  return String(qc.createdAt).localeCompare(String(statusUpdatedAt)) < 0;
}

async function qcDeploymentChainPlanForWebsite(website) {
  const jobs = [];
  const leadId = website.mapping?.leadId || website.lead?.id || "";
  const latestQc = website.qc || await latestWebsiteQcRecord(website.websiteId);
  const latestDeployment = website.deployment || await latestDeploymentForWebsite(website.websiteId);
  const readyDeployment = (website.deploymentHistory ?? []).find((record) => record.status === "ready" && record.deployedUrl && record.verifiedAt);

  if (
    website.factoryStatus === "preview_ready" &&
    website.preview?.previewExists &&
    website.preview?.desktopExists &&
    website.preview?.mobileExists &&
    deterministicQcIsStale(website, latestQc) &&
    website.lead?.qcStatus !== "rejected"
  ) {
    jobs.push({
      workerType: "qc_worker",
      reason: "Website is preview_ready with required preview artifacts and deterministic QC is missing, stale, or not passed.",
      priority: 80,
    });
  }

  if (
    website.factoryStatus === "qc_passed" &&
    latestQc?.passed === true &&
    !readyDeployment &&
    latestDeployment?.status !== "pending"
  ) {
    jobs.push({
      workerType: "deployment_worker",
      reason: "Deterministic QC passed and no verified ready deployment exists.",
      priority: 70,
    });
  }

  if (latestDeployment?.status === "pending" && latestDeployment.deploymentId) {
    jobs.push({
      workerType: "deployment_refresh_worker",
      reason: "Latest deployment is pending and has a provider deployment ID to refresh.",
      priority: 60,
      input: { deploymentRecordId: latestDeployment.deploymentRecordId },
    });
  }

  return jobs.map((job) => ({
    ...job,
    websiteId: website.websiteId,
    leadId,
  }));
}

export async function planQcDeploymentChainJobs(websiteId) {
  const website = await getAutomationWebsite(websiteId);
  const planned = await Promise.all(
    (await qcDeploymentChainPlanForWebsite(website)).map(async (job) => ({
      ...job,
      duplicateJobId: (await existingActiveJob(job.websiteId, job.workerType))?.jobId || "",
    }))
  );
  return {
    websiteId: website.websiteId,
    businessName: website.businessName,
    factoryStatus: website.factoryStatus,
    qc: website.qc,
    deployment: website.deployment,
    preview: website.preview,
    provider: getDeploymentProviderStatus(),
    planned,
  };
}

export async function enqueueQcDeploymentChainJobs(websiteId, { dryRun = true } = {}) {
  const plan = await planQcDeploymentChainJobs(websiteId);
  const created = [];
  const skipped = [];
  for (const job of plan.planned) {
    if (job.duplicateJobId) {
      skipped.push({ ...job, reason: `Duplicate active job exists: ${job.duplicateJobId}` });
      await appendAutomationLog({
        jobId: job.duplicateJobId,
        websiteId: job.websiteId,
        workerType: job.workerType,
        event: "job_skipped",
        message: `QC/deployment enqueue skipped duplicate ${job.workerType}.`,
        metadata: { reason: job.reason },
      });
      continue;
    }
    if (dryRun) {
      skipped.push({ ...job, reason: `Dry-run enqueue would create ${job.workerType}.` });
      await appendAutomationLog({
        websiteId: job.websiteId,
        workerType: job.workerType,
        event: "dry_run_result",
        message: `Dry-run enqueue would create ${job.workerType}.`,
        metadata: { reason: job.reason },
      });
      continue;
    }
    created.push(await createAutomationJob({
      websiteId: job.websiteId,
      leadId: job.leadId,
      workerType: job.workerType,
      priority: job.priority,
      input: { ...(job.input ?? {}), reason: job.reason, chain: "qc_deployment" },
      dryRun,
      maxAttempts: job.workerType === "deployment_refresh_worker" ? 5 : undefined,
    }));
  }
  return { ...plan, dryRun, created, skipped };
}

function latestVerifiedDeployment(website) {
  return (website.deploymentHistory ?? []).find((record) =>
    record.status === "ready" &&
    record.deployedUrl &&
    record.verifiedAt
  ) ?? null;
}

function isActiveOutreach(record = {}) {
  if (!record?.outreachId) return false;
  if (record.sendStatus === "sent" || record.sendStatus === "failed") return false;
  if (record.approvalStatus === "rejected") return false;
  return true;
}

function outreachPlanForWebsite(website) {
  const jobs = [];
  const leadId = website.mapping?.leadId || website.lead?.id || "";
  const verifiedDeployment = latestVerifiedDeployment(website);
  const latestOutreach = website.outreach ?? null;
  const activeOutreach = (website.outreachHistory ?? []).find(isActiveOutreach);

  if (
    website.factoryStatus === "deployed" &&
    verifiedDeployment &&
    !activeOutreach
  ) {
    jobs.push({
      workerType: "outreach_draft_worker",
      reason: "Website is deployed with a verified public URL and no active outreach draft exists.",
      priority: 70,
    });
  }

  if (
    latestOutreach?.sendStatus === "drafted" &&
    latestOutreach?.approvalStatus === "draft"
  ) {
    jobs.push({
      workerType: "outreach_approval_policy_worker",
      reason: "Latest outreach is drafted and has no approval decision.",
      priority: 60,
      input: { outreachId: latestOutreach.outreachId },
    });
  }

  if (
    latestOutreach?.sendStatus === "queued" &&
    latestOutreach?.approvalStatus === "approved"
  ) {
    jobs.push({
      workerType: "outreach_sender_worker",
      reason: "Latest outreach is approved and queued for safe simulated send.",
      priority: 50,
      input: { outreachId: latestOutreach.outreachId },
    });
  }

  return jobs.map((job) => ({
    ...job,
    websiteId: website.websiteId,
    leadId,
  }));
}

export async function planOutreachChainJobs(websiteId) {
  const website = await getAutomationWebsite(websiteId);
  const planned = await Promise.all(
    outreachPlanForWebsite(website).map(async (job) => ({
      ...job,
      duplicateJobId: (await existingActiveJob(job.websiteId, job.workerType))?.jobId || "",
    }))
  );
  return {
    websiteId: website.websiteId,
    businessName: website.businessName,
    factoryStatus: website.factoryStatus,
    deployment: website.deployment,
    verifiedDeployment: latestVerifiedDeployment(website),
    outreach: website.outreach,
    planned,
  };
}

export async function enqueueOutreachChainJobs(websiteId, { dryRun = true } = {}) {
  const plan = await planOutreachChainJobs(websiteId);
  const created = [];
  const skipped = [];
  for (const job of plan.planned) {
    if (job.duplicateJobId) {
      skipped.push({ ...job, reason: `Duplicate active job exists: ${job.duplicateJobId}` });
      await appendAutomationLog({
        jobId: job.duplicateJobId,
        websiteId: job.websiteId,
        workerType: job.workerType,
        event: "job_skipped",
        message: `Outreach enqueue skipped duplicate ${job.workerType}.`,
        metadata: { reason: job.reason },
      });
      continue;
    }
    if (dryRun) {
      skipped.push({ ...job, reason: `Dry-run enqueue would create ${job.workerType}.` });
      await appendAutomationLog({
        websiteId: job.websiteId,
        workerType: job.workerType,
        event: "dry_run_result",
        message: `Dry-run enqueue would create ${job.workerType}.`,
        metadata: { reason: job.reason },
      });
      continue;
    }
    created.push(await createAutomationJob({
      websiteId: job.websiteId,
      leadId: job.leadId,
      workerType: job.workerType,
      priority: job.priority,
      input: { ...(job.input ?? {}), reason: job.reason, chain: "outreach" },
      dryRun,
    }));
  }
  return { ...plan, dryRun, created, skipped };
}

function latestCapturedUnclassifiedReply(replies = []) {
  return replies.find((reply) => reply.status === "captured" && !reply.classification) ?? null;
}

function terminalMismatchPlan(website) {
  const revenue = website.revenue;
  const lead = website.lead;
  const desired = [];
  const acceptedProposal = (revenue?.proposals ?? []).some((proposal) => proposal.status === "accepted");
  const checkoutStarted = ["checkout_started", "checkout_completed", "won", "activated"].includes(revenue?.currentStage);
  const activated = revenue?.currentStage === "activated" || (revenue?.activationEvidence ?? []).length > 0;
  const manualWon = website.factoryStatus === "won" || lead?.dealStage === "won" || lead?.pipelineStage === "won";
  const manualLost = website.factoryStatus === "lost" || lead?.dealStage === "lost" || lead?.pipelineStage === "lost" || revenue?.currentStage === "lost";

  if (activated) desired.push("activated");
  else if (manualWon || acceptedProposal || checkoutStarted) desired.push("won");
  else if (manualLost) desired.push("lost");

  const target = desired[0] || "";
  if (!target) return null;
  const mismatches = [];
  if (website.factoryStatus !== target && !(target === "won" && website.factoryStatus === "outreach_sent")) mismatches.push(`Website state is ${website.factoryStatus}, expected ${target}.`);
  if (revenue?.currentStage !== target && !(target === "won" && ["checkout_started", "checkout_completed"].includes(revenue?.currentStage))) {
    mismatches.push(`Revenue stage is ${revenue?.currentStage || "missing"}, expected ${target}.`);
  }
  if (lead?.pipelineStage && lead.pipelineStage !== target && !(target === "won" && lead.pipelineStage === "checkout_started")) {
    mismatches.push(`Lead pipelineStage is ${lead.pipelineStage}, expected ${target}.`);
  }
  return mismatches.length ? { target, mismatches } : null;
}

async function replyRevenuePlanForWebsite(website) {
  const jobs = [];
  const leadId = website.mapping?.leadId || website.lead?.id || "";
  const replies = await listInboundReplies({ websiteId: website.websiteId });
  const latestOutreach = website.outreach ?? await latestOutreachForWebsite(website.websiteId);
  const pendingReply = replies.find((reply) => reply.status === "pending");
  const capturedUnclassified = latestCapturedUnclassifiedReply(replies);
  const reconciliation = terminalMismatchPlan(website);

  if (
    website.factoryStatus === "outreach_sent" &&
    latestOutreach?.sendStatus === "sent" &&
    (latestOutreach.providerMessageId || latestOutreach.provider) &&
    pendingReply
  ) {
    jobs.push({
      workerType: "reply_capture_worker",
      reason: "Website has sent outreach and a pending placeholder inbound reply exists.",
      priority: 70,
      input: { inboundReplyId: pendingReply.inboundReplyId },
    });
  }

  if (capturedUnclassified) {
    jobs.push({
      workerType: "reply_classifier_worker",
      reason: "Captured inbound reply exists and has not been classified.",
      priority: 60,
      input: { inboundReplyId: capturedUnclassified.inboundReplyId },
    });
  }

  if (reconciliation) {
    jobs.push({
      workerType: "revenue_close_worker",
      reason: `State mismatch requires ${reconciliation.target} reconciliation.`,
      priority: 50,
      input: { target: reconciliation.target, mismatches: reconciliation.mismatches },
    });
  }

  return jobs.map((job) => ({
    ...job,
    websiteId: website.websiteId,
    leadId,
  }));
}

export async function planReplyRevenueChainJobs(websiteId) {
  const website = await getAutomationWebsite(websiteId);
  const inboundReplies = await listInboundReplies({ websiteId });
  const planned = await Promise.all(
    (await replyRevenuePlanForWebsite(website)).map(async (job) => ({
      ...job,
      duplicateJobId: (await existingActiveJob(job.websiteId, job.workerType))?.jobId || "",
    }))
  );
  return {
    websiteId: website.websiteId,
    businessName: website.businessName,
    factoryStatus: website.factoryStatus,
    revenue: website.revenue,
    outreach: website.outreach,
    inboundReplies,
    planned,
  };
}

export async function enqueueReplyRevenueChainJobs(websiteId, { dryRun = true } = {}) {
  const plan = await planReplyRevenueChainJobs(websiteId);
  const created = [];
  const skipped = [];
  for (const job of plan.planned) {
    if (job.duplicateJobId) {
      skipped.push({ ...job, reason: `Duplicate active job exists: ${job.duplicateJobId}` });
      await appendAutomationLog({
        jobId: job.duplicateJobId,
        websiteId: job.websiteId,
        workerType: job.workerType,
        event: "job_skipped",
        message: `Reply/revenue enqueue skipped duplicate ${job.workerType}.`,
        metadata: { reason: job.reason },
      });
      continue;
    }
    if (dryRun) {
      skipped.push({ ...job, reason: `Dry-run enqueue would create ${job.workerType}.` });
      await appendAutomationLog({
        websiteId: job.websiteId,
        workerType: job.workerType,
        event: "dry_run_result",
        message: `Dry-run enqueue would create ${job.workerType}.`,
        metadata: { reason: job.reason },
      });
      continue;
    }
    created.push(await createAutomationJob({
      websiteId: job.websiteId,
      leadId: job.leadId,
      workerType: job.workerType,
      priority: job.priority,
      input: { ...(job.input ?? {}), reason: job.reason, chain: "reply_revenue" },
      dryRun,
    }));
  }
  return { ...plan, dryRun, created, skipped };
}

export async function createAutomationInboundReply(websiteId, input = {}) {
  const website = await getAutomationWebsite(websiteId);
  const latestOutreach = website.outreach ?? await latestOutreachForWebsite(websiteId);
  const revenue = website.revenue ?? (website.mapping?.leadId ? await getRevenueRecord({ leadId: website.mapping.leadId }) : null);
  return createPlaceholderInboundReply({
    websiteId,
    leadId: website.mapping?.leadId,
    outreachId: input.outreachId || latestOutreach?.outreachId,
    revenueId: input.revenueId || revenue?.revenueId,
    providerMessageId: input.providerMessageId || latestOutreach?.providerMessageId,
    from: input.from || latestOutreach?.to || website.lead?.email || website.lead?.phone || "",
    channel: input.channel || latestOutreach?.channel || "email",
    replyText: input.replyText,
    metadata: { source: "automation_placeholder_inbound", ...(input.metadata ?? {}) },
  });
}

function requireSafety(config, key, message) {
  if (!config.safety?.[key]) throw new Error(message);
}

async function completeResearchWorker(job, config, dryRun) {
  const website = await getAutomationWebsite(job.websiteId);
  const leadId = job.leadId || website.mapping?.leadId;
  if (!leadId) throw new Error("research_worker requires a linked lead.");
  const factoryStatus = website.factoryStatus || website.currentStage;
  if (!["discovered", "research_pending", "intake", "research"].includes(factoryStatus)) {
    return { skipped: true, reason: `Research trigger not met at factoryStatus ${factoryStatus}.` };
  }
  if (website.lead?.websiteResearchApprovedAt || factoryStatus === "researched") {
    return { skipped: true, reason: "Research is already approved or completed." };
  }
  if (dryRun) {
    return {
      dryRun,
      workerType: job.workerType,
      wouldHaveUpdatedFactoryStatus: "researched",
      wouldHaveEnrichedLead: leadId,
      message: "Dry-run research_worker validated lead readiness and would mark Website researched.",
    };
  }
  requireSafety(config, "allowFactoryStateWrites", "research_worker live mode requires allowFactoryStateWrites.");
  await setWebsiteFactoryStatus(website.websiteId, "researching", { source: "research_worker", notes: "Automated research started." });
  const lead = await findLeadWithMeta(leadId);
  const { fields } = await enrichLeadFields(lead);
  const result = await updateLeadMissionControl(leadId, {
    ...fields,
    websiteResearchApprovedAt: new Date().toISOString(),
    activity: { type: "automation_research_worker", summary: "Research completed by automation worker." },
  });
  await setWebsiteFactoryStatus(website.websiteId, "researched", { source: "research_worker", notes: "Automated research completed." });
  await appendWebsiteEvent(website.websiteId, { type: "automation_research_completed", label: "Automation research completed", source: "automation" });
  return { workerType: job.workerType, leadId, result, message: "research_worker completed and marked Website researched." };
}

async function completePreviewWorker(job, config, dryRun) {
  const website = await getAutomationWebsite(job.websiteId);
  const leadId = job.leadId || website.mapping?.leadId;
  if (!leadId) throw new Error("preview_worker requires a linked lead.");
  if (website.factoryStatus !== "researched") {
    return { skipped: true, reason: `Preview trigger requires researched status, current status is ${website.factoryStatus}.` };
  }
  if (website.preview?.previewExists) {
    return { skipped: true, reason: "Preview already exists." };
  }
  if (dryRun) {
    return {
      dryRun,
      workerType: job.workerType,
      wouldHaveGeneratedPreviewForLead: leadId,
      wouldHaveUpdatedFactoryStatus: "generated",
      message: "Dry-run preview_worker would generate the preview and mark Website generated.",
    };
  }
  requireSafety(config, "allowFactoryStateWrites", "preview_worker live mode requires allowFactoryStateWrites.");
  requireSafety(config, "allowPreviewGeneration", "preview_worker live mode requires allowPreviewGeneration.");
  await setWebsiteFactoryStatus(website.websiteId, "generating", { source: "preview_worker", notes: "Automated preview generation started." });
  const lead = await findLead(leadId);
  const result = await generatePreviewSiteV3(lead);
  await updateLeadMissionControl(leadId, {
    previewStatus: "generated",
    pipelineStage: "preview_ready",
    previewGeneratedAt: new Date().toISOString(),
    activity: { type: "automation_preview_worker", summary: "Preview generated by automation worker." },
  });
  await setWebsiteFactoryStatus(website.websiteId, "generated", { source: "preview_worker", notes: "Automated preview generated." });
  await appendWebsiteEvent(website.websiteId, { type: "automation_preview_generated", label: "Automation preview generated", source: "automation" });
  return { workerType: job.workerType, leadId, result, message: "preview_worker generated preview." };
}

async function completeAssetWorker(job, config, dryRun) {
  const website = await getAutomationWebsite(job.websiteId);
  const leadId = job.leadId || website.mapping?.leadId;
  if (!leadId) throw new Error("asset_worker requires a linked lead.");
  if (!website.preview?.previewExists) return { skipped: true, reason: "Preview does not exist." };
  if (website.preview?.assetsReady) return { skipped: true, reason: "Assets are already ready." };
  if (dryRun) {
    return {
      dryRun,
      workerType: job.workerType,
      wouldHavePreparedAssetsForLead: leadId,
      message: "Dry-run asset_worker would prepare assets and keep Website in generation stage.",
    };
  }
  requireSafety(config, "allowFactoryStateWrites", "asset_worker live mode requires allowFactoryStateWrites.");
  requireSafety(config, "allowAssetPreparation", "asset_worker live mode requires allowAssetPreparation.");
  const lead = await findLead(leadId);
  const result = await prepareAssetsForLead(lead);
  await updateLeadMissionControl(leadId, {
    previewStatus: "assets_ready",
    pipelineStage: "preview_ready",
    activity: { type: "automation_asset_worker", summary: "Assets generated by automation worker." },
  });
  await setWebsiteFactoryStatus(website.websiteId, "assets_ready", { source: "asset_worker", notes: "Automated assets generated." });
  await appendWebsiteEvent(website.websiteId, { type: "automation_assets_generated", label: "Automation assets generated", source: "automation" });
  return { workerType: job.workerType, leadId, result, message: "asset_worker prepared assets." };
}

async function completeScreenshotWorker(job, config, dryRun) {
  const website = await getAutomationWebsite(job.websiteId);
  const leadId = job.leadId || website.mapping?.leadId;
  if (!leadId) throw new Error("screenshot_worker requires a linked lead.");
  if (!website.preview?.previewExists) return { skipped: true, reason: "Preview does not exist." };
  if (!website.preview?.assetsReady) return { skipped: true, reason: "Assets are not ready." };
  if (website.preview?.desktopExists && website.preview?.mobileExists) {
    return { skipped: true, reason: "Desktop and mobile screenshots already exist." };
  }
  if (dryRun) {
    return {
      dryRun,
      workerType: job.workerType,
      wouldHaveRenderedScreenshotsForLead: leadId,
      wouldHaveUpdatedFactoryStatus: "preview_ready",
      message: "Dry-run screenshot_worker would render desktop/mobile screenshots and stop before QC.",
    };
  }
  requireSafety(config, "allowFactoryStateWrites", "screenshot_worker live mode requires allowFactoryStateWrites.");
  requireSafety(config, "allowScreenshotRendering", "screenshot_worker live mode requires allowScreenshotRendering.");
  const lead = await findLead(leadId);
  const result = await renderPreviewV3Screenshots(lead);
  await updateLeadMissionControl(leadId, {
    previewStatus: "rendered",
    activity: { type: "automation_screenshot_worker", summary: "Screenshots rendered by automation worker." },
  });
  const refreshed = await getAutomationWebsite(job.websiteId);
  if (refreshed.preview?.desktopExists && refreshed.preview?.mobileExists) {
    await setWebsiteFactoryStatus(website.websiteId, "preview_ready", { source: "screenshot_worker", notes: "Automated screenshots rendered." });
  }
  await appendWebsiteEvent(website.websiteId, { type: "automation_screenshots_rendered", label: "Automation screenshots rendered", source: "automation" });
  return { workerType: job.workerType, leadId, result, message: "screenshot_worker rendered screenshots and stopped before QC." };
}

async function completeQcWorker(job, config, dryRun) {
  const website = await getAutomationWebsite(job.websiteId);
  if (website.lead?.qcStatus === "rejected") {
    return { skipped: true, reason: "Manual QC rejection blocks autonomous QC." };
  }
  if (website.factoryStatus !== "preview_ready") {
    return { skipped: true, reason: `QC trigger requires preview_ready status, current status is ${website.factoryStatus}.` };
  }
  if (!website.preview?.previewExists || !website.preview?.desktopExists || !website.preview?.mobileExists) {
    return { skipped: true, reason: "QC requires preview plus desktop and mobile screenshots." };
  }
  const latestQc = await latestWebsiteQcRecord(website.websiteId);
  if (latestQc?.passed && !deterministicQcIsStale(website, latestQc)) {
    return { skipped: true, reason: "Latest deterministic QC already passed and is current." };
  }
  if (dryRun) {
    return {
      dryRun,
      workerType: job.workerType,
      wouldRunChecks: [
        "Preview directory",
        "Preview exists",
        "Required styles file",
        "Asset manifest",
        "Desktop screenshot",
        "Mobile screenshot",
        "Required content sections",
        "Contact info",
        "No placeholder text",
        "Internal links",
        "Responsive viewport",
        "Mobile load check",
        "SEO metadata",
        "Deployment readiness",
      ],
      message: "Dry-run qc_worker would run deterministic QC and update Website state to qc_passed or qc_failed.",
    };
  }
  requireSafety(config, "allowFactoryStateWrites", "qc_worker live mode requires allowFactoryStateWrites.");
  requireSafety(config, "allowQcExecution", "qc_worker live mode requires allowQcExecution.");
  await setWebsiteFactoryStatus(website.websiteId, "qc_running", { source: "qc_worker", notes: "Automated deterministic QC started." });
  const result = await runWebsiteQc(website);
  await setWebsiteFactoryStatus(website.websiteId, result.passed ? "qc_passed" : "qc_failed", {
    source: "qc_worker",
    notes: result.passed ? "Automated deterministic QC passed." : "Automated deterministic QC failed.",
    metadata: { qcId: result.qcId },
  });
  await appendWebsiteEvent(website.websiteId, {
    type: result.passed ? "automation_qc_passed" : "automation_qc_failed",
    label: result.passed ? "Automation QC passed" : "Automation QC failed",
    detail: `${result.checks.filter((check) => check.status === "fail").length} failing check(s).`,
    source: "automation",
    metadata: { qcId: result.qcId },
  });
  return {
    workerType: job.workerType,
    qcId: result.qcId,
    passed: result.passed,
    checks: result.checks,
    message: result.passed ? "qc_worker passed deterministic QC." : "qc_worker failed deterministic QC and escalated state.",
  };
}

async function completeDeploymentWorker(job, config, dryRun) {
  const website = await getAutomationWebsite(job.websiteId);
  const latestQc = await latestWebsiteQcRecord(website.websiteId);
  const latestDeployment = await latestDeploymentForWebsite(website.websiteId);
  const readyDeployment = (website.deploymentHistory ?? []).find((record) => record.status === "ready" && record.deployedUrl && record.verifiedAt);
  if (website.factoryStatus !== "qc_passed") {
    return { skipped: true, reason: `Deployment trigger requires qc_passed status, current status is ${website.factoryStatus}.` };
  }
  if (!latestQc?.passed) throw new Error("Deployment requires a passing deterministic QC record.");
  if (readyDeployment) return { skipped: true, reason: "A verified ready deployment already exists." };
  if (latestDeployment?.status === "pending") {
    return { skipped: true, reason: "A pending deployment already exists. Use deployment_refresh_worker." };
  }
  if (!website.preview?.previewExists || !website.preview?.previewDirBase) {
    throw new Error("Deployment requires an existing generated preview artifact.");
  }
  const provider = getDeploymentProviderStatus();
  if (!provider.configured) throw new Error(`Deployment provider is not configured. Missing: ${(provider.missing ?? []).join(", ")}.`);
  if (dryRun) {
    return {
      dryRun,
      workerType: job.workerType,
      provider,
      wouldDeployPreviewDir: website.preview.previewDirBase,
      wouldSetFactoryStatus: "deployed if public URL verifies; otherwise pending or deploy_failed",
      message: "Dry-run deployment_worker would deploy using the hardened deployment flow after QC pass.",
    };
  }
  requireSafety(config, "allowFactoryStateWrites", "deployment_worker live mode requires allowFactoryStateWrites.");
  requireSafety(config, "allowDeployment", "deployment_worker live mode requires allowDeployment.");
  await setWebsiteFactoryStatus(website.websiteId, "deployment_pending", { source: "deployment_worker", notes: "Automated deployment started." });
  try {
    const result = await deployStaticPreview({
      websiteId: website.websiteId,
      leadId: website.mapping?.leadId,
      sitePath: join(PREVIEWS_ROOT, website.preview.previewDirBase),
      metadata: { name: website.businessName },
    });
    if (result.status === "ready" && result.deployedUrl && result.verifiedAt) {
      await setWebsiteFactoryStatus(website.websiteId, "deployed", {
        source: "deployment_worker",
        notes: result.deployedUrl,
        metadata: { deploymentRecordId: result.deploymentRecordId, deployedUrl: result.deployedUrl },
      });
      await appendWebsiteEvent(website.websiteId, {
        type: "automation_deployment_ready",
        label: "Automation deployment ready",
        detail: result.deployedUrl,
        source: "automation",
        metadata: { deploymentRecordId: result.deploymentRecordId },
      });
    } else if (result.status === "pending" && result.deploymentId) {
      await setWebsiteFactoryStatus(website.websiteId, "deployment_pending", {
        source: "deployment_worker",
        notes: result.deploymentId,
        metadata: { deploymentRecordId: result.deploymentRecordId, deploymentId: result.deploymentId },
      });
      await appendWebsiteEvent(website.websiteId, {
        type: "automation_deployment_pending",
        label: "Automation deployment pending",
        detail: result.deploymentId,
        source: "automation",
        metadata: { deploymentRecordId: result.deploymentRecordId },
      });
    }
    return {
      workerType: job.workerType,
      result,
      scheduleRefreshJob: result.status === "pending" && result.deploymentId,
      refreshJobInput: {
        deploymentRecordId: result.deploymentRecordId,
        reason: "Deployment returned pending and requires status refresh.",
        chain: "qc_deployment",
      },
      message: `deployment_worker completed with status ${result.status}.`,
    };
  } catch (err) {
    await setWebsiteFactoryStatus(website.websiteId, "deploy_failed", { source: "deployment_worker", notes: err.message });
    await appendWebsiteEvent(website.websiteId, {
      type: "automation_deployment_failed",
      label: "Automation deployment failed",
      detail: err.message,
      source: "automation",
    });
    throw err;
  }
}

async function completeDeploymentRefreshWorker(job, config, dryRun) {
  const website = await getAutomationWebsite(job.websiteId);
  const deploymentRecordId = cleanText(job.input?.deploymentRecordId) || (await latestDeploymentForWebsite(job.websiteId))?.deploymentRecordId;
  const latestDeployment = await latestDeploymentForWebsite(job.websiteId);
  const targetDeployment = deploymentRecordId === latestDeployment?.deploymentRecordId
    ? latestDeployment
    : (website.deploymentHistory ?? []).find((record) => record.deploymentRecordId === deploymentRecordId);
  if (!targetDeployment) throw new Error("deployment_refresh_worker requires a deployment record.");
  if (targetDeployment.status !== "pending") {
    return { skipped: true, reason: `Deployment record is ${targetDeployment.status}, not pending.` };
  }
  if (!targetDeployment.deploymentId) throw new Error("Pending deployment has no provider deployment ID.");
  if (dryRun) {
    return {
      dryRun,
      workerType: job.workerType,
      wouldRefreshDeploymentRecordId: targetDeployment.deploymentRecordId,
      wouldPollProviderDeploymentId: targetDeployment.deploymentId,
      message: "Dry-run deployment_refresh_worker would poll existing pending deployment without creating a new deployment.",
    };
  }
  requireSafety(config, "allowFactoryStateWrites", "deployment_refresh_worker live mode requires allowFactoryStateWrites.");
  requireSafety(config, "allowDeploymentRefresh", "deployment_refresh_worker live mode requires allowDeploymentRefresh.");
  const result = await refreshDeploymentRecord(targetDeployment.deploymentRecordId);
  if (result.status === "ready" && result.deployedUrl && result.verifiedAt) {
    await setWebsiteFactoryStatus(website.websiteId, "deployed", {
      source: "deployment_refresh_worker",
      notes: result.deployedUrl,
      metadata: { deploymentRecordId: result.deploymentRecordId, deployedUrl: result.deployedUrl },
    });
    await appendWebsiteEvent(website.websiteId, {
      type: "automation_deployment_refreshed_ready",
      label: "Automation deployment refreshed ready",
      detail: result.deployedUrl,
      source: "automation",
      metadata: { deploymentRecordId: result.deploymentRecordId },
    });
    return { workerType: job.workerType, result, message: "deployment_refresh_worker verified public URL and marked Website deployed." };
  }
  if (result.status === "failed" || job.attempts >= job.maxAttempts) {
    const failed = result.status === "failed"
      ? result
      : await updateDeploymentRecord(result.deploymentRecordId, {
        status: "failed",
        logs: [...(result.logs ?? []), "Deployment refresh exceeded max attempts."],
      });
    await setWebsiteFactoryStatus(website.websiteId, "deploy_failed", {
      source: "deployment_refresh_worker",
      notes: "Deployment refresh exceeded max attempts or provider returned failure.",
      metadata: { deploymentRecordId: failed.deploymentRecordId },
    });
    await appendWebsiteEvent(website.websiteId, {
      type: "automation_deployment_refresh_failed",
      label: "Automation deployment refresh failed",
      detail: failed.deploymentRecordId,
      source: "automation",
      metadata: { deploymentRecordId: failed.deploymentRecordId },
    });
    return { workerType: job.workerType, result: failed, message: "deployment_refresh_worker marked deployment failed." };
  }
  throw new Error("Deployment is still pending; refresh retry scheduled.");
}

function outreachPolicyResult(website, outreach) {
  const text = `${outreach?.subject ?? ""}\n${outreach?.body ?? ""}`;
  const lower = text.toLowerCase();
  const verifiedDeployment = latestVerifiedDeployment(website);
  const blockedWords = ["lorem ipsum", "{{", "}}", "[placeholder]", "todo", "your business"];
  const failures = [];
  if (!verifiedDeployment?.deployedUrl || !text.includes(verifiedDeployment.deployedUrl)) {
    failures.push("Message does not include verified public URL.");
  }
  if (!cleanText(website.businessName)) failures.push("Business name is missing.");
  if (!cleanText(outreach?.to) && !cleanText(website.lead?.email) && !cleanText(website.lead?.phone)) {
    failures.push("No contact method is available.");
  }
  for (const word of blockedWords) {
    if (lower.includes(word)) failures.push(`Blocked or placeholder text found: ${word}.`);
  }
  return {
    passed: failures.length === 0,
    failures,
    verifiedUrl: verifiedDeployment?.deployedUrl || "",
  };
}

async function completeOutreachDraftWorker(job, config, dryRun) {
  const website = await getAutomationWebsite(job.websiteId);
  const verifiedDeployment = latestVerifiedDeployment(website);
  const activeOutreach = (website.outreachHistory ?? []).find(isActiveOutreach);
  if (website.factoryStatus !== "deployed") {
    return { skipped: true, reason: `Outreach draft requires deployed status, current status is ${website.factoryStatus}.` };
  }
  if (!verifiedDeployment) throw new Error("Outreach draft requires latest deployment to be ready with verifiedAt.");
  if (activeOutreach) return { skipped: true, reason: "An active or pending outreach record already exists." };
  if (dryRun) {
    return {
      dryRun,
      workerType: job.workerType,
      wouldCreateDraftForUrl: verifiedDeployment.deployedUrl,
      message: "Dry-run outreach_draft_worker would create an outreach draft with the verified public URL.",
    };
  }
  requireSafety(config, "allowFactoryStateWrites", "outreach_draft_worker live mode requires allowFactoryStateWrites.");
  requireSafety(config, "allowOutreachDraft", "outreach_draft_worker live mode requires allowOutreachDraft.");
  const result = await createOutreachDraft({ website: { ...website, deployedUrl: verifiedDeployment.deployedUrl } });
  await setWebsiteFactoryStatus(website.websiteId, "outreach_drafted", {
    source: "outreach_draft_worker",
    notes: "Automated outreach draft created.",
    metadata: { outreachId: result.outreachId },
  });
  await appendWebsiteEvent(website.websiteId, {
    type: "automation_outreach_drafted",
    label: "Automation outreach drafted",
    detail: result.subject,
    source: "automation",
    metadata: { outreachId: result.outreachId },
  });
  return { workerType: job.workerType, outreachId: result.outreachId, result, message: "outreach_draft_worker created outreach draft." };
}

async function completeOutreachApprovalPolicyWorker(job, config, dryRun) {
  const website = await getAutomationWebsite(job.websiteId);
  const outreachId = cleanText(job.input?.outreachId) || website.outreach?.outreachId || (await latestOutreachForWebsite(job.websiteId))?.outreachId;
  const outreach = (website.outreachHistory ?? []).find((record) => record.outreachId === outreachId) || await latestOutreachForWebsite(job.websiteId);
  if (!outreach?.outreachId) throw new Error("outreach_approval_policy_worker requires an outreach draft.");
  if (outreach.approvalStatus !== "draft" || outreach.sendStatus !== "drafted") {
    return { skipped: true, reason: "Latest outreach is not an undecided draft." };
  }
  const policy = outreachPolicyResult(website, outreach);
  if (dryRun) {
    return {
      dryRun,
      workerType: job.workerType,
      policy,
      wouldApprove: Boolean(config.safety?.allowAutoOutreachApproval && policy.passed),
      message: "Dry-run outreach_approval_policy_worker evaluated draft approval policy.",
    };
  }
  requireSafety(config, "allowFactoryStateWrites", "outreach_approval_policy_worker live mode requires allowFactoryStateWrites.");
  if (!config.safety?.allowAutoOutreachApproval || !policy.passed) {
    await appendWebsiteEvent(website.websiteId, {
      type: "automation_outreach_human_review",
      label: "Automation outreach requires human review",
      detail: policy.failures.join(" | ") || "Auto approval disabled.",
      source: "automation",
      metadata: { outreachId: outreach.outreachId },
    });
    return {
      workerType: job.workerType,
      policy,
      humanReview: true,
      message: "outreach_approval_policy_worker left draft for human review.",
    };
  }
  const result = await approveAndQueueOutreach(outreach.outreachId);
  await setWebsiteFactoryStatus(website.websiteId, "outreach_queued", {
    source: "outreach_approval_policy_worker",
    notes: "Automated outreach approval policy passed.",
    metadata: { outreachId: result.outreachId },
  });
  await appendWebsiteEvent(website.websiteId, {
    type: "automation_outreach_queued",
    label: "Automation outreach queued",
    detail: result.subject,
    source: "automation",
    metadata: { outreachId: result.outreachId },
  });
  return { workerType: job.workerType, policy, outreachId: result.outreachId, result, message: "outreach_approval_policy_worker approved and queued outreach." };
}

async function completeOutreachSenderWorker(job, config, dryRun) {
  const website = await getAutomationWebsite(job.websiteId);
  const outreachId = cleanText(job.input?.outreachId) || website.outreach?.outreachId || (await latestOutreachForWebsite(job.websiteId))?.outreachId;
  const outreach = (website.outreachHistory ?? []).find((record) => record.outreachId === outreachId) || await latestOutreachForWebsite(job.websiteId);
  if (!outreach?.outreachId) throw new Error("outreach_sender_worker requires queued outreach.");
  if (outreach.approvalStatus !== "approved" || outreach.sendStatus !== "queued") {
    return { skipped: true, reason: "Outreach must be approved and queued before sending." };
  }
  if (dryRun) {
    return {
      dryRun,
      workerType: job.workerType,
      wouldMarkSentProvider: "manual_simulated",
      outreachId: outreach.outreachId,
      message: "Dry-run outreach_sender_worker would perform a simulated send only if enabled.",
    };
  }
  requireSafety(config, "allowFactoryStateWrites", "outreach_sender_worker live mode requires allowFactoryStateWrites.");
  requireSafety(config, "allowSimulatedSend", "outreach_sender_worker live mode requires allowSimulatedSend.");
  const result = await markOutreachSent(outreach.outreachId, {
    provider: "manual_simulated",
    providerMessageId: `simulated_${randomUUID()}`,
    notes: "Simulated send by automation worker. No real email/SMS provider was called.",
  });
  await setWebsiteFactoryStatus(website.websiteId, "outreach_sent", {
    source: "outreach_sender_worker",
    notes: "Simulated outreach send completed.",
    metadata: { outreachId: result.outreachId },
  });
  await appendWebsiteEvent(website.websiteId, {
    type: "automation_outreach_sent",
    label: "Automation outreach sent",
    detail: "Simulated send only; no real provider was called.",
    source: "automation",
    metadata: { outreachId: result.outreachId },
  });
  return { workerType: job.workerType, outreachId: result.outreachId, result, message: "outreach_sender_worker completed simulated send and marked Website outreach_sent." };
}

function classifyReplyText(replyText = "") {
  const text = cleanText(replyText).toLowerCase();
  const spam = ["unsubscribe", "stop emailing", "viagra", "crypto", "casino"];
  const notInterested = ["not interested", "no thanks", "remove me", "don't contact", "do not contact", "not a good fit"];
  const interested = ["interested", "sounds good", "tell me more", "call me", "let's talk", "lets talk", "send details", "i want", "we need"];
  const followUp = ["later", "next week", "follow up", "send info", "circle back", "busy", "not right now"];
  if (spam.some((item) => text.includes(item))) return { classification: "spam", reason: "Spam or unsubscribe language detected." };
  if (notInterested.some((item) => text.includes(item))) return { classification: "not_interested", reason: "Clear not-interested language detected." };
  if (interested.some((item) => text.includes(item))) return { classification: "interested", reason: "Interest language detected." };
  if (followUp.some((item) => text.includes(item))) return { classification: "needs_follow_up", reason: "Follow-up timing language detected." };
  return { classification: "unclear", reason: "Reply did not match a safe automatic classification." };
}

async function completeReplyCaptureWorker(job, config, dryRun) {
  const website = await getAutomationWebsite(job.websiteId);
  const inboundReplyId = cleanText(job.input?.inboundReplyId);
  const pending = inboundReplyId
    ? (await listInboundReplies({ websiteId: job.websiteId })).find((reply) => reply.inboundReplyId === inboundReplyId)
    : (await listInboundReplies({ websiteId: job.websiteId, status: "pending" }))[0];
  const outreach = website.outreach ?? await latestOutreachForWebsite(job.websiteId);
  if (website.factoryStatus !== "outreach_sent") {
    return { skipped: true, reason: `Reply capture requires outreach_sent status, current status is ${website.factoryStatus}.` };
  }
  if (!outreach?.outreachId || outreach.sendStatus !== "sent" || !(outreach.providerMessageId || outreach.provider)) {
    throw new Error("Reply capture requires sent outreach with provider/message reference.");
  }
  if (!pending?.inboundReplyId) throw new Error("No pending inbound reply exists for this Website.");
  if (dryRun) {
    return {
      dryRun,
      workerType: job.workerType,
      inboundReplyId: pending.inboundReplyId,
      wouldLinkToOutreachId: outreach.outreachId,
      message: "Dry-run reply_capture_worker would capture and link inbound reply without classification.",
    };
  }
  requireSafety(config, "allowFactoryStateWrites", "reply_capture_worker live mode requires allowFactoryStateWrites.");
  requireSafety(config, "allowReplyCapture", "reply_capture_worker live mode requires allowReplyCapture.");
  if (website.mapping?.leadId && !website.revenue?.revenueId) {
    await createRevenueRecordForLead(website.lead ?? {});
  }
  const revenueSelector = website.revenue?.revenueId ? { revenueId: website.revenue.revenueId } : { leadId: website.mapping?.leadId };
  const result = await logRevenueReply(revenueSelector, {
    receivedAt: pending.receivedAt,
    channel: pending.channel,
    sentiment: "neutral",
    replyText: pending.replyText,
    nextAction: "Pending automated classification.",
    evidence: pending.replyText,
    source: "automation_reply_capture",
  });
  const captured = await updateInboundReply(pending.inboundReplyId, {
    status: "captured",
    capturedAt: nowIso(),
    outreachId: pending.outreachId || outreach.outreachId,
    revenueId: pending.revenueId || result?.record?.revenueId || website.revenue?.revenueId,
  });
  await setWebsiteFactoryStatus(website.websiteId, "reply_received", {
    source: "reply_capture_worker",
    notes: "Inbound reply captured and linked.",
    metadata: { inboundReplyId: captured.inboundReplyId, outreachId: outreach.outreachId },
  });
  await appendWebsiteEvent(website.websiteId, {
    type: "automation_reply_captured",
    label: "Automation reply captured",
    detail: pending.replyText,
    source: "automation",
    metadata: { inboundReplyId: captured.inboundReplyId, outreachId: outreach.outreachId },
  });
  return { workerType: job.workerType, inboundReplyId: captured.inboundReplyId, result, message: "reply_capture_worker captured inbound reply and linked revenue record." };
}

async function completeReplyClassifierWorker(job, config, dryRun) {
  const website = await getAutomationWebsite(job.websiteId);
  const inboundReplyId = cleanText(job.input?.inboundReplyId);
  const captured = inboundReplyId
    ? (await listInboundReplies({ websiteId: job.websiteId })).find((reply) => reply.inboundReplyId === inboundReplyId)
    : (await listInboundReplies({ websiteId: job.websiteId })).find((reply) => reply.status === "captured" && !reply.classification);
  if (!captured?.inboundReplyId) throw new Error("No captured unclassified inbound reply exists for this Website.");
  const classification = classifyReplyText(captured.replyText);
  if (dryRun) {
    return {
      dryRun,
      workerType: job.workerType,
      inboundReplyId: captured.inboundReplyId,
      classification,
      message: "Dry-run reply_classifier_worker would classify reply and update state only for safe classifications.",
    };
  }
  requireSafety(config, "allowFactoryStateWrites", "reply_classifier_worker live mode requires allowFactoryStateWrites.");
  requireSafety(config, "allowReplyClassification", "reply_classifier_worker live mode requires allowReplyClassification.");
  const humanReview = classification.classification === "unclear";
  const nextStatus = humanReview ? "human_review" : "classified";
  const updated = await updateInboundReply(captured.inboundReplyId, {
    status: nextStatus,
    classification: classification.classification,
    classificationReason: classification.reason,
    humanReview,
    classifiedAt: nowIso(),
  });
  if (["interested", "needs_follow_up"].includes(classification.classification)) {
    if (website.mapping?.leadId) {
      await updateLeadMissionControl(website.mapping.leadId, {
        pipelineStage: "replied",
        replyStatus: "replied",
        activity: { type: "automation_reply_classified", summary: classification.reason },
      });
      await transitionRevenueStageIfEarlier({ leadId: website.mapping.leadId }, "replied", "Automated reply classification.");
    }
    await setWebsiteFactoryStatus(website.websiteId, "replied", { source: "reply_classifier_worker", notes: classification.reason });
  } else if (classification.classification === "not_interested") {
    if (config.safety?.allowAutoLostFromReply) {
      if (website.mapping?.leadId) {
        await updateLeadMissionControl(website.mapping.leadId, {
          pipelineStage: "lost",
          replyStatus: "lost",
          dealStage: "lost",
          activity: { type: "automation_reply_not_interested", summary: classification.reason },
        });
      }
      if (website.revenue?.revenueId) await markRevenueLost({ revenueId: website.revenue.revenueId }, "Clear not-interested reply.");
      await setWebsiteFactoryStatus(website.websiteId, "lost", { source: "reply_classifier_worker", notes: classification.reason });
    } else {
      await updateInboundReply(captured.inboundReplyId, { status: "human_review", humanReview: true });
    }
  } else if (classification.classification === "unclear") {
    await setWebsiteFactoryStatus(website.websiteId, "reply_received", {
      source: "reply_classifier_worker",
      notes: "Unclear reply requires human review.",
      metadata: { inboundReplyId: captured.inboundReplyId, classification: classification.classification },
    });
  }
  await appendWebsiteEvent(website.websiteId, {
    type: "automation_reply_classified",
    label: `Automation reply classified: ${classification.classification}`,
    detail: classification.reason,
    source: "automation",
    metadata: { inboundReplyId: updated.inboundReplyId },
  });
  return { workerType: job.workerType, inboundReplyId: updated.inboundReplyId, classification, humanReview, message: "reply_classifier_worker classified inbound reply." };
}

async function completeRevenueCloseWorker(job, config, dryRun) {
  const website = await getAutomationWebsite(job.websiteId);
  const reconciliation = terminalMismatchPlan(website);
  if (!reconciliation) return { skipped: true, reason: "No terminal revenue mismatch detected." };
  if (dryRun) {
    return {
      dryRun,
      workerType: job.workerType,
      reconciliation,
      message: "Dry-run revenue_close_worker would reconcile lead, Website, and revenue state.",
    };
  }
  requireSafety(config, "allowFactoryStateWrites", "revenue_close_worker live mode requires allowFactoryStateWrites.");
  requireSafety(config, "allowRevenueReconciliation", "revenue_close_worker live mode requires allowRevenueReconciliation.");
  const { target } = reconciliation;
  if (website.factoryStatus !== "needs_reconciliation") {
    await setWebsiteFactoryStatus(website.websiteId, "needs_reconciliation", {
      source: "revenue_close_worker",
      notes: reconciliation.mismatches.join(" | "),
      metadata: { target },
    });
  }
  if (target === "won") {
    if (website.revenue?.revenueId) await markRevenueWon({ revenueId: website.revenue.revenueId }, "Automated revenue reconciliation.");
    if (website.mapping?.leadId) {
      await updateLeadMissionControl(website.mapping.leadId, {
        pipelineStage: "won",
        replyStatus: "won",
        dealStage: "won",
        activity: { type: "automation_revenue_won_reconciled", summary: "Revenue state reconciled to won." },
      });
    }
    await setWebsiteFactoryStatus(website.websiteId, "won", { source: "revenue_close_worker", notes: "Revenue state reconciled to won." });
  } else if (target === "lost") {
    if (website.revenue?.revenueId) await markRevenueLost({ revenueId: website.revenue.revenueId }, "Automated revenue reconciliation.");
    if (website.mapping?.leadId) {
      await updateLeadMissionControl(website.mapping.leadId, {
        pipelineStage: "lost",
        replyStatus: "lost",
        dealStage: "lost",
        activity: { type: "automation_revenue_lost_reconciled", summary: "Revenue state reconciled to lost." },
      });
    }
    await setWebsiteFactoryStatus(website.websiteId, "lost", { source: "revenue_close_worker", notes: "Revenue state reconciled to lost." });
  } else if (target === "activated") {
    if (website.revenue?.revenueId) await transitionRevenueStageIfEarlier({ revenueId: website.revenue.revenueId }, "activated", "Automated revenue reconciliation.");
    if (website.mapping?.leadId) {
      await updateLeadMissionControl(website.mapping.leadId, {
        pipelineStage: "activated",
        dealStage: "won",
        activity: { type: "automation_revenue_activated_reconciled", summary: "Revenue state reconciled to activated." },
      });
    }
    await setWebsiteFactoryStatus(website.websiteId, "activated", { source: "revenue_close_worker", notes: "Revenue state reconciled to activated." });
  }
  await appendWebsiteEvent(website.websiteId, {
    type: "automation_revenue_reconciled",
    label: `Automation revenue reconciled: ${target}`,
    detail: reconciliation.mismatches.join(" | "),
    source: "automation",
  });
  return { workerType: job.workerType, reconciliation, message: `revenue_close_worker reconciled state to ${target}.` };
}

async function executePlaceholderWorker(job, config) {
  if (!job.websiteId) throw new Error("Placeholder worker requires websiteId.");
  return {
    dryRun: true,
    workerType: job.workerType,
    wouldHaveRun: job.workerType,
    wouldHaveUsedInput: job.input,
    sideEffectsBlocked: true,
    safety: config.safety,
    message: `Dry-run placeholder completed for ${job.workerType}. No Website state, deployment, outreach, revenue, or generation side effects occurred.`,
  };
}

async function executeAutomationWorker(job, config, dryRun) {
  if (job.workerType === "research_worker") return completeResearchWorker(job, config, dryRun);
  if (job.workerType === "preview_worker") return completePreviewWorker(job, config, dryRun);
  if (job.workerType === "asset_worker") return completeAssetWorker(job, config, dryRun);
  if (job.workerType === "screenshot_worker") return completeScreenshotWorker(job, config, dryRun);
  if (job.workerType === "qc_worker") return completeQcWorker(job, config, dryRun);
  if (job.workerType === "deployment_worker") return completeDeploymentWorker(job, config, dryRun);
  if (job.workerType === "deployment_refresh_worker") return completeDeploymentRefreshWorker(job, config, dryRun);
  if (job.workerType === "outreach_draft_worker") return completeOutreachDraftWorker(job, config, dryRun);
  if (job.workerType === "outreach_approval_policy_worker") return completeOutreachApprovalPolicyWorker(job, config, dryRun);
  if (job.workerType === "outreach_sender_worker") return completeOutreachSenderWorker(job, config, dryRun);
  if (job.workerType === "reply_capture_worker") return completeReplyCaptureWorker(job, config, dryRun);
  if (job.workerType === "reply_classifier_worker") return completeReplyClassifierWorker(job, config, dryRun);
  if (job.workerType === "revenue_close_worker") return completeRevenueCloseWorker(job, config, dryRun);
  return executePlaceholderWorker(job, config);
}

export async function runAutomationCycle({ requestedBy = "manual", maxJobs } = {}) {
  const config = await getAutomationConfig();
  const cycleDryRun = Boolean(config.dryRun || config.safety?.forceDryRun);
  const run = normalizeRun({ dryRun: cycleDryRun, status: "running" });
  let jobsState = await readJobsState();
  jobsState = await recoverStaleRunningJobs(jobsState);
  const now = nowIso();
  const limit = clampNumber(maxJobs, config.maxJobsPerCycle, { min: 1, max: config.maxJobsPerCycle });
  const eligible = jobsState.jobs
    .filter((job) => isRunnableStatus(job.status))
    .sort((a, b) => Number(b.priority) - Number(a.priority) || String(a.runAfter).localeCompare(String(b.runAfter)));
  run.jobsScanned = eligible.length;

  const runsState = await readRunsState();
  runsState.runs.push(run);
  await writeRunsState(runsState);

  if (!config.globalEnabled) {
    run.skipped = eligible.length;
    run.status = "completed";
    run.completedAt = nowIso();
    await writeRunsState({ ...runsState, runs: runsState.runs.map((item) => (item.runId === run.runId ? run : item)) });
    for (const job of eligible.slice(0, limit)) {
      await appendAutomationLog({
        jobId: job.jobId,
        runId: run.runId,
        websiteId: job.websiteId,
        workerType: job.workerType,
        event: "job_skipped",
        message: "Automation is globally disabled. Job was not claimed.",
        metadata: { requestedBy },
      });
    }
    return run;
  }

  for (const job of eligible) {
    if (run.jobsClaimed >= limit) {
      run.skipped += 1;
      continue;
    }
    if (String(job.runAfter).localeCompare(now) > 0) {
      run.skipped += 1;
      await appendAutomationLog({
        jobId: job.jobId,
        runId: run.runId,
        websiteId: job.websiteId,
        workerType: job.workerType,
        event: "job_skipped",
        message: "Job runAfter is in the future.",
        metadata: { runAfter: job.runAfter },
      });
      continue;
    }
    if (!config.stages[job.workerType]) {
      run.skipped += 1;
      await appendAutomationLog({
        jobId: job.jobId,
        runId: run.runId,
        websiteId: job.websiteId,
        workerType: job.workerType,
        event: "job_skipped",
        message: `Stage ${job.workerType} is disabled in automation config.`,
      });
      continue;
    }

    const index = jobsState.jobs.findIndex((item) => item.jobId === job.jobId);
    const claimed = normalizeJob({
      ...jobsState.jobs[index],
      status: "running",
      attempts: jobsState.jobs[index].attempts + 1,
      lockedAt: nowIso(),
      updatedAt: nowIso(),
      dryRun: Boolean(config.safety?.forceDryRun || jobsState.jobs[index].dryRun || config.dryRun),
    });
    jobsState.jobs[index] = claimed;
    run.jobsClaimed += 1;
    await writeJobsState(jobsState);
    await appendAutomationLog({
      jobId: claimed.jobId,
      runId: run.runId,
      websiteId: claimed.websiteId,
      workerType: claimed.workerType,
      event: "job_claimed",
      message: `Job claimed for ${claimed.dryRun ? "dry-run" : "live"} automation execution.`,
      metadata: { attempts: claimed.attempts, requestedBy, dryRun: claimed.dryRun },
    });

    try {
      const output = await executeAutomationWorker(claimed, config, claimed.dryRun);
      jobsState.jobs[index] = normalizeJob({
        ...claimed,
        status: "completed",
        output,
        completedAt: nowIso(),
        lockedAt: "",
        updatedAt: nowIso(),
      });
      run.jobsCompleted += 1;
      await writeJobsState(jobsState);
      if (output.scheduleRefreshJob) {
        await createAutomationJob({
          websiteId: claimed.websiteId,
          leadId: claimed.leadId,
          workerType: "deployment_refresh_worker",
          priority: 65,
          input: output.refreshJobInput ?? {},
          dryRun: false,
          maxAttempts: 5,
        });
        jobsState = await readJobsState();
      }
      await appendAutomationLog({
        jobId: claimed.jobId,
        runId: run.runId,
        websiteId: claimed.websiteId,
        workerType: claimed.workerType,
        event: claimed.dryRun ? "dry_run_result" : "job_result",
        message: output.message,
        metadata: output,
      });
      await appendAutomationLog({
        jobId: claimed.jobId,
        runId: run.runId,
        websiteId: claimed.websiteId,
        workerType: claimed.workerType,
        event: "job_completed",
        message: `${claimed.dryRun ? "Dry-run" : "Live"} automation job completed.`,
      });
    } catch (err) {
      const canRetry = claimed.attempts < claimed.maxAttempts;
      const retryAt = canRetry ? nextRetryAt(config) : claimed.runAfter;
      jobsState.jobs[index] = normalizeJob({
        ...claimed,
        status: canRetry ? "retry_scheduled" : "failed",
        failedAt: nowIso(),
        lockedAt: "",
        runAfter: retryAt,
        error: err.message,
        updatedAt: nowIso(),
      });
      run.jobsFailed += 1;
      run.errors.push(err.message);
      await writeJobsState(jobsState);
      await recordWebsiteFactoryFailure(claimed.websiteId, {
        reason: err.message,
        source: claimed.workerType,
        nextRetryAt: canRetry ? retryAt : "",
        maxAttemptsReached: !canRetry,
        metadata: {
          jobId: claimed.jobId,
          runId: run.runId,
          workerType: claimed.workerType,
          attempts: claimed.attempts,
          maxAttempts: claimed.maxAttempts,
          escalation_level: recoveryEscalationLevel(claimed.attempts, claimed.maxAttempts),
        },
      });
      await appendAutomationLog({
        jobId: claimed.jobId,
        runId: run.runId,
        websiteId: claimed.websiteId,
        workerType: claimed.workerType,
        event: "job_failed",
        message: err.message,
      });
      if (canRetry) {
        await appendAutomationLog({
          jobId: claimed.jobId,
          runId: run.runId,
          websiteId: claimed.websiteId,
          workerType: claimed.workerType,
          event: "retry_scheduled",
          message: `Retry scheduled after ${config.retryDefaults.retryDelayMs}ms.`,
          metadata: { runAfter: jobsState.jobs[index].runAfter },
        });
      }
    }
  }

  run.status = run.errors.length ? "failed" : "completed";
  run.completedAt = nowIso();
  await writeRunsState({ ...runsState, runs: runsState.runs.map((item) => (item.runId === run.runId ? run : item)) });
  return run;
}
