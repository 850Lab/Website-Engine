import { getFocusTimeContext } from "./time.js";
import {
  FOCUS_CALL_TARGET,
  getFocus,
  getFocusEvents,
  normalizeFocusMode,
} from "./store.js";
import { buildFocusInventory, ratioLabel, buildLeadDiscoveryCommand } from "./inventory.js";
import { FOCUS_MIN_AVAILABLE } from "./constants.js";

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
  const label = ratioLabel(funnel.calls, baselineComplete);
  const convToSale = formatRatio(funnel.conversations, funnel.sales);
  const callToSale = formatRatio(funnel.calls, funnel.sales);
  const callToConv = formatRatio(funnel.calls, funnel.conversations);
  const estToSale = formatRatio(funnel.estimates, funnel.sales);

  return {
    label,
    currentRatio: label,
    callToConversation: callToConv == null ? null : `${callToConv}:1 ${label}`,
    conversationToSale: convToSale == null ? null : `${convToSale}:1 ${label}`,
    callToSale: callToSale == null ? null : `${callToSale}:1 ${label}`,
    estimateToSale: estToSale == null ? null : `${estToSale}:1 ${label}`,
    hasWorkingRatio: label !== "Not enough data",
  };
}

export async function buildFocusMetrics(modeInput) {
  const mode = normalizeFocusMode(modeInput);
  const focus = await getFocus(mode);
  const events = await getFocusEvents(mode, focus);
  const clock = getFocusTimeContext();
  const inventory = await buildFocusInventory(mode, { replenish: true });

  const funnel = {
    calls: countType(events, "call"),
    conversations: countType(events, "conversation"),
    interested: countType(events, "interested"),
    estimates: countType(events, "estimate"),
    sales: countType(events, "sale"),
    revenue: sumRevenue(events),
  };

  const baselineComplete = funnel.calls >= FOCUS_CALL_TARGET;
  const ratios = buildRatios(funnel, baselineComplete);

  const lowFocusedLeads = inventory.lowInventory;
  const leadDiscovery = inventory.leadDiscovery ?? buildLeadDiscoveryCommand(mode);
  const lowWarning =
    mode === "pressure-washing"
      ? "Not enough focused pressure washing leads available."
      : "Not enough focused website leads available.";

  return {
    mode,
    focus,
    clock,
    inventory,
    baseline: {
      calls: funnel.calls,
      target: FOCUS_CALL_TARGET,
      conversations: funnel.conversations,
      estimates: funnel.estimates,
      sales: funnel.sales,
      currentRatio: ratios.currentRatio,
    },
    progress: {
      current: funnel.calls,
      target: FOCUS_CALL_TARGET,
      label: `${funnel.calls} / ${FOCUS_CALL_TARGET}`,
      remaining: Math.max(0, FOCUS_CALL_TARGET - funnel.calls),
      percent: Math.min(100, Math.round((funnel.calls / FOCUS_CALL_TARGET) * 100)),
    },
    funnel,
    ratios,
    baselineComplete,
    insight: baselineComplete
      ? "Baseline Established."
      : "Stay focused on this one industry, city, and offer until the ratio is clean.",
    queue: {
      matchingCallable: inventory.active,
      matchingTotal: inventory.totalFocused,
      available: inventory.available,
      active: inventory.active,
      lowFocusedLeads,
      warning: lowFocusedLeads ? `${lowWarning} ${inventory.warning || ""}`.trim() : null,
      leadDiscovery,
      queueHref: mode === "pressure-washing" ? "/pw/queue" : "/call-queue",
      inventoryStatus: inventory.status,
    },
    analytics: {
      unlocked: false,
      message: "Complete 100 calls before optimization begins.",
    },
  };
}

export async function buildFocusQueueMeta(modeInput) {
  const mode = normalizeFocusMode(modeInput);
  const focus = await getFocus(mode);
  const inventory = await buildFocusInventory(mode, { replenish: true });
  const clock = getFocusTimeContext();
  const events = await getFocusEvents(mode, focus);
  const callCount = events.filter((event) => event.type === "call").length;
  const lowFocusedLeads = inventory.lowInventory;
  const leadDiscovery = inventory.leadDiscovery ?? buildLeadDiscoveryCommand(mode);
  const lowWarning =
    mode === "pressure-washing"
      ? "Not enough focused pressure washing leads available."
      : "Not enough focused website leads available.";

  return {
    focus,
    clock,
    status: callCount >= FOCUS_CALL_TARGET ? "Baseline Established" : "Baseline Collection",
    inventory,
    matchingCallable: inventory.active,
    matchingTotal: inventory.totalFocused,
    available: inventory.available,
    active: inventory.active,
    callable: inventory.callableFocused,
    lowFocusedLeads,
    warning: lowFocusedLeads ? `${lowWarning} ${inventory.warning || ""}`.trim() : null,
    leadDiscovery,
    inventoryStatus: inventory.status,
    minAvailable: FOCUS_MIN_AVAILABLE,
  };
}
