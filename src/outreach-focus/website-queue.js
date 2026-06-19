import { cleanText, nowIso } from "../stage1/shared.js";
import {
  listQualifiedBusinesses,
  upsertQualifiedBusiness,
} from "../stage1/qualified-business-store.js";
import { getAngleAnalysisStore } from "../angle-analysis/store.js";
import { leadMatchesFocus } from "./store.js";
import { hasCallablePhone } from "./matching.js";
import { FOCUS_TARGET_ACTIVE } from "./constants.js";

export const WEBSITE_QUEUE_STATES = [
  "available",
  "active",
  "follow_up",
  "won",
  "lost",
  "suppressed",
];

function normalizeWebsiteQueueState(value) {
  const raw = cleanText(value).toLowerCase().replace(/\s+/g, "_");
  return WEBSITE_QUEUE_STATES.includes(raw) ? raw : "";
}

function inferWebsiteQueueState(record = {}) {
  const explicit = normalizeWebsiteQueueState(record.websiteQueueState);
  if (explicit) return explicit;

  const status = cleanText(record.outreachStatus).toLowerCase();
  if (status === "won") return "won";
  if (status === "lost") return "lost";
  if (status && status !== "not_contacted") return "active";
  return "available";
}

export function isCallableWebsiteLead(record) {
  if (record.callable === false) return false;
  return hasCallablePhone(record);
}

export function isVisibleInWebsiteActiveQueue(record) {
  if (!isCallableWebsiteLead(record)) return false;
  const state = inferWebsiteQueueState(record);
  if (state === "active") return true;
  if (state === "follow_up" && record.nextFollowUpAt) {
    const t = Date.parse(record.nextFollowUpAt);
    return !Number.isNaN(t) && t <= Date.now();
  }
  return false;
}

function priorityRank(record, analysisMap) {
  const analysis = analysisMap[record.id];
  const label = analysis?.priority_label ?? "Manual Review";
  const rank = { Hot: 0, Warm: 1, Nurture: 2, "Manual Review": 3 }[label] ?? 9;
  const score = Number(analysis?.priority_score) || 0;
  const status = cleanText(record.outreachStatus) || "not_contacted";
  const outcomeRank = {
    not_contacted: 0,
    contacted: 1,
    replied: 2,
    asked_price: 3,
    appointment: 4,
    won: 5,
    lost: 6,
  }[status] ?? 9;
  return { rank, score, outcomeRank };
}

function sortAvailableForPromotion(records, analysisMap) {
  return [...records].sort((a, b) => {
    const pa = priorityRank(a, analysisMap);
    const pb = priorityRank(b, analysisMap);
    if (pa.rank !== pb.rank) return pa.rank - pb.rank;
    if (pb.score !== pa.score) return pb.score - pa.score;
    if (pa.outcomeRank !== pb.outcomeRank) return pa.outcomeRank - pb.outcomeRank;
    return String(a.businessName).localeCompare(String(b.businessName));
  });
}

export async function countWebsiteFocusInventory(focus) {
  const [records, store] = await Promise.all([listQualifiedBusinesses(), getAngleAnalysisStore()]);
  const focused = records.filter((row) => leadMatchesFocus(row, focus));
  const callable = focused.filter(isCallableWebsiteLead);

  let available = 0;
  let active = 0;

  for (const row of callable) {
    const state = inferWebsiteQueueState(row);
    if (state === "available") available += 1;
    if (state === "active") active += 1;
    if (state === "follow_up" && row.nextFollowUpAt) {
      const t = Date.parse(row.nextFollowUpAt);
      if (!Number.isNaN(t) && t <= Date.now()) active += 1;
    }
  }

  return {
    totalFocused: focused.length,
    callableFocused: callable.length,
    available,
    active,
  };
}

export async function replenishWebsiteActiveQueue(focus) {
  const [records, store] = await Promise.all([listQualifiedBusinesses(), getAngleAnalysisStore()]);
  const analysisMap = store.analyses ?? {};
  const now = nowIso();

  const focusedCallable = records.filter(
    (row) => leadMatchesFocus(row, focus) && isCallableWebsiteLead(row),
  );

  const withState = focusedCallable.map((row) => ({
    ...row,
    websiteQueueState: inferWebsiteQueueState(row),
  }));

  const activeCount = withState.filter((row) => isVisibleInWebsiteActiveQueue(row)).length;
  const need = Math.max(0, FOCUS_TARGET_ACTIVE - activeCount);
  if (!need) return { promoted: 0, active: activeCount, available: 0 };

  const availablePool = sortAvailableForPromotion(
    withState.filter((row) => inferWebsiteQueueState(row) === "available"),
    analysisMap,
  );

  const toPromote = availablePool.slice(0, need);
  if (!toPromote.length) {
    return {
      promoted: 0,
      active: activeCount,
      available: availablePool.length,
    };
  }

  const promoteIds = new Set(toPromote.map((row) => row.id));
  let promoted = 0;

  for (const record of records) {
    if (!promoteIds.has(record.id)) continue;
    await upsertQualifiedBusiness({
      ...record,
      websiteQueueState: "active",
      websiteQueuePromotedAt: now,
      updatedAt: now,
    });
    promoted += 1;
  }

  const after = await countWebsiteFocusInventory(focus);
  return { promoted, active: after.active, available: after.available };
}

export async function listWebsiteActiveLeads(focus) {
  await replenishWebsiteActiveQueue(focus);
  const records = await listQualifiedBusinesses();
  return records.filter((row) => leadMatchesFocus(row, focus) && isVisibleInWebsiteActiveQueue(row));
}
