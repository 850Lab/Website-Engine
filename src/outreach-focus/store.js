import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR } from "../storage.js";
import { readJsonDocument, writeJsonDocument } from "../persistence/json-document-store.js";
import { cleanText, nowIso } from "../stage1/shared.js";
import { getFocusTimeContext } from "./time.js";
import {
  industryMatches,
  cityMatches,
  leadMatchesFocus,
  evaluateFocusMatch,
  industryMatchesLead,
  cityMatchesLead,
  hasCallablePhone,
  normalizeLeadCity,
} from "./matching.js";

export {
  industryMatches,
  cityMatches,
  leadMatchesFocus,
  evaluateFocusMatch,
  industryMatchesLead,
  cityMatchesLead,
  hasCallablePhone,
  normalizeLeadCity,
};

export const OUTREACH_FOCUS_FILE = join(DATA_DIR, "outreach-focus.json");
export const FOCUS_CALL_TARGET = 100;

export const DEFAULT_FOCUS = {
  website: {
    mode: "website",
    industry: "Fence Companies",
    city: "Beaumont",
    offer: "Website Preview + More Estimate Requests",
    salesperson: "Jaylan",
  },
  "pressure-washing": {
    mode: "pressure-washing",
    industry: "Restaurants",
    city: "Beaumont",
    offer: "Dumpster Pad Cleaning",
    salesperson: "Jaylan",
  },
};

const VALID_MODES = new Set(["website", "pressure-washing"]);

export function normalizeFocusMode(value) {
  const mode = cleanText(value).toLowerCase();
  if (mode === "pw" || mode === "pressure_washing") return "pressure-washing";
  return VALID_MODES.has(mode) ? mode : "website";
}

function normalizeFocusConfig(mode, input = {}) {
  const defaults = DEFAULT_FOCUS[mode] ?? DEFAULT_FOCUS.website;
  return {
    mode,
    industry: cleanText(input.industry) || defaults.industry,
    city: cleanText(input.city) || defaults.city,
    offer: cleanText(input.offer) || defaults.offer,
    salesperson: cleanText(input.salesperson) || defaults.salesperson,
  };
}

async function readDoc() {
  const parsed = await readJsonDocument(OUTREACH_FOCUS_FILE);
  if (!parsed) {
    return {
      version: 1,
      website: { ...DEFAULT_FOCUS.website },
      "pressure-washing": { ...DEFAULT_FOCUS["pressure-washing"] },
      events: [],
      updatedAt: null,
    };
  }
  return {
    version: parsed.version ?? 1,
    website: normalizeFocusConfig("website", parsed.website ?? parsed.websiteFocus),
    "pressure-washing": normalizeFocusConfig(
      "pressure-washing",
      parsed["pressure-washing"] ?? parsed.pw ?? parsed.pressureWashing,
    ),
    events: Array.isArray(parsed.events) ? parsed.events : [],
    updatedAt: parsed.updatedAt ?? null,
  };
}

async function writeDoc(doc) {
  await writeJsonDocument(OUTREACH_FOCUS_FILE, { ...doc, updatedAt: nowIso() });
}

export function normalizeMatch(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ").trim();
}

export function eventMatchesFocus(event = {}, focus = {}, mode = "") {
  if (mode && normalizeFocusMode(event.mode) !== normalizeFocusMode(mode)) return false;
  return (
    normalizeMatch(event.industry) === normalizeMatch(focus.industry) &&
    normalizeMatch(event.city) === normalizeMatch(focus.city) &&
    normalizeMatch(event.offer) === normalizeMatch(focus.offer) &&
    normalizeMatch(event.salesperson) === normalizeMatch(focus.salesperson)
  );
}

export async function getFocus(mode) {
  const doc = await readDoc();
  const key = normalizeFocusMode(mode);
  return doc[key];
}

export async function updateFocus(mode, patch = {}) {
  const doc = await readDoc();
  const key = normalizeFocusMode(mode);
  doc[key] = normalizeFocusConfig(key, { ...doc[key], ...patch, mode: key });
  await writeDoc(doc);
  return doc[key];
}

export async function appendFocusEvent(event = {}) {
  const doc = await readDoc();
  const mode = normalizeFocusMode(event.mode);
  const focus = doc[mode];
  const ctx = getFocusTimeContext(event.at ? new Date(event.at) : new Date());
  const entry = {
    id: cleanText(event.id) || `foc_${randomUUID().slice(0, 8)}`,
    mode,
    type: cleanText(event.type),
    leadId: cleanText(event.leadId) || null,
    at: event.at || ctx.at,
    dayOfWeek: event.dayOfWeek || ctx.dayOfWeek,
    timeBucket: event.timeBucket || ctx.timeBucket,
    industry: cleanText(event.industry) || focus.industry,
    city: cleanText(event.city) || focus.city,
    offer: cleanText(event.offer) || focus.offer,
    salesperson: cleanText(event.salesperson) || focus.salesperson,
    revenue: event.revenue == null ? null : Number(event.revenue) || 0,
  };
  doc.events.push(entry);
  await writeDoc(doc);
  return entry;
}

export async function getFocusEvents(mode, focus = null) {
  const doc = await readDoc();
  const key = normalizeFocusMode(mode);
  const cfg = focus ?? doc[key];
  return doc.events.filter((event) => eventMatchesFocus(event, cfg, key));
}

export async function recordPwFocusActivity({ lead, patch = {}, actionId = "", quick = null } = {}) {
  const mode = "pressure-washing";
  const focus = await getFocus(mode);
  const base = { mode, leadId: lead.id, ...focus };
  const recorded = [];
  const matches = leadMatchesFocus(lead, focus);

  if (patch.incrementCall) {
    recorded.push(await appendFocusEvent({ ...base, type: "call" }));
  }
  if (!matches) return recorded;

  if (patch.incrementConversation || quick?.bumpConversation) {
    recorded.push(await appendFocusEvent({ ...base, type: "conversation" }));
  }
  if (actionId === "interested") recorded.push(await appendFocusEvent({ ...base, type: "interested" }));
  if (actionId === "estimate_sent") recorded.push(await appendFocusEvent({ ...base, type: "estimate" }));
  if (actionId === "won") {
    recorded.push(
      await appendFocusEvent({
        ...base,
        type: "sale",
        revenue: lead.revenueWon ?? patch.revenueWon ?? null,
      }),
    );
  }

  return recorded;
}

export async function recordWebsiteFocusActivity({ business, status, kind = "outcome" } = {}) {
  if (!business) return [];
  const mode = "website";
  const focus = await getFocus(mode);
  if (!leadMatchesFocus(business, focus)) return [];

  const base = { mode, leadId: business.id, ...focus };
  const recorded = [];
  const nextStatus = cleanText(status);

  if (kind === "call") {
    recorded.push(await appendFocusEvent({ ...base, type: "call" }));
    return recorded;
  }

  if (nextStatus && nextStatus !== "not_contacted") {
    recorded.push(await appendFocusEvent({ ...base, type: "call" }));
  }
  if (["replied", "asked_price", "appointment", "won"].includes(nextStatus)) {
    recorded.push(await appendFocusEvent({ ...base, type: "conversation" }));
  }
  if (["replied", "asked_price"].includes(nextStatus)) {
    recorded.push(await appendFocusEvent({ ...base, type: "interested" }));
  }
  if (nextStatus === "appointment") {
    recorded.push(await appendFocusEvent({ ...base, type: "estimate" }));
  }
  if (nextStatus === "won") {
    recorded.push(await appendFocusEvent({ ...base, type: "sale" }));
  }

  return recorded;
}

export function sortLeadsByFocus(leads = [], focus = {}) {
  return [...leads].sort((a, b) => {
    const am = leadMatchesFocus(a, focus) ? 0 : 1;
    const bm = leadMatchesFocus(b, focus) ? 0 : 1;
    return am - bm;
  });
}

export function filterLeadsToFocus(leads = [], focus = {}) {
  if (!focus?.industry && !focus?.city) return leads;
  return leads.filter((lead) => leadMatchesFocus(lead, focus));
}
