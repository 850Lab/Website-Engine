import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import {
  ensureRuntimeDirectories,
  getRuntimeEventStorePath,
  toRepoRelativePath,
  appendJsonLineWithRetry,
  readJsonLinesWithRetry,
  safeFileExists,
} from "../runtime/index.js";

const STORE_VERSION = "3.1.0";

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return structuredClone(value);
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function normalizeEventInput(input = {}) {
  const createdAt = input.createdAt || nowIso();
  return {
    id: input.id || `evt_${randomUUID()}`,
    type: String(input.type || ""),
    subjectType: String(input.subjectType || ""),
    subjectId: String(input.subjectId || ""),
    payload: isObject(input.payload) ? input.payload : {},
    correlationId: String(input.correlationId || input.id || `corr_${randomUUID()}`),
    causationId: input.causationId ?? null,
    createdAt,
    metadata: isObject(input.metadata) ? input.metadata : {},
  };
}

function validateEvent(event) {
  const required = ["id", "type", "subjectType", "subjectId", "correlationId", "createdAt"];
  for (const field of required) {
    if (!event[field]) {
      throw new Error(`Event missing required field: ${field}`);
    }
  }
}

let eventCache = null;
let eventCachePath = null;

async function loadEvents() {
  await ensureRuntimeDirectories();
  const path = getRuntimeEventStorePath();
  if (eventCache && eventCachePath === path) {
    return eventCache;
  }
  const rows = await readJsonLinesWithRetry(path);
  eventCache = rows;
  eventCachePath = path;
  return eventCache;
}

function invalidateEventCache() {
  eventCache = null;
  eventCachePath = null;
}

export async function initializeEventStore() {
  await ensureRuntimeDirectories();
  return getRuntimeEventStorePath();
}

export function getEventStorePath() {
  return getRuntimeEventStorePath();
}

export async function appendEvent(input = {}) {
  const event = normalizeEventInput(input);
  validateEvent(event);

  const path = getRuntimeEventStorePath();
  await appendJsonLineWithRetry(path, event);
  invalidateEventCache();

  return clone(event);
}

export async function listEvents(options = {}) {
  const events = await loadEvents();
  let rows = [...events];

  if (options.type) {
    rows = rows.filter((row) => row.type === options.type);
  }
  if (options.subjectType) {
    rows = rows.filter((row) => row.subjectType === options.subjectType);
  }
  if (options.subjectId) {
    rows = rows.filter((row) => row.subjectId === options.subjectId);
  }
  if (options.correlationId) {
    rows = rows.filter((row) => row.correlationId === options.correlationId);
  }

  return clone(rows);
}

export async function getEvent(id) {
  const events = await loadEvents();
  const row = events.find((item) => item.id === id);
  return row ? clone(row) : null;
}

export async function getEventsByType(type) {
  return listEvents({ type });
}

export async function getEventsByCorrelationId(correlationId) {
  return listEvents({ correlationId });
}

export async function getEventsBySubject(subjectType, subjectId) {
  return listEvents({ subjectType, subjectId });
}

export async function clearEventStoreForTests() {
  const path = getRuntimeEventStorePath();
  if (await safeFileExists(path)) {
    await unlink(path);
  }
  invalidateEventCache();
}

export function getEventStoreMetadata() {
  return {
    version: STORE_VERSION,
    storageMode: "runtime_append_only",
    runtimeStorePath: toRepoRelativePath(getRuntimeEventStorePath()),
  };
}
