import { readFile } from "node:fs/promises";

const ROOT = new URL("../../../", import.meta.url);

export async function listCapabilities() {
  const file = new URL("engine-data/capabilities/capabilities.json", ROOT);
  return JSON.parse(await readFile(file, "utf8"));
}

export async function getCapabilityById(id) {
  const capabilities = await listCapabilities();
  return capabilities.find((capability) => capability.id === id) || null;
}
