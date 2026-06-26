import { readFile } from "node:fs/promises";

const ROOT = new URL("../../../", import.meta.url);

async function loadMarkets() {
  const file = new URL("engine-data/markets/markets.json", ROOT);
  return JSON.parse(await readFile(file, "utf8"));
}

export async function rankMarkets() {
  const markets = await loadMarkets();
  return [...markets].sort((a, b) => b.priority - a.priority);
}
