import { readFile } from "node:fs/promises";

const ROOT = new URL("../../../", import.meta.url);

export async function listOffers() {
  const file = new URL("engine-data/offers/offers.json", ROOT);
  return JSON.parse(await readFile(file, "utf8"));
}

export async function getOfferById(id) {
  const offers = await listOffers();
  return offers.find((offer) => offer.id === id) || null;
}
