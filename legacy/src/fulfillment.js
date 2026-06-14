import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";

export const FULFILLMENT_FILE = join(DATA_DIR, "fulfillment.json");
export const FULFILLMENT_STATUSES = ["pending", "in_progress", "waiting_client", "launched", "blocked"];
export const CHECKLIST_STATUSES = ["pending", "complete", "blocked"];

export const LAUNCH_CHECKLIST = [
  ["confirm_client_info", "Confirm client info"],
  ["confirm_domain", "Confirm domain"],
  ["confirm_website_content", "Confirm website content"],
  ["assign_hosting_deployment_path", "Assign hosting/deployment path"],
  ["create_site_record", "Create site record"],
  ["confirm_ssl", "Confirm SSL"],
  ["confirm_backup_status", "Confirm backup status"],
  ["launch_site", "Launch site"],
  ["create_first_maintenance_request_option", "Create first maintenance request option"],
];

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function clamp(value, allowed, fallback) {
  const next = cleanText(value);
  return allowed.includes(next) ? next : fallback;
}

function toIsoOrNow(value) {
  if (!value) return nowIso();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString();
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function defaultChecklist() {
  return LAUNCH_CHECKLIST.map(([key, label]) => ({
    key,
    label,
    status: "pending",
    notes: "",
    completedAt: null,
  }));
}

function normalizeChecklistItem(item = {}) {
  const fallback = LAUNCH_CHECKLIST.find(([key]) => key === item.key);
  return {
    key: cleanText(item.key || fallback?.[0]),
    label: cleanText(item.label || fallback?.[1]),
    status: clamp(item.status, CHECKLIST_STATUSES, "pending"),
    notes: cleanText(item.notes),
    completedAt: toIsoOrNull(item.completedAt),
  };
}

function mergeChecklist(items = []) {
  const byKey = new Map(items.map((item) => [item.key, normalizeChecklistItem(item)]));
  return defaultChecklist().map((item) => normalizeChecklistItem({
    ...item,
    ...(byKey.get(item.key) ?? {}),
  }));
}

function normalizeRecord(record = {}) {
  const createdAt = toIsoOrNow(record.createdAt);
  const checklist = mergeChecklist(Array.isArray(record.checklist) ? record.checklist : []);
  const blocked = checklist.some((item) => item.status === "blocked");
  const launched = checklist.find((item) => item.key === "launch_site")?.status === "complete";
  const completedAny = checklist.some((item) => item.status === "complete");
  const requestedStatus = clamp(record.status, FULFILLMENT_STATUSES, "pending");
  return {
    fulfillmentId: cleanText(record.fulfillmentId) || `fulfillment_${randomUUID()}`,
    clientId: cleanText(record.clientId),
    revenueId: cleanText(record.revenueId),
    leadId: cleanText(record.leadId),
    siteId: cleanText(record.siteId),
    status:
      launched
        ? "launched"
        : blocked
          ? "blocked"
          : requestedStatus === "blocked"
            ? completedAny ? "in_progress" : "pending"
            : requestedStatus,
    checklist,
    createdAt,
    updatedAt: toIsoOrNow(record.updatedAt || createdAt),
  };
}

function defaultState() {
  return {
    version: 1,
    records: [],
  };
}

function normalizeState(input = {}) {
  return {
    version: 1,
    records: Array.isArray(input.records) ? input.records.map(normalizeRecord) : [],
  };
}

async function readState() {
  try {
    return normalizeState(JSON.parse(await readFile(FULFILLMENT_FILE, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return defaultState();
    throw err;
  }
}

async function writeState(state) {
  const normalized = normalizeState(state);
  await writeJsonFileSafe(FULFILLMENT_FILE, normalized);
  return normalized;
}

function findIndex(records, { fulfillmentId = "", clientId = "", revenueId = "" } = {}) {
  return records.findIndex((record) =>
    (fulfillmentId && record.fulfillmentId === fulfillmentId) ||
    (revenueId && record.revenueId === revenueId) ||
    (clientId && record.clientId === clientId)
  );
}

export async function listFulfillmentRecords() {
  return (await readState()).records;
}

export async function createFulfillmentRecord(input = {}) {
  const state = await readState();
  const existingIndex = findIndex(state.records, {
    clientId: input.clientId,
    revenueId: input.revenueId,
  });
  if (existingIndex !== -1) return state.records[existingIndex];
  const record = normalizeRecord({
    clientId: input.clientId,
    revenueId: input.revenueId,
    leadId: input.leadId,
    siteId: input.siteId,
    status: input.status || "pending",
  });
  state.records.push(record);
  await writeState(state);
  return record;
}

export async function linkFulfillmentSite(fulfillmentId, siteId) {
  const state = await readState();
  const index = findIndex(state.records, { fulfillmentId });
  if (index === -1) return null;
  state.records[index] = normalizeRecord({
    ...state.records[index],
    siteId,
    updatedAt: nowIso(),
  });
  await writeState(state);
  return state.records[index];
}

export async function updateFulfillmentChecklistItem(fulfillmentId, key, patch = {}) {
  const state = await readState();
  const index = findIndex(state.records, { fulfillmentId });
  if (index === -1) return null;
  const record = state.records[index];
  const itemIndex = record.checklist.findIndex((item) => item.key === key);
  if (itemIndex === -1) throw new Error("Checklist item not found.");
  const status = clamp(patch.status ?? record.checklist[itemIndex].status, CHECKLIST_STATUSES, "pending");
  const checklist = [...record.checklist];
  checklist[itemIndex] = normalizeChecklistItem({
    ...checklist[itemIndex],
    ...patch,
    status,
    completedAt: status === "complete" ? nowIso() : status === "pending" ? null : checklist[itemIndex].completedAt,
  });
  state.records[index] = normalizeRecord({
    ...record,
    checklist,
    status: patch.fulfillmentStatus || record.status,
    updatedAt: nowIso(),
  });
  await writeState(state);
  return state.records[index];
}

function hasSite(record) {
  return Boolean(record.siteId);
}

function blockedItems(record) {
  return record.checklist
    .filter((item) => item.status === "blocked")
    .map((item) => ({ ...item, fulfillmentId: record.fulfillmentId, clientId: record.clientId }));
}

export async function getFulfillmentView({ clients = [], revenueRecords = [], sites = [], maintenanceRequests = [] } = {}) {
  const records = await listFulfillmentRecords();
  const clientsById = new Map(clients.map((client) => [client.clientId, client]));
  const revenueById = new Map(revenueRecords.map((record) => [record.revenueId, record]));
  const sitesById = new Map(sites.map((site) => [site.siteId, site]));
  const requestsByFulfillment = new Map();
  for (const request of maintenanceRequests) {
    if (!request.fulfillmentId) continue;
    requestsByFulfillment.set(request.fulfillmentId, [
      ...(requestsByFulfillment.get(request.fulfillmentId) ?? []),
      request,
    ]);
  }
  const enriched = records.map((record) => ({
    ...record,
    client: clientsById.get(record.clientId) ?? null,
    revenue: revenueById.get(record.revenueId) ?? null,
    site: sitesById.get(record.siteId) ?? null,
    maintenanceRequests: requestsByFulfillment.get(record.fulfillmentId) ?? [],
  }));
  const statusCounts = Object.fromEntries(FULFILLMENT_STATUSES.map((status) => [
    status,
    enriched.filter((record) => record.status === status).length,
  ]));
  const activatedClientsPendingLaunch = enriched.filter((record) =>
    record.status !== "launched" && record.client?.billingStatus === "active"
  );
  const clientsMissingSiteRecords = enriched.filter((record) =>
    record.client?.billingStatus === "active" && !hasSite(record)
  );
  return {
    version: 1,
    statuses: FULFILLMENT_STATUSES,
    checklistTemplate: defaultChecklist(),
    records: enriched,
    summary: {
      total: enriched.length,
      byStatus: statusCounts,
      activatedClientsPendingLaunch: activatedClientsPendingLaunch.length,
      blockedChecklistItems: enriched.flatMap(blockedItems).length,
      launchedSites: enriched.filter((record) => record.status === "launched").length,
      clientsMissingSiteRecords: clientsMissingSiteRecords.length,
      fulfillmentLinkedMaintenanceRequests: enriched.reduce((sum, record) => sum + record.maintenanceRequests.length, 0),
    },
    queues: {
      activatedClientsPendingLaunch,
      blockedChecklistItems: enriched.flatMap(blockedItems),
      launchedSites: enriched.filter((record) => record.status === "launched"),
      clientsMissingSiteRecords,
    },
  };
}
