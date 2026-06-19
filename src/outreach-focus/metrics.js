import { listQualifiedBusinesses } from "../stage1/qualified-business-store.js";
import { listPwLeads, getActiveQueueLeads } from "../pressure-washing/lead-store.js";
import { getFocusTimeContext } from "./time.js";
import {
  FOCUS_CALL_TARGET,
  eventMatchesFocus,
  getFocus,
  getFocusEvents,
  leadMatchesFocus,
  normalizeFocusMode,
} from "./store.js";

function countType(events, type) {
  return events.filter((event) => event.type === type).length;
}

function sumRevenue(events) {
  return events
    .filter((event) => event.type === "sale")
    .reduce((sum, event) => sum + (Number(event.revenue) || 0), 0);
}

function formatRatio(numerator, denominator) {
  if (!denominator || !numerator) return null;
  return Math.round((numerator / denominator) * 10) / 10;
}

function buildRatios(funnel, baselineComplete) {
  const label = baselineComplete ? "Baseline established" : "Early read";
  const convToSale = formatRatio(funnel.conversations, funnel.sales);
  const callToSale = formatRatio(funnel.calls, funnel.sales);
  const callToConv = formatRatio(funnel.calls, funnel.conversations);
  const estToSale = formatRatio(funnel.estimates, funnel.sales);

  return {
    label,
    callToConversation: callToConv == null ? null : `${callToConv}:1 ${label.toLowerCase()}`,
    conversationToSale: convToSale == null ? null : `${convToSale}:1 ${label.toLowerCase()}`,
    callToSale: callToSale == null ? null : `${callToSale}:1 ${label.toLowerCase()}`,
    estimateToSale: estToSale == null ? null : `${estToSale}:1 ${label.toLowerCase()}`,
  };
}

function rankField(events, field) {
  const map = {};
  for (const event of events) {
    if (!["call", "conversation", "sale"].includes(event.type)) continue;
    const key = event[field] || "Unknown";
    if (!map[key]) map[key] = { calls: 0, conversations: 0, sales: 0 };
    if (event.type === "call") map[key].calls += 1;
    if (event.type === "conversation") map[key].conversations += 1;
    if (event.type === "sale") map[key].sales += 1;
  }
  return Object.entries(map)
    .map(([key, stats]) => ({ key, ...stats }))
    .sort((a, b) => b.calls - a.calls || b.sales - a.sales);
}

function buildRecommendations(funnel) {
  const recs = ["continue this focus"];
  if (funnel.sales === 0 && funnel.calls >= FOCUS_CALL_TARGET) recs.push("adjust offer");
  if (funnel.conversations > 0 && funnel.sales === 0) recs.push("review close script");
  return recs;
}

async function countMatchingLeads(mode, focus) {
  if (mode === "pressure-washing") {
    const [all, active] = await Promise.all([listPwLeads(), getActiveQueueLeads()]);
    const callable = active.filter((lead) => lead.hasPhone !== false && lead.phone);
    return {
      total: all.length,
      matchingTotal: all.filter((lead) => leadMatchesFocus(lead, focus)).length,
      matchingCallable: callable.filter((lead) => leadMatchesFocus(lead, focus)).length,
      callable: callable.length,
    };
  }

  const records = await listQualifiedBusinesses();
  const callable = records.filter((row) => row.phone || row.normalizedPhone);
  return {
    total: records.length,
    matchingTotal: records.filter((row) => leadMatchesFocus(row, focus)).length,
    matchingCallable: callable.filter((row) => leadMatchesFocus(row, focus)).length,
    callable: callable.length,
  };
}

export async function buildFocusMetrics(modeInput) {
  const mode = normalizeFocusMode(modeInput);
  const focus = await getFocus(mode);
  const events = await getFocusEvents(mode, focus);
  const clock = getFocusTimeContext();
  const counts = await countMatchingLeads(mode, focus);

  const funnel = {
    calls: countType(events, "call"),
    conversations: countType(events, "conversation"),
    interested: countType(events, "interested"),
    estimates: countType(events, "estimate"),
    sales: countType(events, "sale"),
    revenue: sumRevenue(events),
  };

  const baselineComplete = funnel.calls >= FOCUS_CALL_TARGET;
  const averageTicket = funnel.sales > 0 ? Math.round(funnel.revenue / funnel.sales) : null;

  const lowFocusedLeads = counts.matchingCallable < 5;
  const leadDiscovery =
    mode === "pressure-washing"
      ? { command: "npm run pw:find-leads -- --scrape", label: "Find focused PW leads" }
      : { command: "npm run website:pack", label: "Generate website previews for focused industry/city" };

  return {
    mode,
    focus,
    clock,
    progress: {
      current: funnel.calls,
      target: FOCUS_CALL_TARGET,
      label: `${funnel.calls} / ${FOCUS_CALL_TARGET}`,
      remaining: Math.max(0, FOCUS_CALL_TARGET - funnel.calls),
      percent: Math.min(100, Math.round((funnel.calls / FOCUS_CALL_TARGET) * 100)),
    },
    funnel,
    ratios: buildRatios(funnel, baselineComplete),
    baselineComplete,
    insight: baselineComplete
      ? "Baseline established."
      : "Stay focused. Complete 100 calls for this setup before changing variables.",
    queue: {
      ...counts,
      lowFocusedLeads,
      warning: lowFocusedLeads
        ? "You are low on focused leads."
        : null,
      leadDiscovery,
      queueHref: mode === "pressure-washing" ? "/pw/queue" : "/call-queue",
    },
    analytics: baselineComplete
      ? {
          unlocked: true,
          byDayOfWeek: rankField(events, "dayOfWeek"),
          byTimeBucket: rankField(events, "timeBucket"),
          byIndustry: rankField(events, "industry"),
          byCity: rankField(events, "city"),
          byOffer: rankField(events, "offer"),
          bySalesperson: rankField(events, "salesperson"),
          recommendations: buildRecommendations(funnel),
          averageTicket,
        }
      : {
          unlocked: false,
          message: "Complete 100 calls before optimization begins.",
        },
  };
}

export async function buildFocusQueueMeta(modeInput) {
  const mode = normalizeFocusMode(modeInput);
  const focus = await getFocus(mode);
  const counts = await countMatchingLeads(mode, focus);
  const lowFocusedLeads = counts.matchingCallable < 5;
  const leadDiscovery =
    mode === "pressure-washing"
      ? { command: "npm run pw:find-leads -- --scrape", label: "Find focused PW leads" }
      : { command: "npm run website:pack", label: "Generate website previews for focused industry/city" };

  return {
    focus,
    ...counts,
    matchingCallable: counts.matchingCallable,
    callable: counts.callable,
    lowFocusedLeads,
    warning: lowFocusedLeads ? "You are low on focused leads." : null,
    leadDiscovery,
  };
}
