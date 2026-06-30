import {
  ensureDirectory,
  ensureRuntimeDirectories,
  getRuntimeMissionStorePath,
  readJsonWithRetry,
  writeJsonAtomicWithRetry,
  toRepoRelativePath,
} from "../runtime/index.js";
import { dirname } from "node:path";
import { normalizeMission, nowIso, MISSION_STATUSES } from "./mission-schema.js";
import { assertValidMission } from "./mission-validator.js";

async function loadStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeMissionStorePath();
  const store = await readJsonWithRetry(path, null);
  if (store?.missions) return store;
  return {
    metadata: {
      updatedAt: nowIso(),
      storageMode: "runtime_only",
      runtimeStorePath: toRepoRelativePath(path),
    },
    missions: [],
  };
}

async function saveStore(store) {
  await ensureRuntimeDirectories();
  const path = getRuntimeMissionStorePath();
  await ensureDirectory(dirname(path));
  store.metadata = {
    ...store.metadata,
    updatedAt: nowIso(),
    storageMode: "runtime_only",
    runtimeStorePath: toRepoRelativePath(path),
  };
  await writeJsonAtomicWithRetry(path, store);
  return path;
}

export async function listMissions(options = {}) {
  const store = await loadStore();
  let missions = store.missions.map((row) => normalizeMission(row));
  if (options.status) {
    missions = missions.filter((row) => row.status === options.status);
  }
  return missions;
}

export async function getMissionById(missionId) {
  const missions = await listMissions();
  return missions.find((row) => row.missionId === missionId) || null;
}

export async function getActiveMissions() {
  return listMissions({ status: "active" });
}

export async function saveMission(mission, options = {}) {
  const normalized = normalizeMission(mission);
  if (options.validate !== false) {
    await assertValidMission(normalized);
  }
  const store = await loadStore();
  const index = store.missions.findIndex((row) => row.missionId === normalized.missionId);
  if (index >= 0) {
    store.missions[index] = normalized;
  } else {
    store.missions.push(normalized);
  }
  const path = await saveStore(store);
  return { mission: normalized, path };
}

export async function activateMission(missionId) {
  const mission = await getMissionById(missionId);
  if (!mission) throw new Error(`Mission not found: ${missionId}`);
  mission.status = "active";
  return saveMission(mission);
}

export async function pauseMission(missionId) {
  const mission = await getMissionById(missionId);
  if (!mission) throw new Error(`Mission not found: ${missionId}`);
  mission.status = "paused";
  return saveMission(mission);
}

export async function archiveMission(missionId) {
  const mission = await getMissionById(missionId);
  if (!mission) throw new Error(`Mission not found: ${missionId}`);
  mission.status = "archived";
  return saveMission(mission);
}

export async function clearMissionStoreForTests() {
  const store = {
    metadata: { updatedAt: nowIso(), storageMode: "runtime_only" },
    missions: [],
  };
  await saveStore(store);
  return store;
}

export function getMissionRegistrySummary(missions = []) {
  const byStatus = Object.fromEntries(MISSION_STATUSES.map((status) => [status, 0]));
  for (const mission of missions) {
    byStatus[mission.status] = (byStatus[mission.status] || 0) + 1;
  }
  return {
    total: missions.length,
    byStatus,
    active: byStatus.active || 0,
  };
}
