import { listPwLeads, replenishFocusActiveBatch } from "../pressure-washing/lead-store.js";
import { leadMatchesFocus, normalizeFocusMode, getFocus } from "./store.js";
import { hasCallablePhone } from "./matching.js";
import { countWebsiteFocusInventory, replenishWebsiteActiveQueue } from "./website-queue.js";
import { FOCUS_MIN_AVAILABLE, FOCUS_TARGET_ACTIVE } from "./constants.js";

export { FOCUS_MIN_AVAILABLE, FOCUS_TARGET_ACTIVE };

export function inventoryStatus(available) {
  const count = Number(available) || 0;
  if (count >= FOCUS_MIN_AVAILABLE) return "Healthy";
  if (count >= 25) return "Low Inventory";
  return "Critical Inventory";
}

export function ratioLabel(calls, baselineComplete) {
  if (baselineComplete) return "Baseline Established";
  if ((Number(calls) || 0) < 10) return "Not enough data";
  return "Early Read";
}

export function buildLeadDiscoveryCommand(mode) {
  if (normalizeFocusMode(mode) === "pressure-washing") {
    return {
      command: "npm run pw:find-leads -- --scrape",
      label: "Scrape Google Maps for focused restaurant leads in Beaumont",
    };
  }
  return {
    command: "npm run website:find-leads -- --scrape",
    label: "Scrape Google Maps for focused fence company leads in Beaumont",
  };
}

function inventoryWarning(status, available) {
  if (status === "Healthy") return null;
  const modeLabel = available < 25 ? "Critical" : "Low";
  return `${modeLabel} focused lead inventory — ${available} available (target ${FOCUS_MIN_AVAILABLE}).`;
}

export async function buildFocusInventory(modeInput, { replenish = true } = {}) {
  const mode = normalizeFocusMode(modeInput);
  const focus = await getFocus(mode);

  if (replenish) {
    if (mode === "pressure-washing") {
      await replenishFocusActiveBatch(focus);
    } else {
      await replenishWebsiteActiveQueue(focus);
    }
  }

  if (mode === "pressure-washing") {
    const leads = await listPwLeads();
    const focused = leads.filter((lead) => leadMatchesFocus(lead, focus));
    const callable = focused.filter((lead) => hasCallablePhone(lead) && lead.callable !== false);
    const available = callable.filter((lead) => lead.queueState === "available").length;
    const active = callable.filter(
      (lead) =>
        lead.queueState === "active" ||
        (lead.queueState === "follow_up" && lead.nextFollowUpAt && Date.parse(lead.nextFollowUpAt) <= Date.now()),
    ).length;
    const status = inventoryStatus(available);

    return {
      mode,
      focus,
      available,
      active,
      totalFocused: focused.length,
      callableFocused: callable.length,
      targets: { available: FOCUS_MIN_AVAILABLE, active: FOCUS_TARGET_ACTIVE },
      status,
      lowInventory: available < FOCUS_MIN_AVAILABLE,
      needsReplenishment: active < FOCUS_TARGET_ACTIVE && available > 0,
      warning: inventoryWarning(status, available),
      leadDiscovery: buildLeadDiscoveryCommand(mode),
    };
  }

  const counts = await countWebsiteFocusInventory(focus);
  const status = inventoryStatus(counts.available);

  return {
    mode,
    focus,
    available: counts.available,
    active: counts.active,
    totalFocused: counts.totalFocused,
    callableFocused: counts.callableFocused,
    targets: { available: FOCUS_MIN_AVAILABLE, active: FOCUS_TARGET_ACTIVE },
    status,
    lowInventory: counts.available < FOCUS_MIN_AVAILABLE,
    needsReplenishment: counts.active < FOCUS_TARGET_ACTIVE && counts.available > 0,
    warning: inventoryWarning(status, counts.available),
    leadDiscovery: buildLeadDiscoveryCommand(mode),
  };
}
