import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR } from "../storage.js";
import { readJsonDocument, writeJsonDocument } from "../persistence/json-document-store.js";
import { sanitizeOperator } from "./store.js";

export const SESSIONS_FILE = join(DATA_DIR, "operator-sessions.json");
export const SESSION_COOKIE = "pivotal_operator_session";
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;

const sessions = new Map();
let sessionsLoaded = false;

async function loadPersistedSessions() {
  if (sessionsLoaded) return;
  sessionsLoaded = true;
  const parsed = await readJsonDocument(SESSIONS_FILE);
  const now = Date.now();
  for (const [token, session] of Object.entries(parsed?.sessions ?? {})) {
    if (session?.expiresAt && session.expiresAt > now) {
      sessions.set(token, session);
    }
  }
}

async function savePersistedSessions() {
  const now = Date.now();
  const activeSessions = {};
  for (const [token, session] of sessions.entries()) {
    if (session?.expiresAt && session.expiresAt > now) {
      activeSessions[token] = session;
    } else {
      sessions.delete(token);
    }
  }
  await writeJsonDocument(SESSIONS_FILE, {
    version: 1,
    sessions: activeSessions,
    updatedAt: new Date().toISO() },
  );
}

export async function getSessionForRequest(req) {
  await loadPersistedSessions();
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || !session.expiresAt || session.expiresAt <= Date.now()) {
    if (token) {
      sessions.delete(token);
      await savePersistedSessions();
    }
    return null;
  }
  return session;
}

export async function createOperatorSession(res, operator) {
  const token = randomBytes(24).toString("hex");
  const now = Date.now();
  const safe = sanitizeOperator(operator);
  const session = {
    token,
    operatorId: safe.id,
    operatorName: safe.name,
    operatorEmail: safe.email,
    operatorRole: safe.role,
    createdAt: now,
    expiresAt: now + SESSION_MAX_AGE_MS,
  };
  sessions.set(token, session);
  await savePersistedSessions();
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_MS,
  });
  return session;
}

export async function destroyOperatorSession(req, res) {
  await loadPersistedSessions();
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) sessions.delete(token);
  await savePersistedSessions();
  res.clearCookie(SESSION_COOKIE);
}

export function operatorFromSession(session) {
  if (!session?.operatorId) return null;
  return {
    id: session.operatorId,
    name: session.operatorName,
    email: session.operatorEmail,
    role: session.operatorRole,
  };
}

export function operatorFromRequest(req) {
  return operatorFromSession(req.session ?? req.operatorSession);
}
