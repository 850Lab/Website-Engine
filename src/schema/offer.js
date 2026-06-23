import { cleanText, nowIso } from "../stage1/shared.js";
import { OFFER_STATUSES } from "./constants.js";
import { getRecordById, listRecords, upsertRecord } from "./collection.js";
import { newOfferId } from "./ids.js";
import { OFFERS_FILE } from "./paths.js";
import { validateOffer } from "./validate.js";

const COLLECTION_KEY = "offers";

export function buildOffer(input = {}) {
  const stamp = nowIso();
  return {
    id: cleanText(input.id) || newOfferId(),
    name: cleanText(input.name),
    slug: cleanText(input.slug).toLowerCase().replace(/\s+/g, "-"),
    category: cleanText(input.category) || null,
    description: cleanText(input.description) || null,
    status: OFFER_STATUSES.includes(input.status) ? input.status : "active",
    defaultAnglePack: cleanText(input.defaultAnglePack) || null,
    createdAt: input.createdAt || stamp,
    updatedAt: stamp,
  };
}

export async function listOffers() {
  return listRecords(OFFERS_FILE, COLLECTION_KEY);
}

export async function getOffer(id) {
  return getRecordById(OFFERS_FILE, id, COLLECTION_KEY);
}

export async function getOfferBySlug(slug) {
  const needle = cleanText(slug).toLowerCase();
  const offers = await listOffers();
  return offers.find((row) => row.slug === needle) ?? null;
}

export async function saveOffer(input = {}) {
  const existing = input.id ? await getOffer(input.id) : null;
  const record = buildOffer({ ...existing, ...input, updatedAt: nowIso() });
  validateOffer(record);
  return upsertRecord(OFFERS_FILE, record, {
    collectionKey: COLLECTION_KEY,
    validate: validateOffer,
    uniqueFields: [{ field: "slug", message: "Offer slug must be unique" }],
  });
}
