import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR } from "../storage.js";
import { readJsonDocument, writeJsonDocument } from "../persistence/json-document-store.js";
import { cleanText, nowIso } from "../stage1/shared.js";

export const CALL_SESSIONS_FILE = join(DATA_DIR, "call-sessions.json");

async function readSessionMap() {
  const parsed = await readJsonDocument(CALL_SESSIONS_FILE);
  if (!parsed || typeof parsed !== "object") {
    return { version: 1, sessions: {} };
  }
  if (!parsed.sessions || typeof parsed.sessions !== "object") {
    return { version: 1, sessions: {} };
  }
  return parsed;
}

async function writeSessionMap(data) {
  await writeJsonDocument(CALL_SESSIONS_FILE, {
    version: 1,
    sessions: data.sessions ?? {},
    updatedAt: nowIso(),
  });
}

export function newCallSessionId() {
  return `call_${randomUUID().slice(0, 8)}`;
}

export async function createCallSession({ businessId, businessName, prospectPhone }) {
  const id = newCallSessionId();
  const session = {
    id,
    businessId: cleanText(businessId),
    businessName: cleanText(businessName),
    prospectPhone: cleanText(prospectPhone),
    twilioCallSid: null,
    status: "initiated",
    events: [],
    startedAt: nowIso(),
    completedAt: null,
    error: null,
  };

  const doc = await readSessionMap();
  doc.sessions[id] = session;
  await writeSessionMap(doc);
  return session;
}

export async function getCallSession(sessionId) {
  const doc = await readSessionMap();
  return doc.sessions[cleanText(sessionId)] ?? null;
}

export async function getCallSessionByCallSid(callSid) {
  const needle = cleanText(callSid);
  if (!needle) return null;
  const doc = await readSessionMap();
  for (const session of Object.values(doc.sessions)) {
    if (session?.twilioCallSid === needle) return session;
  }
  return null;
}

export async function updateCallSession(sessionId, patch) {
  const doc = await readSessionMap();
  const existing = doc.sessions[cleanText(sessionId)];
  if (!existing) return null;

  const next = {
    ...existing,
    ...patch,
    events: patch.events ?? existing.events,
  };
  doc.sessions[existing.id] = next;
  await writeSessionMap(doc);
  return next;
}

export async function appendCallSessionEvent(sessionId, event, detail = {}) {
  const session = await getCallSession(sessionId);
  if (!session) return null;

  const events = Array.isArray(session.events) ? [...session.events] : [];
  events.push({
    at: nowIso(),
    event: cleanText(event),
    ...detail,
  });

  return updateCallSession(sessionId, { events });
}
