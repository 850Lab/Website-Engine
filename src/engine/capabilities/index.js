import { readFile } from "node:fs/promises";
import { normalizeCapability } from "./normalize.js";

const ROOT = new URL("../../../", import.meta.url);
const REGISTRY_VERSION = "2.7.0";

let cachedCapabilities = null;

export function getCapabilityRegistryVersion() {
  return REGISTRY_VERSION;
}

export async function listCapabilities() {
  if (cachedCapabilities) {
    return cachedCapabilities.map((row) => structuredClone(row));
  }
  const file = new URL("engine-data/capabilities/capabilities.json", ROOT);
  const raw = JSON.parse(await readFile(file, "utf8"));
  cachedCapabilities = raw.map((row) => normalizeCapability(row));
  return cachedCapabilities.map((row) => structuredClone(row));
}

export async function getCapabilityById(id) {
  const capabilities = await listCapabilities();
  return capabilities.find((capability) => capability.id === id) || null;
}

export async function getCapabilitiesByIds(ids = []) {
  const capabilities = await listCapabilities();
  const lookup = new Set(ids.map(String));
  return capabilities.filter((capability) => lookup.has(capability.id));
}

export function clearCapabilityCacheForTests() {
  cachedCapabilities = null;
}
