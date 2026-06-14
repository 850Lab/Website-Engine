import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DATA_DIR, writeJsonFileSafe } from "../storage.js";
import { cleanText, nowIso } from "./shared.js";

export const FUNNEL_EVENTS_FILE = join(DATA_DIR, "funnel-events.json");

const ALLOWED_EVENTS = new Set([
  "preview_viewed",
  "preview_engaged",
  "launch_page_viewed",
  "price_viewed",
  "tell_me_more",
  "launch_started",
  "launch_purchased",
  "activation_completed",
  "dashboard_viewed",
]);

async function readState() {
  try {
    const parsed = JSON.parse(await readFile(FUNNEL_EVENTS_FILE, "utf8"));
    return Array.isArray(parsed?.records) ? parsed.records : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeState(records) {
  await writeJsonFileSafe(FUNNEL_EVENTS_FILE, { version: 1, records });
}

export async function recordFunnelEvent({ projectId, event, sessionId, meta = {} } = {}) {
  const name = cleanText(event);
  if (!ALLOWED_EVENTS.has(name)) {
    throw new Error(`Unsupported funnel event: ${event}`);
  }
  if (!cleanText(projectId)) throw new Error("projectId is required");

  const records = await readState();
  const entry = {
    id: `fe_${randomUUID().slice(0, 8)}`,
    projectId,
    event: name,
    sessionId: cleanText(sessionId) || null,
    meta: meta && typeof meta === "object" ? meta : {},
    at: nowIso(),
  };
  records.push(entry);
  if (records.length > 50000) records.splice(0, records.length - 50000);
  await writeState(records);
  return entry;
}

export async function listFunnelEventsForProject(projectId, limit = 200) {
  const records = await readState();
  return records
    .filter((entry) => entry.projectId === projectId)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, limit);
}
