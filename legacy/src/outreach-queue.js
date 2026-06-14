import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";

export const OUTREACH_QUEUE_FILE = join(DATA_DIR, "outreach-queue.json");
export const OUTREACH_APPROVAL_STATUSES = ["draft", "approved", "rejected"];
export const OUTREACH_SEND_STATUSES = ["drafted", "queued", "sent", "failed"];

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

function normalizeRecord(record = {}) {
  const createdAt = cleanText(record.createdAt) || nowIso();
  return {
    outreachId: cleanText(record.outreachId) || `outreach_${randomUUID()}`,
    websiteId: cleanText(record.websiteId),
    leadId: cleanText(record.leadId),
    channel: cleanText(record.channel) || "email",
    to: cleanText(record.to),
    subject: cleanText(record.subject),
    body: cleanText(record.body),
    approvalStatus: clamp(record.approvalStatus, OUTREACH_APPROVAL_STATUSES, "draft"),
    sendStatus: clamp(record.sendStatus, OUTREACH_SEND_STATUSES, "drafted"),
    provider: cleanText(record.provider) || "manual",
    providerMessageId: cleanText(record.providerMessageId),
    error: cleanText(record.error),
    notes: cleanText(record.notes),
    createdAt,
    updatedAt: cleanText(record.updatedAt) || createdAt,
    approvedAt: cleanText(record.approvedAt),
    queuedAt: cleanText(record.queuedAt),
    sentAt: cleanText(record.sentAt),
  };
}

function normalizeState(input = {}) {
  return {
    version: 1,
    records: Array.isArray(input.records) ? input.records.map(normalizeRecord).filter((record) => record.websiteId) : [],
  };
}

async function readState() {
  try {
    return normalizeState(JSON.parse(await readFile(OUTREACH_QUEUE_FILE, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return { version: 1, records: [] };
    throw err;
  }
}

async function writeState(state) {
  const normalized = normalizeState(state);
  await writeJsonFileSafe(OUTREACH_QUEUE_FILE, normalized);
  return normalized;
}

export async function listOutreachQueueRecords() {
  return (await readState()).records;
}

export async function latestOutreachForWebsite(websiteId) {
  return (await listOutreachQueueRecords())
    .filter((record) => record.websiteId === websiteId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] ?? null;
}

export async function createOutreachDraft({ website, subject, body, channel = "email", to = "" } = {}) {
  if (!website?.websiteId) throw new Error("Website is required for outreach.");
  if (!website.deployedUrl) throw new Error("Outreach requires a deployed public URL.");
  const lead = website.lead ?? {};
  const finalSubject = cleanText(subject) || `${website.businessName}: quick website preview`;
  const finalBody = cleanText(body) || [
    `Hi ${website.businessName} team,`,
    "",
    `I put together a public preview for your website: ${website.deployedUrl}`,
    "",
    "If you want, I can walk through what I changed and the next step to launch it.",
    "",
    "- Website Outreach Engine",
  ].join("\n");
  const record = normalizeRecord({
    websiteId: website.websiteId,
    leadId: website.mapping?.leadId,
    channel,
    to: to || lead.email || lead.phone || "",
    subject: finalSubject,
    body: finalBody,
    approvalStatus: "draft",
    sendStatus: "drafted",
  });
  const state = await readState();
  state.records.push(record);
  await writeState(state);
  return record;
}

export async function approveAndQueueOutreach(outreachId) {
  const state = await readState();
  const index = state.records.findIndex((record) => record.outreachId === outreachId);
  if (index === -1) throw new Error("Outreach record not found.");
  const now = nowIso();
  state.records[index] = normalizeRecord({
    ...state.records[index],
    approvalStatus: "approved",
    sendStatus: "queued",
    approvedAt: state.records[index].approvedAt || now,
    queuedAt: now,
    updatedAt: now,
  });
  await writeState(state);
  return state.records[index];
}

export async function markOutreachSent(outreachId, { provider = "manual", providerMessageId = "", notes = "" } = {}) {
  const state = await readState();
  const index = state.records.findIndex((record) => record.outreachId === outreachId);
  if (index === -1) throw new Error("Outreach record not found.");
  if (state.records[index].approvalStatus !== "approved") {
    throw new Error("Outreach must be approved before marking sent.");
  }
  const now = nowIso();
  state.records[index] = normalizeRecord({
    ...state.records[index],
    sendStatus: "sent",
    provider,
    providerMessageId,
    notes,
    sentAt: now,
    updatedAt: now,
  });
  await writeState(state);
  return state.records[index];
}
