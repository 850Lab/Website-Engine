import { readFile } from "node:fs/promises";
import { getCapabilityById, listCapabilities } from "../capabilities/index.js";
import { normalizeOffer } from "./normalize.js";

const ROOT = new URL("../../../", import.meta.url);
const REGISTRY_VERSION = "2.8.0";

let cachedOffers = null;

export function getOfferRegistryVersion() {
  return REGISTRY_VERSION;
}

export { listCapabilities, getCapabilityById };

export async function listOffers() {
  if (cachedOffers) {
    return cachedOffers.map((row) => structuredClone(row));
  }
  const file = new URL("engine-data/offers/offers.json", ROOT);
  const raw = JSON.parse(await readFile(file, "utf8"));
  cachedOffers = raw.map((row) => normalizeOffer(row));
  return cachedOffers.map((row) => structuredClone(row));
}

export async function getOfferById(id) {
  const offers = await listOffers();
  return offers.find((offer) => offer.id === id) || null;
}

async function attachCapabilities(offer) {
  if (!offer) return null;
  const capabilityIds = Array.isArray(offer.capabilityIds) ? offer.capabilityIds : [];
  const capabilities = (
    await Promise.all(capabilityIds.map((capabilityId) => getCapabilityById(capabilityId)))
  ).filter(Boolean);

  return {
    ...offer,
    capabilityIds,
    capabilities,
  };
}

export async function getOfferWithCapabilities(id) {
  return attachCapabilities(await getOfferById(id));
}

export async function listOffersWithCapabilities() {
  const offers = await listOffers();
  return Promise.all(offers.map((offer) => attachCapabilities(offer)));
}

export async function getOffersByCapabilityId(capabilityId) {
  const offers = await listOffers();
  return offers.filter((offer) => offer.capabilityIds.includes(capabilityId));
}

export function clearOfferCacheForTests() {
  cachedOffers = null;
}

export { normalizeOffer } from "./normalize.js";
