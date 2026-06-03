import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";

export const WEBSITE_STATE_FILE = join(DATA_DIR, "website-state.json");

export const WEBSITE_FACTORY_STATUSES = [
  "discovered",
  "researching",
  "researched",
  "generating",
  "generated",
  "assets_ready",
  "preview_ready",
  "qc_running",
  "qc_failed",
  "qc_passed",
  "deploying",
  "deployment_pending",
  "deployed",
  "deploy_failed",
  "outreach_drafted",
  "outreach_queued",
  "outreach_sent",
  "reply_received",
  "replied",
  "needs_reconciliation",
  "won",
  "activated",
  "lost",
];

export const WEBSITE_FACTORY_TRANSITIONS = {
  discovered: ["researching", "researched", "generating", "generated", "assets_ready", "preview_ready", "qc_running", "qc_failed", "qc_passed", "deployment_pending", "deploying", "deployed", "deploy_failed", "outreach_drafted", "outreach_queued", "outreach_sent", "reply_received", "replied", "needs_reconciliation", "won", "activated", "lost"],
  researching: ["researched", "discovered"],
  researched: ["generating", "generated", "assets_ready", "preview_ready", "qc_running", "qc_failed", "qc_passed", "deployment_pending", "deploying", "deployed", "deploy_failed", "outreach_drafted", "outreach_queued", "outreach_sent", "reply_received", "replied", "needs_reconciliation", "won", "activated", "lost"],
  generating: ["generated", "assets_ready", "preview_ready", "qc_failed", "generated"],
  generated: ["assets_ready", "preview_ready", "generating", "qc_running", "qc_failed"],
  assets_ready: ["preview_ready", "generated", "qc_running", "qc_failed"],
  preview_ready: ["qc_running", "qc_passed", "qc_failed", "generating"],
  qc_running: ["qc_passed", "qc_failed", "preview_ready"],
  qc_failed: ["generating", "generated", "assets_ready", "preview_ready", "qc_running"],
  qc_passed: ["deployment_pending", "deploying", "deployed", "deploy_failed", "preview_ready", "qc_running"],
  deploying: ["deployment_pending", "deployed", "deploy_failed", "qc_passed"],
  deployment_pending: ["deployed", "deploy_failed", "deploying"],
  deployed: ["outreach_drafted", "outreach_queued", "outreach_sent", "deployment_pending", "deploying", "deploy_failed"],
  deploy_failed: ["deployment_pending", "deploying", "deployed", "qc_passed"],
  outreach_drafted: ["outreach_queued", "outreach_sent", "deployed"],
  outreach_queued: ["outreach_sent", "outreach_drafted"],
  outreach_sent: ["reply_received", "replied", "needs_reconciliation", "won", "lost"],
  reply_received: ["replied", "needs_reconciliation", "lost", "won", "outreach_sent"],
  replied: ["needs_reconciliation", "won", "lost", "activated"],
  needs_reconciliation: ["won", "lost", "activated", "replied"],
  won: ["activated"],
  activated: [],
  lost: [],
};

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function clampStatus(value, fallback = "discovered") {
  const status = cleanText(value);
  return WEBSITE_FACTORY_STATUSES.includes(status) ? status : fallback;
}

function normalizeTransition(transition = {}) {
  return {
    transitionId: cleanText(transition.transitionId) || `state_transition_${randomUUID()}`,
    status: clampStatus(transition.status),
    previousStatus: cleanText(transition.previousStatus),
    at: cleanText(transition.at) || nowIso(),
    source: cleanText(transition.source) || "system",
    notes: cleanText(transition.notes),
    metadata: transition.metadata && typeof transition.metadata === "object" ? transition.metadata : {},
  };
}

function normalizeRecord(record = {}) {
  const now = nowIso();
  const transitions = Array.isArray(record.transitions) ? record.transitions.map(normalizeTransition) : [];
  const fallbackStatus = transitions.at(-1)?.status || "discovered";
  return {
    websiteId: cleanText(record.websiteId),
    factoryStatus: clampStatus(record.factoryStatus, fallbackStatus),
    statusUpdatedAt: cleanText(record.statusUpdatedAt) || transitions.at(-1)?.at || now,
    createdAt: cleanText(record.createdAt) || now,
    updatedAt: cleanText(record.updatedAt) || now,
    retry_count: Math.max(0, Number(record.retry_count) || 0),
    last_failure_reason: cleanText(record.last_failure_reason),
    next_retry_at: cleanText(record.next_retry_at),
    escalation_level: cleanText(record.escalation_level) || "none",
    transitions,
    metadata: record.metadata && typeof record.metadata === "object" ? record.metadata : {},
  };
}

function canTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) return true;
  const allowed = WEBSITE_FACTORY_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

function normalizeState(input = {}) {
  return {
    version: 1,
    records: Array.isArray(input.records) ? input.records.map(normalizeRecord).filter((record) => record.websiteId) : [],
  };
}

async function readState() {
  try {
    return normalizeState(JSON.parse(await readFile(WEBSITE_STATE_FILE, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return { version: 1, records: [] };
    throw err;
  }
}

async function writeState(state) {
  const normalized = normalizeState(state);
  await writeJsonFileSafe(WEBSITE_STATE_FILE, normalized);
  return normalized;
}

export async function listWebsiteFactoryStates() {
  return (await readState()).records;
}

export async function getWebsiteFactoryState(websiteId) {
  return (await listWebsiteFactoryStates()).find((record) => record.websiteId === websiteId) ?? null;
}

export async function setWebsiteFactoryStatus(websiteId, status, { source = "system", notes = "", metadata = {}, recovery = {}, allowInvalidTransition = false } = {}) {
  const cleanWebsiteId = cleanText(websiteId);
  if (!cleanWebsiteId) throw new Error("websiteId is required.");
  const nextStatus = clampStatus(status);
  const state = await readState();
  const index = state.records.findIndex((record) => record.websiteId === cleanWebsiteId);
  const current = index === -1 ? normalizeRecord({ websiteId: cleanWebsiteId }) : state.records[index];
  if (!allowInvalidTransition && !canTransition(current.factoryStatus, nextStatus)) {
    throw new Error(`Invalid Website factory transition: ${current.factoryStatus} -> ${nextStatus}.`);
  }
  const now = nowIso();
  const transition = normalizeTransition({
    status: nextStatus,
    previousStatus: current.factoryStatus,
    at: now,
    source,
    notes,
    metadata,
  });
  const next = normalizeRecord({
    ...current,
    factoryStatus: nextStatus,
    statusUpdatedAt: now,
    updatedAt: now,
    retry_count: recovery.retry_count ?? (nextStatus === "qc_failed" || nextStatus === "deploy_failed" ? current.retry_count : 0),
    last_failure_reason: recovery.last_failure_reason ?? (["qc_failed", "deploy_failed"].includes(nextStatus) ? notes : ""),
    next_retry_at: recovery.next_retry_at ?? "",
    escalation_level: recovery.escalation_level ?? (["qc_failed", "deploy_failed"].includes(nextStatus) ? "human_review" : "none"),
    transitions: [...(current.transitions ?? []), transition].slice(-200),
    metadata: { ...(current.metadata ?? {}), ...metadata },
  });
  if (index === -1) state.records.push(next);
  else state.records[index] = next;
  await writeState(state);
  return next;
}

export async function recordWebsiteFactoryFailure(websiteId, {
  reason = "",
  source = "automation",
  nextRetryAt = "",
  maxAttemptsReached = false,
  metadata = {},
} = {}) {
  const cleanWebsiteId = cleanText(websiteId);
  if (!cleanWebsiteId) throw new Error("websiteId is required.");
  const state = await readState();
  const index = state.records.findIndex((record) => record.websiteId === cleanWebsiteId);
  const current = index === -1 ? normalizeRecord({ websiteId: cleanWebsiteId }) : state.records[index];
  const retryCount = current.retry_count + 1;
  const escalationLevel = maxAttemptsReached ? "human_review" : retryCount >= 2 ? "watch" : "retry";
  const now = nowIso();
  const transition = normalizeTransition({
    status: current.factoryStatus,
    previousStatus: current.factoryStatus,
    at: now,
    source,
    notes: reason,
    metadata: {
      ...metadata,
      recovery: true,
      retry_count: retryCount,
      next_retry_at: cleanText(nextRetryAt),
      escalation_level: escalationLevel,
    },
  });
  const next = normalizeRecord({
    ...current,
    updatedAt: now,
    retry_count: retryCount,
    last_failure_reason: reason,
    next_retry_at: cleanText(nextRetryAt),
    escalation_level: escalationLevel,
    transitions: [...(current.transitions ?? []), transition].slice(-200),
    metadata: { ...(current.metadata ?? {}), ...metadata, lastFailureSource: source },
  });
  if (index === -1) state.records.push(next);
  else state.records[index] = next;
  await writeState(state);
  return next;
}
