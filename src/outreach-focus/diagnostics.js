import { listQualifiedBusinesses } from "../stage1/qualified-business-store.js";
import { listPwLeads } from "../pressure-washing/lead-store.js";
import { getFocus, normalizeFocusMode } from "./store.js";
import {
  evaluateFocusMatch,
  industryMatchesLead,
  cityMatchesLead,
  hasCallablePhone,
} from "./matching.js";
import { countWebsiteFocusInventory } from "./website-queue.js";
import { FOCUS_MIN_AVAILABLE, FOCUS_TARGET_ACTIVE } from "./constants.js";
import { cleanText } from "../stage1/shared.js";

function sampleRejections(rows, focus, limit = 10) {
  const samples = [];
  for (const row of rows) {
    if (samples.length >= limit) break;
    const evalResult = evaluateFocusMatch(row, focus);
    if (evalResult.matches) continue;
    samples.push({
      id: row.id,
      businessName: row.businessName,
      industry: row.industry || row.category,
      city: row.city,
      address: row.address,
      phone: row.phone || row.normalizedPhone || null,
      callable: hasCallablePhone(row),
      reasons: evalResult.reasons,
    });
  }
  return samples;
}

function countWebsiteQueueState(records, focus) {
  const focused = records.filter((row) => evaluateFocusMatch(row, focus).matches);
  const callable = focused.filter(hasCallablePhone);
  const noPhone = focused.filter((row) => !hasCallablePhone(row));

  let available = 0;
  let active = 0;
  let otherState = 0;

  for (const row of callable) {
    const state = cleanText(row.websiteQueueState).toLowerCase();
    if (state === "available" || (!state && cleanText(row.outreachStatus) === "not_contacted")) available += 1;
    else if (state === "active") active += 1;
    else otherState += 1;
  }

  return { focused, callable, noPhone, available, active, otherState };
}

export async function buildFocusedInventoryDebug(modeInput) {
  const mode = normalizeFocusMode(modeInput);
  const focus = await getFocus(mode);

  if (mode === "pressure-washing") {
    const leads = await listPwLeads();
    const total = leads.length;

    let industryMatch = 0;
    let cityMatch = 0;
    let focusMatch = 0;
    let callableFocus = 0;
    let available = 0;
    let active = 0;
    let rejectedPhone = 0;
    let rejectedIndustry = 0;
    let rejectedCity = 0;
    let rejectedQueue = 0;

    const rejectedSamples = [];

    for (const lead of leads) {
      const indOk = industryMatchesLead(lead, focus.industry);
      const cityResult = cityMatchesLead(lead, focus.city, { searchCity: lead.sourceQuery });
      const evalResult = evaluateFocusMatch(lead, focus, { searchCity: lead.sourceQuery });

      if (indOk) industryMatch += 1;
      else {
        rejectedIndustry += 1;
        if (rejectedSamples.length < 10) {
          rejectedSamples.push({
            id: lead.id,
            businessName: lead.businessName,
            reason: "industry_mismatch",
            industry: lead.industry,
            city: lead.city,
          });
        }
      }

      if (cityResult.matches) cityMatch += 1;
      else if (indOk) {
        rejectedCity += 1;
        if (rejectedSamples.length < 10) {
          rejectedSamples.push({
            id: lead.id,
            businessName: lead.businessName,
            reason: cityResult.reason,
            industry: lead.industry,
            city: lead.city,
            address: lead.address,
          });
        }
      }

      if (evalResult.matches) {
        focusMatch += 1;
        if (hasCallablePhone(lead)) {
          callableFocus += 1;
          if (lead.queueState === "available") available += 1;
          else if (lead.queueState === "active") active += 1;
          else rejectedQueue += 1;
        } else {
          rejectedPhone += 1;
        }
      }
    }

    return {
      mode,
      focus,
      totals: {
        totalLeads: total,
        industryMatches: industryMatch,
        cityMatches: cityMatch,
        focusMatches: focusMatch,
        callableFocusMatches: callableFocus,
        availableFocused: available,
        activeFocused: active,
        noPhoneFocused: focusMatch - callableFocus,
      },
      rejected: {
        byIndustry: rejectedIndustry,
        byCity: rejectedCity,
        byPhone: rejectedPhone,
        byQueueState: rejectedQueue,
      },
      targets: { available: FOCUS_MIN_AVAILABLE, active: FOCUS_TARGET_ACTIVE },
      inventoryExhausted: focusMatch < FOCUS_MIN_AVAILABLE,
      exhaustedMessage:
        focusMatch < FOCUS_MIN_AVAILABLE ? "Beaumont focused inventory is exhausted." : null,
      inventoryMessage:
        focusMatch < FOCUS_MIN_AVAILABLE
          ? `Beaumont focused inventory is low (${focusMatch} focused total, ${callableFocus} callable). Run npm run pw:find-leads -- --scrape`
          : null,
      samples: { rejected: rejectedSamples },
    };
  }

  const records = await listQualifiedBusinesses();
  const total = records.length;
  let industryMatch = 0;
  let cityMatch = 0;
  let focusMatch = 0;
  let callableFocus = 0;
  let rejectedIndustry = 0;
  let rejectedCity = 0;
  let rejectedPhone = 0;

  const rejectedSamples = [];

  for (const row of records) {
    const indOk = industryMatchesLead(row, focus.industry);
    const cityResult = cityMatchesLead(row, focus.city, { searchCity: row.source });
    const evalResult = evaluateFocusMatch(row, focus);

    if (indOk) industryMatch += 1;
    else rejectedIndustry += 1;

    if (cityResult.matches) cityMatch += 1;
    else if (indOk) rejectedCity += 1;

    if (evalResult.matches) {
      focusMatch += 1;
      if (hasCallablePhone(row)) callableFocus += 1;
      else rejectedPhone += 1;
    } else if (rejectedSamples.length < 10) {
      rejectedSamples.push({
        id: row.id,
        businessName: row.businessName,
        reasons: evalResult.reasons,
        industry: row.industry || row.category,
        city: row.city,
      });
    }
  }

  const queueCounts = await countWebsiteFocusInventory(focus);

  return {
    mode,
    focus,
    totals: {
      totalLeads: total,
      industryMatches: industryMatch,
      cityMatches: cityMatch,
      focusMatches: focusMatch,
      callableFocusMatches: callableFocus,
      availableFocused: queueCounts.available,
      activeFocused: queueCounts.active,
      noPhoneFocused: focusMatch - callableFocus,
    },
    rejected: {
      byIndustry: rejectedIndustry,
      byCity: rejectedCity,
      byPhone: rejectedPhone,
      byQueueState: 0,
    },
    targets: { available: FOCUS_MIN_AVAILABLE, active: FOCUS_TARGET_ACTIVE },
    inventoryExhausted: callableFocus < FOCUS_MIN_AVAILABLE,
    exhaustedMessage:
      callableFocus < FOCUS_MIN_AVAILABLE
        ? "Beaumont focused inventory is exhausted."
        : null,
    inventoryMessage:
      callableFocus < FOCUS_MIN_AVAILABLE
        ? `Beaumont focused inventory is low (${callableFocus} callable focused). Run npm run website:find-leads -- --scrape`
        : null,
    samples: {
      rejected: rejectedSamples,
      industryOnlyNotCity: sampleRejections(
        records.filter((r) => industryMatchesLead(r, focus.industry) && !evaluateFocusMatch(r, focus).matches),
        focus,
      ),
    },
  };
}
