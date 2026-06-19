import { cleanText } from "../stage1/shared.js";
import {
  buildPwQueueHealth,
  getActiveQueueLeads,
  getNextPwLeadId,
  isFollowUpDue,
  listPwLeads,
  mergePwLeadActions,
  refreshPwQueue,
} from "./lead-store.js";
import { priorityLabel } from "./scoring.js";
import { pwStatusLabel } from "./statuses.js";
import { isFoodIndustry } from "./industries.js";

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isToday(iso) {
  if (!iso) return false;
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t >= startOfToday();
}

function isDue(iso) {
  if (!iso) return false;
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t <= Date.now();
}

function aggregatePwDaily(leads) {
  let callsToday = 0;
  let conversationsToday = 0;
  let interestedToday = 0;
  let estimatesNeeded = 0;
  let estimatesSent = 0;
  let followUpsDue = 0;
  let jobsWon = 0;
  let jobsWonToday = 0;
  let revenueQuoted = 0;
  let revenueWon = 0;
  let revenueWonToday = 0;

  for (const lead of leads) {
    if (isToday(lead.lastContactedAt)) callsToday += 1;
    if (isToday(lead.lastConversationAt)) conversationsToday += 1;
    if (lead.status === "interested" && isToday(lead.updatedAt)) interestedToday += 1;
    if (lead.status === "estimate_needed") estimatesNeeded += 1;
    if (lead.status === "estimate_sent") estimatesSent += 1;
    if (isFollowUpDue(lead)) followUpsDue += 1;
    if (lead.status === "won" || lead.queueState === "won") {
      jobsWon += 1;
      revenueWon += Number(lead.revenueWon) || Number(lead.estimateAmount) || 0;
      if (isToday(lead.wonAt || lead.updatedAt)) {
        jobsWonToday += 1;
        revenueWonToday += Number(lead.revenueWon) || Number(lead.estimateAmount) || 0;
      }
    }
    if (["estimate_sent", "interested"].includes(lead.status)) {
      revenueQuoted += Number(lead.estimateAmount) || 0;
    }
  }

  return {
    callsToday,
    conversationsToday,
    interestedToday,
    estimatesNeeded,
    estimatesSent,
    followUpsDue,
    jobsWon,
    jobsWonToday,
    revenueQuoted,
    revenueWon,
    revenueWonToday,
  };
}

export function aggregatePwDailyForLeads(leads) {
  return aggregatePwDaily(leads);
}

export function filterQueueByView(queue, view) {
  const v = cleanText(view).toLowerCase();
  if (v === "follow-ups" || v === "followups") {
    return queue.filter((l) => isFollowUpDue(l));
  }
  if (v === "estimates") {
    return queue.filter((l) => ["estimate_needed", "estimate_sent"].includes(l.status));
  }
  return queue;
}

export async function buildPwDashboard() {
  const leads = await listPwLeads();
  const queue = await getActiveQueueLeads();
  const daily = aggregatePwDaily(leads);
  const industryStats = {};

  for (const lead of leads) {
    const ind = cleanText(lead.industry) || "Other";
    if (!industryStats[ind]) industryStats[ind] = { industry: ind, contacted: 0, interested: 0 };
    if (lead.status !== "new") industryStats[ind].contacted += 1;
    if (lead.status === "interested" || lead.status === "won") industryStats[ind].interested += 1;
  }

  const bestIndustries = Object.values(industryStats)
    .filter((row) => row.contacted > 0)
    .sort((a, b) => b.interested - a.interested || b.contacted - a.contacted)
    .slice(0, 5);

  const nextLead = queue[0] ? mergePwLeadActions(queue[0]) : null;

  return {
    daily: {
      ...daily,
      callableLeads: queue.length,
    },
    bestIndustries,
    nextLead: nextLead
      ? {
          id: nextLead.id,
          businessName: nextLead.businessName,
          city: nextLead.city,
          industry: nextLead.industry,
          phone: nextLead.phone,
          priorityScore: nextLead.priorityScore,
          priorityLabel: priorityLabel(nextLead.priorityScore),
          angle: nextLead.pressureWashingAngle,
          offer: nextLead.offer,
          callUrl: nextLead.actions.call,
        }
      : null,
    foodLeadCount: leads.filter((l) => isFoodIndustry(l.industry)).length,
    totalLeads: leads.length,
  };
}

export async function buildPwQueueDailyMetrics() {
  const leads = await listPwLeads();
  const queue = await getActiveQueueLeads();
  return {
    ...aggregatePwDaily(leads),
    callableLeads: queue.length,
  };
}

export function formatPwLeadForQueue(lead, { isNextBestLead = false } = {}) {
  const merged = mergePwLeadActions(lead);
  return {
    ...merged,
    priorityLabel: priorityLabel(merged.priorityScore),
    statusLabel: pwStatusLabel(merged.status),
    queueStateLabel: merged.queueState,
    followUpDue: isDue(merged.nextFollowUpAt),
    isNextBestLead,
    lastContactResultLabel: merged.lastContactResult
      ? pwStatusLabel(merged.lastContactResult)
      : "",
  };
}

export async function buildPwQueueStats() {
  const leads = await listPwLeads();
  const queue = await getActiveQueueLeads();
  const health = await buildPwQueueHealth();
  return {
    total: leads.length,
    callable: queue.length,
    followUpsDue: health.followUpDue,
    won: health.won,
    active: health.active,
    available: health.available,
  };
}

export async function buildPwQueueResponse(leadId = null, { view = "" } = {}) {
  const fullQueue = await getActiveQueueLeads();
  const queue = filterQueueByView(fullQueue, view);
  const allLeads = await listPwLeads();
  const health = await buildPwQueueHealth();
  const nextBestId = queue[0]?.id ?? fullQueue[0]?.id ?? null;

  let record = null;
  if (leadId) {
    record =
      queue.find((l) => l.id === cleanText(leadId)) ??
      fullQueue.find((l) => l.id === cleanText(leadId)) ??
      allLeads.find((l) => l.id === cleanText(leadId)) ??
      null;
  } else {
    record = queue[0] ?? null;
  }

  if (!record) {
    return {
      lead: null,
      nextId: null,
      stats: await buildPwQueueStats(),
      daily: await buildPwQueueDailyMetrics(),
      health,
      view: cleanText(view) || null,
    };
  }

  const inQueue = queue.some((l) => l.id === record.id);
  const displayRecord = inQueue ? record : queue[0] ?? record;
  const nextId = getNextPwLeadId(queue, displayRecord.id);

  return {
    lead: formatPwLeadForQueue(displayRecord, { isNextBestLead: displayRecord.id === nextBestId }),
    nextId,
    stats: await buildPwQueueStats(),
    daily: await buildPwQueueDailyMetrics(),
    health,
    view: cleanText(view) || null,
  };
}

export { buildPwQueueHealth, refreshPwQueue };
