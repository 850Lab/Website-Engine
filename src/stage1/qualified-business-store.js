import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "../storage.js";
import { buildDedupKey, cleanText, nowIso } from "./shared.js";

export const QUALIFIED_BUSINESSES_FILE = join(DATA_DIR, "qualified-businesses.json");
export const DISCOVERY_RUNS_FILE = join(DATA_DIR, "business-discovery-runs.json");
export const WEBSITE_QUALITY_SCORES_FILE = join(DATA_DIR, "website-quality-scores.json");

function startOfDayTimestamp(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function isPreviewVerified(record) {
  return Boolean(record?.previewGenerated) && Boolean(record?.previewVerification?.ok);
}

export function isReadyForOutreach(record) {
  return Boolean(record?.opportunityProjectId) && isPreviewVerified(record);
}

async function readJsonRecords(filePath, key = "records") {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.[key])) return parsed[key];
    return [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeJsonRecords(filePath, records, key = "records") {
  await writeJsonFileSafe(filePath, { version: 1, [key]: records });
}

export async function listQualifiedBusinesses() {
  const records = await readJsonRecords(QUALIFIED_BUSINESSES_FILE);
  return records.sort((a, b) => String(b.dateFound).localeCompare(String(a.dateFound)));
}

export async function getQualifiedBusiness(id) {
  const records = await readJsonRecords(QUALIFIED_BUSINESSES_FILE);
  return records.find((record) => record.id === id) ?? null;
}

export async function findByDedupKey(dedupKey) {
  const records = await readJsonRecords(QUALIFIED_BUSINESSES_FILE);
  return records.find((record) => record.dedupKey === dedupKey) ?? null;
}

export async function upsertQualifiedBusiness(record) {
  const records = await readJsonRecords(QUALIFIED_BUSINESSES_FILE);
  const index = records.findIndex(
    (entry) => entry.id === record.id || entry.dedupKey === record.dedupKey
  );
  const next = { ...record, updatedAt: nowIso() };
  if (index === -1) {
    records.push(next);
  } else {
    records[index] = { ...records[index], ...next, id: records[index].id };
  }
  await writeJsonRecords(QUALIFIED_BUSINESSES_FILE, records);
  return index === -1 ? next : records[index];
}

export async function saveWebsiteQualityScore(entry) {
  const records = await readJsonRecords(WEBSITE_QUALITY_SCORES_FILE, "scores");
  const index = records.findIndex((row) => row.businessId === entry.businessId);
  if (index === -1) {
    records.push(entry);
  } else {
    records[index] = { ...records[index], ...entry };
  }
  await writeJsonRecords(WEBSITE_QUALITY_SCORES_FILE, records, "scores");
  return entry;
}

export async function listDiscoveryRuns() {
  const runs = await readJsonRecords(DISCOVERY_RUNS_FILE, "runs");
  return runs.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

export async function getDiscoveryRun(runId) {
  const runs = await readJsonRecords(DISCOVERY_RUNS_FILE, "runs");
  return runs.find((run) => run.id === runId) ?? null;
}

export async function saveDiscoveryRun(run) {
  const runs = await readJsonRecords(DISCOVERY_RUNS_FILE, "runs");
  const index = runs.findIndex((entry) => entry.id === run.id);
  const next = { ...run, updatedAt: nowIso() };
  if (index === -1) {
    runs.push(next);
  } else {
    runs[index] = { ...runs[index], ...next };
  }
  await writeJsonRecords(DISCOVERY_RUNS_FILE, runs, "runs");
  return index === -1 ? next : runs[index];
}

export function buildBusinessRecord(input) {
  const dedupKey = buildDedupKey(input);
  const autoReadyForOutreach =
    Boolean(cleanText(input.opportunityProjectId)) &&
    Boolean(input.previewGenerated) &&
    Boolean(input.previewVerification?.ok);
  const built = {
    id: input.id,
    businessName: cleanText(input.businessName),
    industry: cleanText(input.industry),
    category: cleanText(input.category),
    city: cleanText(input.city),
    state: cleanText(input.state).toUpperCase(),
    address: cleanText(input.address),
    googleMapsUrl: cleanText(input.googleMapsUrl),
    googleRating: Number(input.googleRating) || 0,
    googleReviewCount: Number(input.googleReviewCount) || 0,
    websiteUrl: cleanText(input.websiteUrl),
    websiteStatus: input.websiteStatus,
    websiteScore: input.websiteScore ?? null,
    websiteScoreReasons: input.websiteScoreReasons ?? [],
    websiteScoreConfidence: input.websiteScoreConfidence ?? "estimated",
    phone: cleanText(input.phone),
    normalizedPhone: cleanText(input.normalizedPhone),
    email: cleanText(input.email),
    socialUrls: input.socialUrls ?? [],
    contactMethodCategory: input.contactMethodCategory,
    qualificationStatus: input.qualificationStatus,
    qualificationReason: cleanText(input.qualificationReason),
    manualOverride: Boolean(input.manualOverride),
    dateFound: input.dateFound ?? nowIso(),
    dateScored: input.dateScored ?? nowIso(),
    source: input.source ?? "google_maps",
    discoveryRunId: input.discoveryRunId ?? null,
    businessIdentityId: input.businessIdentityId ?? null,
    facebookUrl: cleanText(input.facebookUrl),
    instagramUrl: cleanText(input.instagramUrl),
    linkedinUrl: cleanText(input.linkedinUrl),
    enrichment: input.enrichment ?? null,
    enrichedAt: input.enrichedAt ?? null,
    opportunityProjectId: cleanText(input.opportunityProjectId),
    previewGenerated: Boolean(input.previewGenerated),
    previewUrl: cleanText(input.previewUrl),
    launchUrl: cleanText(input.launchUrl),
    dashboardUrl: cleanText(input.dashboardUrl),
    projectCreatedAt: input.projectCreatedAt ?? null,
    projectStatus: cleanText(input.projectStatus) || "no_project",
    previewStatus: cleanText(input.previewStatus) || "no_project",
    previewVerification: input.previewVerification ?? null,
    projectGenerationDurationMs:
      Number(input.projectGenerationDurationMs) > 0
        ? Number(input.projectGenerationDurationMs)
        : null,
    readyForOutreach: Boolean(input.readyForOutreach) || autoReadyForOutreach,
    readyForOutreachAt: input.readyForOutreachAt ?? null,
    dedupKey,
    updatedAt: nowIso(),
  };
  if (input.outreachStatus !== undefined && input.outreachStatus !== null) {
    built.outreachStatus = normalizeOutreachStatus(input.outreachStatus);
  }
  if (input.outreachStatusUpdatedAt !== undefined) {
    built.outreachStatusUpdatedAt = input.outreachStatusUpdatedAt;
  }
  return built;
}

export const OUTREACH_STATUSES = [
  "not_contacted",
  "contacted",
  "replied",
  "asked_price",
  "appointment",
  "won",
  "lost",
];

export function normalizeOutreachStatus(value) {
  const status = cleanText(value).toLowerCase();
  if (OUTREACH_STATUSES.includes(status)) return status;
  if (status === "new") return "not_contacted";
  return "not_contacted";
}

export function isNotContacted(record) {
  return normalizeOutreachStatus(record?.outreachStatus) === "not_contacted";
}

export async function buildDatabaseSummary(records = null) {
  const list = records ?? (await listQualifiedBusinesses());
  const qualified = list.filter((row) => row.qualificationStatus === "qualified");
  const runs = await listDiscoveryRuns();
  const todayStart = startOfDayTimestamp();
  const opportunitiesFoundToday = list.filter(
    (row) => new Date(row.dateFound).getTime() >= todayStart
  ).length;
  const projectsGenerated = list.filter((row) => row.opportunityProjectId).length;
  const previewsReady = list.filter((row) => isPreviewVerified(row)).length;
  const readyForOutreach = list.filter((row) => isReadyForOutreach(row)).length;

  return {
    businessesFound: list.length,
    opportunitiesFoundToday,
    qualifiedBusinesses: qualified.length,
    noWebsite: list.filter((row) => row.websiteStatus === "no_website").length,
    poorWebsite: list.filter((row) => row.websiteStatus === "poor_website").length,
    goodWebsite: list.filter((row) => row.websiteStatus === "good_website").length,
    phoneAvailable: list.filter((row) => row.phone || row.normalizedPhone).length,
    emailAvailable: list.filter((row) => row.email).length,
    textFirst: qualified.filter((row) => row.contactMethodCategory === "text_first").length,
    emailFirst: qualified.filter((row) => row.contactMethodCategory === "email_first").length,
    notContactable: list.filter((row) => row.contactMethodCategory === "not_contactable").length,
    projectsGenerated,
    previewsReady,
    readyForOutreach,
    citiesCovered: new Set(list.map((row) => cleanText(row.city)).filter(Boolean)).size,
    industriesCovered: new Set(list.map((row) => cleanText(row.industry)).filter(Boolean)).size,
    mostRecentDiscoveryRun: runs[0] ?? null,
    topOpportunityCities: groupCount(qualified, "city").slice(0, 10),
    topOpportunityIndustries: groupCount(qualified, "industry").slice(0, 10),
    byIndustry: groupCount(list, "industry"),
    byCity: groupCount(list, "city"),
  };
}

function groupCount(rows, field) {
  const map = {};
  for (const row of rows) {
    const key = cleanText(row[field]) || "Unknown";
    map[key] = (map[key] ?? 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

export function filterBusinesses(records, filters = {}) {
  let rows = [...records];

  if (filters.qualifiedOnly) {
    rows = rows.filter((row) => row.qualificationStatus === "qualified");
  }
  if (filters.noWebsite) {
    rows = rows.filter((row) => row.websiteStatus === "no_website");
  }
  if (filters.poorWebsite) {
    rows = rows.filter((row) => row.websiteStatus === "poor_website");
  }
  if (filters.textFirst) {
    rows = rows.filter((row) => row.contactMethodCategory === "text_first");
  }
  if (filters.emailFirst) {
    rows = rows.filter((row) => row.contactMethodCategory === "email_first");
  }
  if (filters.notContactable) {
    rows = rows.filter((row) => row.contactMethodCategory === "not_contactable");
  }
  if (filters.readyForOutreach) {
    rows = rows.filter((row) => isReadyForOutreach(row));
  }
  if (cleanText(filters.industry)) {
    const needle = cleanText(filters.industry).toLowerCase();
    rows = rows.filter((row) => row.industry?.toLowerCase().includes(needle));
  }
  if (cleanText(filters.city)) {
    const needle = cleanText(filters.city).toLowerCase();
    rows = rows.filter((row) => row.city?.toLowerCase().includes(needle));
  }

  return rows;
}
