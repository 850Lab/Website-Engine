import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";

export const REPLY_INBOX_FILE = join(DATA_DIR, "reply-inbox.json");

export const INBOUND_REPLY_STATUSES = ["pending", "captured", "classified", "human_review", "ignored"];
export const REPLY_CLASSIFICATIONS = ["interested", "needs_follow_up", "not_interested", "unclear", "spam"];

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

function normalizeReply(record = {}) {
  const receivedAt = cleanText(record.receivedAt) || nowIso();
  return {
    inboundReplyId: cleanText(record.inboundReplyId) || `inbound_reply_${randomUUID()}`,
    websiteId: cleanText(record.websiteId),
    leadId: cleanText(record.leadId),
    outreachId: cleanText(record.outreachId),
    revenueId: cleanText(record.revenueId),
    provider: cleanText(record.provider) || "placeholder",
    providerMessageId: cleanText(record.providerMessageId),
    from: cleanText(record.from),
    channel: cleanText(record.channel) || "email",
    replyText: cleanText(record.replyText),
    status: clamp(record.status, INBOUND_REPLY_STATUSES, "pending"),
    classification: clamp(record.classification, REPLY_CLASSIFICATIONS, ""),
    classificationReason: cleanText(record.classificationReason),
    humanReview: Boolean(record.humanReview),
    capturedAt: cleanText(record.capturedAt),
    classifiedAt: cleanText(record.classifiedAt),
    receivedAt,
    createdAt: cleanText(record.createdAt) || receivedAt,
    updatedAt: cleanText(record.updatedAt) || receivedAt,
    metadata: record.metadata && typeof record.metadata === "object" ? record.metadata : {},
  };
}

function normalizeState(input = {}) {
  return {
    version: 1,
    records: Array.isArray(input.records)
      ? input.records.map(normalizeReply).filter((record) => record.replyText)
      : [],
  };
}

async function readState() {
  try {
    return normalizeState(JSON.parse(await readFile(REPLY_INBOX_FILE, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return { version: 1, records: [] };
    throw err;
  }
}

async function writeState(state) {
  const normalized = normalizeState(state);
  await writeJsonFileSafe(REPLY_INBOX_FILE, normalized);
  return normalized;
}

export async function listInboundReplies({ websiteId = "", status = "" } = {}) {
  const state = await readState();
  return state.records
    .filter((record) => !websiteId || record.websiteId === websiteId)
    .filter((record) => !status || record.status === status)
    .sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
}

export async function createPlaceholderInboundReply(input = {}) {
  const result = await createInboundReply({
    ...input,
    provider: input.provider || "placeholder_manual",
  });
  return result.reply;
}

export async function createInboundReply(input = {}) {
  const record = normalizeReply({
    ...input,
    status: "pending",
  });
  const state = await readState();
  const duplicate = record.provider && record.providerMessageId
    ? state.records.find(
      (existing) => existing.provider === record.provider && existing.providerMessageId === record.providerMessageId
    )
    : null;
  if (duplicate) return { reply: duplicate, duplicate: true };
  state.records.push(record);
  await writeState(state);
  return { reply: record, duplicate: false };
}

export async function updateInboundReply(inboundReplyId, patch = {}) {
  const state = await readState();
  const index = state.records.findIndex((record) => record.inboundReplyId === inboundReplyId);
  if (index === -1) throw new Error("Inbound reply not found.");
  state.records[index] = normalizeReply({
    ...state.records[index],
    ...patch,
    updatedAt: nowIso(),
  });
  await writeState(state);
  return state.records[index];
}
