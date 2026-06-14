import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";
import { listLeadsWithMeta } from "./mission-control.js";
import { getClientOperationsView } from "./client-operations.js";
import { listRevenueRecords } from "./revenue-pipeline.js";
import { listFulfillmentRecords } from "./fulfillment.js";
import {
  buildWebsiteFactoryView,
  getWebsiteById,
} from "./website-factory.js";
import {
  appendAutomationLog,
  createAutomationJob,
  getAutomationConfig,
  listAutomationJobs,
  planPreviewChainJobs,
  planQcDeploymentChainJobs,
  planOutreachChainJobs,
  planReplyRevenueChainJobs,
  runAutomationCycle,
} from "./automation.js";
import { listInboundReplies } from "./reply-inbox.js";

export const ORCHESTRATION_LOGS_FILE = join(DATA_DIR, "automation-orchestration-logs.json");
export const ORCHESTRATION_STATE_FILE = join(DATA_DIR, "automation-orchestration-state.json");

const MAX_ORCHESTRATION_DEPTH = 12;
const LOCK_TTL_MS = 5 * 60 * 1000;
const WORKER_SAFETY_FLAGS = {
  research_worker: ["allowFactoryStateWrites"],
  preview_worker: ["allowFactoryStateWrites", "allowPreviewGeneration"],
  asset_worker: ["allowAssetPreparation"],
  screenshot_worker: ["allowScreenshotRendering"],
  qc_worker: ["allowQcExecution"],
  deployment_worker: ["allowDeployment"],
  deployment_refresh_worker: ["allowDeploymentRefresh"],
  outreach_draft_worker: ["allowOutreachDraft"],
  outreach_approval_policy_worker: ["allowAutoOutreachApproval"],
  outreach_sender_worker: ["allowSimulatedSend"],
  reply_capture_worker: ["allowReplyCapture"],
  reply_classifier_worker: ["allowReplyClassification"],
  revenue_close_worker: ["allowRevenueReconciliation"],
};

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

function normalizeLog(log = {}) {
  const createdAt = cleanText(log.createdAt) || nowIso();
  return {
    logId: cleanText(log.logId) || `orchestration_log_${randomUUID()}`,
    websiteId: cleanText(log.websiteId),
    event: cleanText(log.event) || "decision",
    message: cleanText(log.message),
    workerType: cleanText(log.workerType),
    status: cleanText(log.status),
    metadata: log.metadata && typeof log.metadata === "object" ? log.metadata : {},
    createdAt,
  };
}

function normalizeState(input = {}) {
  return {
    version: 1,
    locks: Array.isArray(input.locks) ? input.locks.map((lock) => ({
      websiteId: cleanText(lock.websiteId),
      lockId: cleanText(lock.lockId),
      lockedAt: cleanText(lock.lockedAt),
      expiresAt: cleanText(lock.expiresAt),
      status: cleanText(lock.status) || "locked",
    })).filter((lock) => lock.websiteId) : [],
    lastDecisions: Array.isArray(input.lastDecisions) ? input.lastDecisions.map((decision) => ({
      websiteId: cleanText(decision.websiteId),
      status: cleanText(decision.status),
      workerType: cleanText(decision.workerType),
      message: cleanText(decision.message),
      at: cleanText(decision.at) || nowIso(),
      metadata: decision.metadata && typeof decision.metadata === "object" ? decision.metadata : {},
    })).filter((decision) => decision.websiteId) : [],
  };
}

async function readJson(filePath, fallback, normalizer) {
  try {
    return normalizer(JSON.parse(await readFile(filePath, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return normalizer(fallback);
    throw err;
  }
}

async function readLogsState() {
  return readJson(ORCHESTRATION_LOGS_FILE, { version: 1, logs: [] }, (input) => ({
    version: 1,
    logs: Array.isArray(input.logs) ? input.logs.map(normalizeLog) : [],
  }));
}

async function writeLogsState(state) {
  const normalized = {
    version: 1,
    logs: Array.isArray(state.logs) ? state.logs.map(normalizeLog).slice(-1000) : [],
  };
  await writeJsonFileSafe(ORCHESTRATION_LOGS_FILE, normalized);
  return normalized;
}

async function readOrchestrationState() {
  return readJson(ORCHESTRATION_STATE_FILE, { version: 1, locks: [], lastDecisions: [] }, normalizeState);
}

async function writeOrchestrationState(state) {
  const normalized = normalizeState(state);
  await writeJsonFileSafe(ORCHESTRATION_STATE_FILE, normalized);
  return normalized;
}

export async function appendOrchestrationLog(log) {
  const state = await readLogsState();
  const next = normalizeLog(log);
  state.logs.push(next);
  await writeLogsState(state);
  return next;
}

export async function listOrchestrationLogs({ limit = 100 } = {}) {
  const state = await readLogsState();
  return state.logs
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, clampNumber(limit, 100, { min: 1, max: 500 }));
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

export async function listOrchestratableWebsites() {
  return (await buildAutomationWebsiteView()).websites ?? [];
}

async function getWebsite(websiteId) {
  const view = await buildAutomationWebsiteView();
  const website = getWebsiteById(view, websiteId);
  if (!website) throw new Error("Website not found.");
  return website;
}

function lockExpired(lock) {
  if (!lock?.expiresAt) return true;
  return new Date(lock.expiresAt).getTime() <= Date.now();
}

async function acquireLock(websiteId) {
  const state = await readOrchestrationState();
  const existing = state.locks.find((lock) => lock.websiteId === websiteId && !lockExpired(lock));
  if (existing) return { acquired: false, lock: existing, state };
  const lock = {
    websiteId,
    lockId: `orchestration_lock_${randomUUID()}`,
    lockedAt: nowIso(),
    expiresAt: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
    status: "locked",
  };
  state.locks = [
    ...state.locks.filter((item) => item.websiteId !== websiteId || !lockExpired(item)),
    lock,
  ].slice(-500);
  await writeOrchestrationState(state);
  return { acquired: true, lock, state };
}

async function releaseLock(websiteId, lockId) {
  const state = await readOrchestrationState();
  state.locks = state.locks.filter((lock) => !(lock.websiteId === websiteId && lock.lockId === lockId));
  await writeOrchestrationState(state);
}

async function recordDecision(decision) {
  const state = await readOrchestrationState();
  const next = {
    websiteId: decision.websiteId,
    status: decision.status,
    workerType: decision.workerType || "",
    message: decision.message,
    at: nowIso(),
    metadata: decision.metadata ?? {},
  };
  state.lastDecisions = [
    next,
    ...state.lastDecisions.filter((item) => item.websiteId !== decision.websiteId),
  ].slice(0, 500);
  await writeOrchestrationState(state);
  await appendOrchestrationLog({
    websiteId: decision.websiteId,
    event: decision.event || "decision",
    status: decision.status,
    workerType: decision.workerType,
    message: decision.message,
    metadata: decision.metadata,
  });
  if (decision.workerType) {
    await appendAutomationLog({
      websiteId: decision.websiteId,
      workerType: decision.workerType,
      event: "orchestration_decision",
      message: decision.message,
      metadata: decision.metadata,
    });
  }
  return next;
}

function hasBlockingException(website) {
  return (website.exceptions ?? []).some((exception) => {
    const severity = String(exception.severity ?? "").toLowerCase();
    const status = String(exception.status ?? "open").toLowerCase();
    return ["critical", "high"].includes(severity) && !["resolved", "ignored"].includes(status);
  });
}

async function stopDecision(website) {
  const status = website.factoryStatus;
  if (["qc_failed", "deploy_failed", "lost", "won", "activated", "human_review_required", "unclear_reply", "blocked_safety_flag"].includes(status)) {
    return { status: "stopped", reason: status, message: `Website ${website.websiteId} stopped: ${status}.` };
  }
  if (hasBlockingException(website)) {
    return { status: "blocked", reason: "exception_unresolved", message: `Website ${website.websiteId} blocked: unresolved high-severity exception.` };
  }
  const humanReviewReply = (await listInboundReplies({ websiteId: website.websiteId }))
    .find((reply) => reply.status === "human_review" || reply.classification === "unclear");
  if (humanReviewReply) {
    return { status: "waiting_for_human_review", reason: "unclear_reply", message: `Website ${website.websiteId} waiting for human review: unclear reply.` };
  }
  const timeline = website.timeline ?? [];
  const outreachHumanReview = timeline.some((event) => event.type === "automation_outreach_human_review");
  if (outreachHumanReview) {
    return { status: "waiting_for_human_review", reason: "human_review_required", message: `Website ${website.websiteId} waiting for human review: outreach approval policy did not pass.` };
  }
  return null;
}

async function firstPlannedJob(website) {
  const planners = [
    planPreviewChainJobs,
    planQcDeploymentChainJobs,
    planOutreachChainJobs,
    planReplyRevenueChainJobs,
  ];
  for (const planner of planners) {
    const plan = await planner(website.websiteId);
    const job = (plan.planned ?? []).find((item) => !item.duplicateJobId);
    if (job) return { plan, job };
    const duplicate = (plan.planned ?? []).find((item) => item.duplicateJobId);
    if (duplicate) {
      return {
        plan,
        job: null,
        duplicate,
      };
    }
  }
  return { plan: null, job: null };
}

async function activeJobForWebsite(websiteId) {
  const active = await listAutomationJobs({ limit: 500 });
  return active.find((job) =>
    job.websiteId === websiteId &&
    ["queued", "running", "retry_scheduled"].includes(job.status)
  ) ?? null;
}

export async function decideNextOrchestrationStep(websiteId) {
  const website = await getWebsite(websiteId);
  const stop = await stopDecision(website);
  if (stop) return { website, decision: stop };
  const activeJob = await activeJobForWebsite(websiteId);
  if (activeJob) {
    return {
      website,
      decision: {
        status: "waiting",
        reason: "active_job_exists",
        workerType: activeJob.workerType,
        message: `Website ${websiteId} already has active job ${activeJob.jobId}.`,
        metadata: { jobId: activeJob.jobId },
      },
    };
  }
  const { job, duplicate } = await firstPlannedJob(website);
  if (duplicate) {
    return {
      website,
      decision: {
        status: "duplicate",
        reason: "duplicate_active_job",
        workerType: duplicate.workerType,
        message: `Website ${websiteId} skipped duplicate ${duplicate.workerType}.`,
        metadata: { duplicateJobId: duplicate.duplicateJobId },
      },
    };
  }
  if (!job) {
    return {
      website,
      decision: {
        status: "idle",
        reason: "no_eligible_job",
        message: `Website ${websiteId} has no eligible orchestration job.`,
      },
    };
  }
  return {
    website,
    decision: {
      status: "eligible",
      reason: job.reason,
      workerType: job.workerType,
      message: `Website ${websiteId} eligible for ${job.workerType}: ${job.reason}`,
      metadata: { input: job.input ?? {}, priority: job.priority, leadId: job.leadId },
    },
  };
}

export async function orchestrateWebsite(websiteId, {
  dryRun,
  executeCycles = true,
  maxDepth = MAX_ORCHESTRATION_DEPTH,
  requestedBy = "manual",
} = {}) {
  const config = await getAutomationConfig();
  if (!config.globalEnabled) {
    const decision = {
      websiteId,
      status: "blocked",
      reason: "global_disabled",
      message: `Website ${websiteId} blocked: automation globalEnabled is false.`,
    };
    await recordDecision(decision);
    return { websiteId, status: "blocked", decisions: [decision] };
  }
  const effectiveDryRun = dryRun ?? Boolean(config.dryRun || config.safety?.forceDryRun);
  const depthLimit = clampNumber(maxDepth, MAX_ORCHESTRATION_DEPTH, { min: 1, max: MAX_ORCHESTRATION_DEPTH });
  const lock = await acquireLock(websiteId);
  if (!lock.acquired) {
    const decision = {
      websiteId,
      status: "locked",
      reason: "orchestration_lock",
      message: `Website ${websiteId} is already orchestrating.`,
      metadata: { lockId: lock.lock.lockId },
    };
    await recordDecision(decision);
    return { websiteId, status: "locked", decisions: [decision] };
  }

  const decisions = [];
  try {
    for (let depth = 0; depth < depthLimit; depth += 1) {
      const { decision } = await decideNextOrchestrationStep(websiteId);
      const recorded = await recordDecision({
        websiteId,
        ...decision,
        event: "orchestration_decision",
        metadata: { ...(decision.metadata ?? {}), depth, dryRun: effectiveDryRun },
      });
      decisions.push(recorded);
      if (decision.status !== "eligible") break;
      if (effectiveDryRun) {
        await appendOrchestrationLog({
          websiteId,
          event: "dry_run_enqueue",
          workerType: decision.workerType,
          status: "dry_run",
          message: `Dry-run orchestration would enqueue ${decision.workerType}.`,
          metadata: decision.metadata,
        });
        break;
      }
      if (!config.safety?.allowAutonomousEnqueue) {
        const blocked = await recordDecision({
          websiteId,
          status: "blocked",
          reason: "blocked_safety_flag",
          workerType: decision.workerType,
          message: `Website ${websiteId} blocked: allowAutonomousEnqueue is disabled.`,
          metadata: { depth, requiredFlag: "allowAutonomousEnqueue" },
        });
        decisions.push(blocked);
        break;
      }
      if (!config.stages?.[decision.workerType]) {
        const blocked = await recordDecision({
          websiteId,
          status: "blocked",
          reason: "blocked_safety_flag",
          workerType: decision.workerType,
          message: `Website ${websiteId} blocked: ${decision.workerType} stage is disabled.`,
          metadata: { depth, stage: decision.workerType },
        });
        decisions.push(blocked);
        break;
      }
      const missingSafetyFlags = (WORKER_SAFETY_FLAGS[decision.workerType] ?? [])
        .filter((flag) => !config.safety?.[flag]);
      if (missingSafetyFlags.length) {
        const blocked = await recordDecision({
          websiteId,
          status: "blocked",
          reason: "blocked_safety_flag",
          workerType: decision.workerType,
          message: `Website ${websiteId} blocked: missing safety flag(s) ${missingSafetyFlags.join(", ")}.`,
          metadata: { depth, missingSafetyFlags },
        });
        decisions.push(blocked);
        break;
      }
      const job = await createAutomationJob({
        websiteId,
        leadId: decision.metadata?.leadId,
        workerType: decision.workerType,
        priority: decision.metadata?.priority ?? 50,
        input: {
          ...(decision.metadata?.input ?? {}),
          reason: decision.reason,
          source: "orchestrator",
        },
        dryRun: false,
      });
      await appendOrchestrationLog({
        websiteId,
        event: "job_enqueued",
        workerType: job.workerType,
        status: "enqueued",
        message: `Website ${websiteId} enqueued ${job.workerType}.`,
        metadata: { jobId: job.jobId },
      });
      if (!executeCycles) break;
      const run = await runAutomationCycle({ requestedBy: `orchestrator:${requestedBy}` });
      await appendOrchestrationLog({
        websiteId,
        event: "cycle_completed",
        status: run.status,
        message: `Automation cycle ${run.runId} completed during orchestration.`,
        metadata: {
          runId: run.runId,
          jobsCompleted: run.jobsCompleted,
          jobsFailed: run.jobsFailed,
          errors: run.errors,
        },
      });
      if (run.jobsFailed > 0) break;
    }
  } finally {
    await releaseLock(websiteId, lock.lock.lockId);
  }

  return {
    websiteId,
    status: decisions.at(-1)?.status ?? "unknown",
    decisions,
  };
}

export async function getOrchestratorStatus() {
  const [state, logs, jobs, config] = await Promise.all([
    readOrchestrationState(),
    listOrchestrationLogs({ limit: 50 }),
    listAutomationJobs({ limit: 500 }),
    getAutomationConfig(),
  ]);
  const activeLocks = state.locks.filter((lock) => !lockExpired(lock));
  const blocked = state.lastDecisions.filter((decision) => ["blocked", "stopped"].includes(decision.status));
  const waitingForHumanReview = state.lastDecisions.filter((decision) => decision.status === "waiting_for_human_review");
  return {
    schedulerEnabled: Boolean(config.intervalEnabled),
    globalEnabled: Boolean(config.globalEnabled),
    dryRun: Boolean(config.dryRun || config.safety?.forceDryRun),
    activeLocks,
    activeJobs: jobs.filter((job) => ["queued", "running", "retry_scheduled"].includes(job.status)),
    blocked,
    waitingForHumanReview,
    lastDecisions: state.lastDecisions.slice(0, 50),
    recentLogs: logs,
  };
}
