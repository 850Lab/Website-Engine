import { cleanText, nowIso } from "../stage1/shared.js";
import { normalizePwStatus } from "./statuses.js";

export function isFollowUpDue(lead) {
  if (!lead?.nextFollowUpAt) return false;
  const t = Date.parse(lead.nextFollowUpAt);
  return !Number.isNaN(t) && t <= Date.now();
}

export const PW_QUEUE_STATES = [
  "available",
  "active",
  "completed",
  "follow_up",
  "won",
  "lost",
  "suppressed",
];

export const ACTIVE_BATCH_SIZE = 25;
export const NO_ANSWER_FOLLOW_UP_THRESHOLD = 3;

export function normalizeQueueState(value) {
  const raw = cleanText(value).toLowerCase().replace(/\s+/g, "_");
  return PW_QUEUE_STATES.includes(raw) ? raw : "";
}

export function inferQueueStateFromLegacy(lead = {}) {
  const status = normalizePwStatus(lead.status);
  if (status === "won") return "won";
  if (status === "lost") return "lost";
  if (status === "not_interested") return "suppressed";
  if (status === "follow_up") return "follow_up";
  if (isFollowUpDue(lead)) return "follow_up";
  if (["interested", "called", "no_answer", "gatekeeper", "estimate_needed", "estimate_sent"].includes(status)) {
    if (lead.nextFollowUpAt && !isFollowUpDue(lead)) return "follow_up";
    return "active";
  }
  return "available";
}

export function resolveQueueState(input = {}, lead = {}) {
  const explicit = normalizeQueueState(input.queueState ?? lead.queueState);
  if (explicit) return explicit;
  return inferQueueStateFromLegacy({ ...lead, ...input });
}

export function defaultFollowUpIso(days = 3) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Map website outcome action → queueState + optional follow-up default. */
export function applyOutcomeQueueState(lead, { actionId, status, callAttempts, nextFollowUpAt } = {}) {
  const key = actionId || status || lead.status;

  if (key === "won") return { queueState: "won" };
  if (key === "lost") return { queueState: "lost" };
  if (key === "not_interested") return { queueState: "suppressed" };

  if (key === "no_answer") {
    if (callAttempts >= NO_ANSWER_FOLLOW_UP_THRESHOLD) {
      return {
        queueState: "follow_up",
        nextFollowUpAt: nextFollowUpAt || defaultFollowUpIso(3),
        status: "follow_up",
      };
    }
    return { queueState: "active" };
  }

  if (key === "called") return { queueState: "active" };

  if (["gatekeeper", "interested", "estimate_needed", "estimate_sent", "follow_up"].includes(key)) {
    return {
      queueState: "follow_up",
      nextFollowUpAt: nextFollowUpAt || lead.nextFollowUpAt || defaultFollowUpIso(3),
    };
  }

  return { queueState: lead.queueState || "active" };
}

export function isVisibleInActiveQueue(lead) {
  if (lead.callable === false) return false;
  if (!lead.normalizedPhone && !lead.phone) return false;
  if (lead.queueState === "active") return true;
  if (lead.queueState === "follow_up" && isFollowUpDue(lead)) return true;
  return false;
}

export function makeBatchId() {
  return `batch_${nowIso().slice(0, 10)}_${Date.now()}`;
}
