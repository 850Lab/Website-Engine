import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DATA_DIR, writeJsonFileSafe } from "../storage.js";
import { cleanText, nowIso } from "../stage1/shared.js";
import { listQualifiedBusinesses } from "../stage1/qualified-business-store.js";

const FOUNDER_OS_FILE = join(DATA_DIR, "founder-os.json");

const OUTREACH_STATUSES = [
  "new",
  "contacted",
  "follow_up",
  "responded",
  "interested",
  "appointment_scheduled",
  "proposal_sent",
  "won",
  "lost",
];

function slug(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function startOfDayIso() {
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return day.toISOString().slice(0, 10);
}

async function readState() {
  try {
    const parsed = JSON.parse(await readFile(FOUNDER_OS_FILE, "utf8"));
    return {
      version: 1,
      businesses: Array.isArray(parsed?.businesses) ? parsed.businesses : [],
      timeline: Array.isArray(parsed?.timeline) ? parsed.timeline : [],
      updatedAt: parsed?.updatedAt ?? null,
    };
  } catch (err) {
    if (err.code === "ENOENT") {
      return { version: 1, businesses: [], timeline: [], updatedAt: null };
    }
    throw err;
  }
}

async function writeState(state) {
  const next = {
    version: 1,
    businesses: state.businesses ?? [],
    timeline: state.timeline ?? [],
    updatedAt: nowIso(),
  };
  await writeJsonFileSafe(FOUNDER_OS_FILE, next);
  return next;
}

function mapWebsiteAnalysis(source) {
  return {
    websiteScore: Number(source.websiteScore) || 0,
    mobileFriendly: Number(source.websiteScore) >= 45,
    sslInstalled: Boolean(cleanText(source.websiteUrl).toLowerCase().startsWith("https://")),
    speedScore: Number(source.websiteScore) || 0,
    notes: cleanText(source.qualificationReason) || "Opportunity imported from qualified database.",
  };
}

function mapContact(source) {
  return {
    phoneNumber: cleanText(source.phone),
    email: cleanText(source.email),
    facebookUrl: cleanText(source.facebookUrl),
    instagramUrl: cleanText(source.instagramUrl),
  };
}

function mapBusiness(source) {
  const businessId = `fo_${slug(source.id || source.businessName || randomUUID().slice(0, 8))}`;
  return {
    id: businessId,
    sourceRecordId: source.id ?? null,
    businessName: cleanText(source.businessName),
    industry: cleanText(source.industry),
    city: cleanText(source.city),
    state: cleanText(source.state).toUpperCase(),
    website: cleanText(source.websiteUrl),
    googleBusinessProfileUrl: cleanText(source.googleMapsUrl),
    contact: mapContact(source),
    websiteAnalysis: mapWebsiteAnalysis(source),
    outreachStatus: "new",
    followUpDate: null,
    notes: cleanText(source.qualificationReason),
    assets: [],
    outreachHistory: [],
    createdAt: source.dateFound ?? nowIso(),
    updatedAt: nowIso(),
  };
}

function normalizeStatus(status) {
  const key = slug(status);
  return OUTREACH_STATUSES.includes(key) ? key : "new";
}

function countByStatus(businesses) {
  const counts = {
    totalBusinesses: businesses.length,
    newOpportunities: 0,
    contacted: 0,
    responded: 0,
    interested: 0,
    appointmentsScheduled: 0,
    salesClosed: 0,
  };
  for (const row of businesses) {
    if (row.outreachStatus === "new") counts.newOpportunities += 1;
    if (["contacted", "follow_up", "responded", "interested", "appointment_scheduled", "proposal_sent", "won", "lost"].includes(row.outreachStatus)) {
      counts.contacted += 1;
    }
    if (["responded", "interested", "appointment_scheduled", "proposal_sent", "won"].includes(row.outreachStatus)) {
      counts.responded += 1;
    }
    if (row.outreachStatus === "interested") counts.interested += 1;
    if (row.outreachStatus === "appointment_scheduled") counts.appointmentsScheduled += 1;
    if (row.outreachStatus === "won") counts.salesClosed += 1;
  }
  return counts;
}

function todayOutreachCounts(timeline) {
  const day = startOfDayIso();
  const today = timeline.filter((entry) => String(entry.at).startsWith(day));
  const byType = {
    callsMade: 0,
    textsSent: 0,
    emailsSent: 0,
    dmsSent: 0,
    totalOffersMade: 0,
  };
  for (const entry of today) {
    if (entry.type === "call") byType.callsMade += 1;
    if (entry.type === "text") byType.textsSent += 1;
    if (entry.type === "email") byType.emailsSent += 1;
    if (entry.type === "dm") byType.dmsSent += 1;
    if (["call", "text", "email", "dm"].includes(entry.type)) byType.totalOffersMade += 1;
  }
  return byType;
}

function findBusiness(state, businessId) {
  return state.businesses.find((row) => row.id === businessId) ?? null;
}

export async function bootstrapFounderOsFromQualified() {
  const state = await readState();
  const qualified = await listQualifiedBusinesses();
  const existingBySource = new Map(
    state.businesses
      .filter((row) => row.sourceRecordId)
      .map((row) => [row.sourceRecordId, row]),
  );
  let changed = false;
  for (const source of qualified) {
    if (source.qualificationStatus !== "qualified") continue;
    if (existingBySource.has(source.id)) continue;
    state.businesses.push(mapBusiness(source));
    changed = true;
  }
  if (changed) {
    await writeState(state);
  }
  return state;
}

export async function listFounderBusinesses(filters = {}) {
  const state = await bootstrapFounderOsFromQualified();
  let rows = [...state.businesses];
  const status = normalizeStatus(filters.status || "");
  if (filters.status && status) {
    rows = rows.filter((row) => row.outreachStatus === status);
  }
  if (cleanText(filters.city)) {
    const needle = cleanText(filters.city).toLowerCase();
    rows = rows.filter((row) => row.city.toLowerCase().includes(needle));
  }
  if (cleanText(filters.industry)) {
    const needle = cleanText(filters.industry).toLowerCase();
    rows = rows.filter((row) => row.industry.toLowerCase().includes(needle));
  }
  if (cleanText(filters.search)) {
    const needle = cleanText(filters.search).toLowerCase();
    rows = rows.filter((row) =>
      [row.businessName, row.city, row.industry, row.contact.phoneNumber, row.contact.email]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }
  rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return rows;
}

export async function getFounderBusiness(businessId) {
  const state = await bootstrapFounderOsFromQualified();
  return findBusiness(state, businessId);
}

export async function updateFounderBusiness(businessId, patch = {}) {
  const state = await bootstrapFounderOsFromQualified();
  const index = state.businesses.findIndex((row) => row.id === businessId);
  if (index === -1) return null;
  const current = state.businesses[index];
  const next = {
    ...current,
    ...patch,
    contact: { ...current.contact, ...(patch.contact ?? {}) },
    websiteAnalysis: { ...current.websiteAnalysis, ...(patch.websiteAnalysis ?? {}) },
    updatedAt: nowIso(),
  };
  next.outreachStatus = normalizeStatus(next.outreachStatus);
  state.businesses[index] = next;
  await writeState(state);
  return next;
}

export async function addFounderTimelineEntry(input = {}) {
  const state = await bootstrapFounderOsFromQualified();
  const business = findBusiness(state, input.businessId);
  if (!business) return null;
  const entry = {
    id: `evt_${randomUUID().slice(0, 10)}`,
    businessId: business.id,
    type: slug(input.type) || "note",
    message: cleanText(input.message) || "Activity recorded.",
    channel: slug(input.channel),
    at: nowIso(),
    meta: input.meta ?? {},
  };
  state.timeline.unshift(entry);
  business.outreachHistory = [entry, ...(business.outreachHistory ?? [])].slice(0, 200);
  business.updatedAt = nowIso();
  await writeState(state);
  return entry;
}

export async function attachFounderAsset(businessId, asset = {}) {
  const state = await bootstrapFounderOsFromQualified();
  const business = findBusiness(state, businessId);
  if (!business) return null;
  const nextAsset = {
    id: `asset_${randomUUID().slice(0, 10)}`,
    type: slug(asset.type) || "attachment",
    title: cleanText(asset.title) || "Asset",
    url: cleanText(asset.url),
    notes: cleanText(asset.notes),
    createdAt: nowIso(),
  };
  business.assets = [nextAsset, ...(business.assets ?? [])];
  business.updatedAt = nowIso();
  await writeState(state);
  return nextAsset;
}

export async function founderDashboard() {
  const state = await bootstrapFounderOsFromQualified();
  const counters = countByStatus(state.businesses);
  const today = todayOutreachCounts(state.timeline);
  const uncontacted = state.businesses.filter((row) => row.outreachStatus === "new").length;
  const followUpsDue = state.businesses.filter((row) => {
    if (!row.followUpDate) return false;
    return row.followUpDate <= startOfDayIso();
  }).length;
  let nextAction = "Start Power Hour and make offers.";
  if (uncontacted > 0) {
    nextAction = `You have ${uncontacted} uncontacted businesses. Start with call/text outreach now.`;
  } else if (followUpsDue > 0) {
    nextAction = `You have ${followUpsDue} follow-ups due today. Clear them first.`;
  }

  return {
    ...counters,
    ...today,
    followUpsDueToday: followUpsDue,
    uncontactedBusinesses: uncontacted,
    nextAction,
  };
}

export async function powerHourQueue(limit = 30) {
  const rows = await listFounderBusinesses({});
  const queue = rows
    .filter((row) => ["new", "follow_up", "contacted"].includes(row.outreachStatus))
    .sort((a, b) => Number(a.websiteAnalysis.websiteScore) - Number(b.websiteAnalysis.websiteScore))
    .slice(0, Math.max(1, Number(limit) || 30));
  return queue;
}

export async function founderTimeline(limit = 200) {
  const state = await bootstrapFounderOsFromQualified();
  return [...state.timeline].slice(0, Math.max(1, Number(limit) || 200));
}
