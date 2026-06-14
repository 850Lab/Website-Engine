import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "../storage.js";
import { GoogleMapsAdapter } from "./google-maps-adapter.js";
import { STUB_ADAPTERS } from "./stub-adapters.js";
import { nowIso } from "../stage1/shared.js";

const STATS_FILE = join(DATA_DIR, "adapter-registry-stats.json");

const adapters = new Map();

function register(adapter) {
  adapters.set(adapter.id, adapter);
}

register(new GoogleMapsAdapter());
for (const stub of STUB_ADAPTERS) {
  register(stub);
}

async function readStats() {
  try {
    const parsed = JSON.parse(await readFile(STATS_FILE, "utf8"));
    return parsed?.adapters ?? {};
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function writeStats(adapterStats) {
  await writeJsonFileSafe(STATS_FILE, { version: 1, adapters: adapterStats, updatedAt: nowIso() });
}

export function getAdapter(adapterId) {
  return adapters.get(adapterId) ?? null;
}

export function listAdapters() {
  return [...adapters.values()];
}

export function getEnabledAdapters() {
  return listAdapters().filter((adapter) => adapter.enabled);
}

export async function recordAdapterRun(adapterId, result) {
  const all = await readStats();
  const current = all[adapterId] ?? {
    businessesFound: 0,
    businessesAdded: 0,
    duplicatesResolved: 0,
    errors: 0,
    lastRunAt: null,
  };

  current.businessesFound += result.businessesFound ?? 0;
  current.businessesAdded += result.businessesAdded ?? 0;
  current.duplicatesResolved += result.duplicatesResolved ?? 0;
  current.errors += result.errors ?? 0;
  current.lastRunAt = nowIso();

  all[adapterId] = current;
  await writeStats(all);
  return current;
}

export async function getAdapterRegistryView() {
  const stats = await readStats();
  return listAdapters().map((adapter) => ({
    id: adapter.id,
    name: adapter.name,
    description: adapter.description,
    enabled: adapter.enabled,
    stats: stats[adapter.id] ?? {
      businessesFound: 0,
      businessesAdded: 0,
      duplicatesResolved: 0,
      errors: 0,
      lastRunAt: null,
    },
  }));
}
