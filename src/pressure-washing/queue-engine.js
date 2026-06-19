import { buildDedupKeys } from "../discovery/dedup.js";
import { cleanText, nowIso } from "../stage1/shared.js";
import { isFoodIndustry, isTargetCity } from "./industries.js";
import { isFollowUpDue } from "./queue-state.js";
import {
  ACTIVE_BATCH_SIZE,
  isVisibleInActiveQueue,
  makeBatchId,
  resolveQueueState,
} from "./queue-state.js";

/** Sort available pool for promotion into active batch. */
export function sortAvailableForPromotion(leads) {
  return [...leads].sort((a, b) => {
    if (isFollowUpDue(a) !== isFollowUpDue(b)) return isFollowUpDue(a) ? -1 : 1;

    const scoreDiff = (b.priorityScore || 0) - (a.priorityScore || 0);
    if (scoreDiff) return scoreDiff;

    const foodDiff = Number(isFoodIndustry(b.industry)) - Number(isFoodIndustry(a.industry));
    if (foodDiff) return foodDiff;

    const cityDiff = Number(isTargetCity(b.city)) - Number(isTargetCity(a.city));
    if (cityDiff) return cityDiff;

    const aDisc = Date.parse(a.discoveredAt || a.createdAt) || 0;
    const bDisc = Date.parse(b.discoveredAt || b.createdAt) || 0;
    return aDisc - bDisc;
  });
}

/** Sort working queue for display. */
export function sortActiveQueue(leads) {
  function tier(lead) {
    if (isFollowUpDue(lead)) return 1;
    if (lead.status === "interested") return 2;
    if (lead.status === "estimate_needed") return 3;
    if (lead.status === "new") return 5;
    return 4;
  }

  return [...leads].sort((a, b) => {
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return ta - tb;
    if (ta === 1) return Date.parse(a.nextFollowUpAt) - Date.parse(b.nextFollowUpAt);
    if (ta === 5) return Date.parse(a.discoveredAt || a.createdAt) - Date.parse(b.discoveredAt || b.createdAt);
    const rankDiff = (a.batchRank || 999) - (b.batchRank || 999);
    if (rankDiff) return rankDiff;
    return (b.priorityScore || 0) - (a.priorityScore || 0);
  });
}

export function buildActiveQueue(leads) {
  return sortActiveQueue(leads.filter(isVisibleInActiveQueue));
}

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isToday(iso) {
  if (!iso) return false;
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t >= startOfToday();
}

export function summarizeQueueHealth(leads, { lastUpdatedAt = null } = {}) {
  const available = leads.filter((l) => l.queueState === "available").length;
  const active = leads.filter((l) => l.queueState === "active").length;
  const followUpDue = leads.filter((l) => l.queueState === "follow_up" && isFollowUpDue(l)).length;
  const completedToday = leads.filter(
    (l) => l.queueState === "completed" && isToday(l.updatedAt),
  ).length;
  const won = leads.filter((l) => l.queueState === "won").length;
  const lost = leads.filter((l) => l.queueState === "lost").length;
  const suppressed = leads.filter((l) => l.queueState === "suppressed").length;
  const needsReplenishment = active < ACTIVE_BATCH_SIZE && available > 0;
  const nextBatchSize = Math.min(ACTIVE_BATCH_SIZE - active, available);

  return {
    totalLeads: leads.length,
    available,
    active,
    followUpDue,
    completedToday,
    won,
    lost,
    suppressed,
    needsReplenishment,
    nextBatchSize,
    activeBatchTarget: ACTIVE_BATCH_SIZE,
    lastUpdatedAt,
  };
}

export function planBatchPromotion(leads, { matchLead = null } = {}) {
  const inFocus = matchLead || (() => true);

  const activeCount = leads.filter((l) => l.queueState === "active" && inFocus(l)).length;
  const need = Math.max(0, ACTIVE_BATCH_SIZE - activeCount);
  if (!need) return { need: 0, toPromote: [], batchId: null };

  const available = sortAvailableForPromotion(
    leads.filter(
      (l) =>
        l.queueState === "available" &&
        l.callable !== false &&
        (l.normalizedPhone || l.phone) &&
        inFocus(l),
    ),
  );

  return {
    need,
    toPromote: available.slice(0, need),
    batchId: makeBatchId(),
    activeCount,
  };
}

export function applyBatchPromotion(leads, plan) {
  if (!plan.toPromote.length) return leads;

  const now = nowIso();
  const next = [...leads];

  plan.toPromote.forEach((lead, index) => {
    const idx = next.findIndex((row) => row.id === lead.id);
    if (idx === -1) return;
    next[idx] = {
      ...next[idx],
      queueState: "active",
      assignedBatchId: plan.batchId,
      batchRank: plan.activeCount + index + 1,
      addedToQueueAt: now,
      updatedAt: now,
    };
  });

  return next;
}

export function leadDedupKey(lead = {}) {
  const keys = buildDedupKeys(lead);
  const exact = keys.find((k) => k.strength === "exact");
  return exact?.key ?? keys[0]?.key ?? null;
}

export { resolveQueueState };
