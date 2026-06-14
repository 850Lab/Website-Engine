import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DATA_DIR, writeJsonFileSafe } from "../storage.js";
import { cleanText, nowIso } from "./shared.js";

export const ACTIVITY_EVENTS_FILE = join(DATA_DIR, "activity-events.json");

async function readRecords() {
  try {
    const parsed = JSON.parse(await readFile(ACTIVITY_EVENTS_FILE, "utf8"));
    return Array.isArray(parsed?.records) ? parsed.records : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeRecords(records) {
  await writeJsonFileSafe(ACTIVITY_EVENTS_FILE, { version: 1, records });
}

export async function appendActivityEvent({
  projectId,
  type,
  headline,
  detail,
  geoLabel = "",
  cta = null,
} = {}) {
  const records = await readRecords();
  const entry = {
    id: `act_${randomUUID().slice(0, 8)}`,
    projectId: cleanText(projectId),
    type: cleanText(type),
    headline: cleanText(headline).slice(0, 120),
    detail: cleanText(detail).slice(0, 300),
    geoLabel: cleanText(geoLabel).slice(0, 80),
    occurredAt: nowIso(),
    cta: cta && typeof cta === "object" ? cta : null,
  };
  records.push(entry);
  await writeRecords(records);
  return entry;
}

export async function listActivityForProject(projectId, limit = 50) {
  const records = await readRecords();
  return records
    .filter((entry) => entry.projectId === projectId)
    .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)))
    .slice(0, limit);
}

export async function countActivityThisWeek(projectId, types = null) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const records = await readRecords();
  return records.filter((entry) => {
    if (entry.projectId !== projectId) return false;
    if (types && !types.includes(entry.type)) return false;
    return new Date(entry.occurredAt).getTime() >= weekAgo;
  }).length;
}
