import { readFile } from "node:fs/promises";
import { getCapabilityById, listCapabilities } from "../capabilities/index.js";

const ROOT = new URL("../../../", import.meta.url);

export { listCapabilities, getCapabilityById };

export async function listOffers() {
  const file = new URL("engine-data/offers/offers.json", ROOT);
  return JSON.parse(await readFile(file, "utf8"));
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
