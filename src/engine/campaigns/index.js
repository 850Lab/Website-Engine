import { readFile } from "node:fs/promises";

const ROOT = new URL("../../../", import.meta.url);

async function loadJson(relativePath) {
  const file = new URL(relativePath, ROOT);
  return JSON.parse(await readFile(file, "utf8"));
}

export async function getActiveMission() {
  const active = await loadJson("engine-data/campaigns/active.json");
  const missions = await loadJson("engine-data/campaigns/campaigns.json");

  return missions.find(
    (mission) => mission.id === active.missionId,
  );
}
