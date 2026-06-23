import { cleanText, nowIso } from "../stage1/shared.js";
import { getRecordById, listRecords, upsertRecord } from "./collection.js";
import { newBusinessId } from "./ids.js";
import { BUSINESSES_FILE } from "./paths.js";
import { validateBusiness } from "./validate.js";

const COLLECTION_KEY = "businesses";

export function emptyBusinessSignals() {
  return {
    hasWebsite: null,
    websiteQualityScore: null,
    hasContactForm: null,
    reviewCount: null,
    rating: null,
    hasPhone: null,
    hasEmail: null,
    socialProfileCount: null,
  };
}

export function buildBusiness(input = {}) {
  const stamp = nowIso();
  const tags = Array.isArray(input.tags) ? input.tags.map((t) => cleanText(t)).filter(Boolean) : [];

  return {
    id: cleanText(input.id) || newBusinessId(),
    name: cleanText(input.name),
    industry: cleanText(input.industry) || null,
    region: cleanText(input.region),
    city: cleanText(input.city) || null,
    state: cleanText(input.state).toUpperCase() || null,
    address: cleanText(input.address) || null,
    website: cleanText(input.website) || null,
    tags,
    signals: {
      ...emptyBusinessSignals(),
      ...(input.signals && typeof input.signals === "object" ? input.signals : {}),
    },
    dedupKey: cleanText(input.dedupKey),
    identityId: cleanText(input.identityId) || null,
    source:
      input.source && typeof input.source === "object"
        ? input.source
        : null,
    legacyId: cleanText(input.legacyId) || null,
    createdAt: input.createdAt || stamp,
    updatedAt: stamp,
  };
}

export async function listBusinesses() {
  return listRecords(BUSINESSES_FILE, COLLECTION_KEY);
}

export async function getBusiness(id) {
  return getRecordById(BUSINESSES_FILE, id, COLLECTION_KEY);
}

export async function getBusinessByDedupKey(dedupKey) {
  const needle = cleanText(dedupKey);
  const businesses = await listBusinesses();
  return businesses.find((row) => row.dedupKey === needle) ?? null;
}

export async function getBusinessByLegacyId(legacyId) {
  const needle = cleanText(legacyId);
  const businesses = await listBusinesses();
  return businesses.find((row) => row.legacyId === needle) ?? null;
}

export async function listBusinessesByRegion(region) {
  const needle = cleanText(region);
  const businesses = await listBusinesses();
  return businesses.filter((row) => row.region === needle);
}

export async function saveBusiness(input = {}) {
  const existing = input.id ? await getBusiness(input.id) : null;
  const record = buildBusiness({
    ...existing,
    ...input,
    signals: { ...(existing?.signals ?? {}), ...(input.signals ?? {}) },
    tags: input.tags ?? existing?.tags,
    updatedAt: nowIso(),
  });
  validateBusiness(record);
  return upsertRecord(BUSINESSES_FILE, record, {
    collectionKey: COLLECTION_KEY,
    validate: validateBusiness,
    uniqueFields: [{ field: "dedupKey", message: "Business dedupKey must be unique" }],
  });
}
