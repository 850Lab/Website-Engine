import { cleanText, normalizeBusinessName, normalizePhoneNumber } from "../stage1/shared.js";
import { normalizeAddress, normalizeWebsiteUrl } from "../discovery-adapters/schema.js";
import {
  buildIdentityRecord,
  getBusinessIdentity,
  listBusinessIdentities,
  listBusinessSources,
  newBusinessIdentityId,
  saveBusinessIdentity,
} from "./identity-store.js";

function nameCityKey(name, city) {
  return `${normalizeBusinessName(name)}|${normalizeBusinessName(city)}`;
}

export async function buildIdentityIndex() {
  const identities = await listBusinessIdentities();
  const sources = await listBusinessSources();

  const byWebsite = new Map();
  const byPhone = new Map();
  const byMapsUrl = new Map();
  const byNameCity = new Map();
  const byAddress = new Map();
  const byOpportunityId = new Map();

  for (const identity of identities) {
    if (identity.website) byWebsite.set(normalizeWebsiteUrl(identity.website), identity.id);
    if (identity.normalizedPhone || identity.phone) {
      byPhone.set(normalizePhoneNumber(identity.normalizedPhone || identity.phone), identity.id);
    }
    if (identity.googleMapsUrl) byMapsUrl.set(cleanText(identity.googleMapsUrl).toLowerCase(), identity.id);
    if (identity.businessName && identity.city) {
      byNameCity.set(nameCityKey(identity.businessName, identity.city), identity.id);
    }
    if (identity.address) byAddress.set(normalizeAddress(identity.address), identity.id);
    if (identity.opportunityRecordId) byOpportunityId.set(identity.opportunityRecordId, identity.id);
  }

  for (const source of sources) {
    const url = cleanText(source.sourceUrl).toLowerCase();
    if (url.includes("google.com/maps") && source.businessIdentityId) {
      byMapsUrl.set(url, source.businessIdentityId);
    }
  }

  return { byWebsite, byPhone, byMapsUrl, byNameCity, byAddress, byOpportunityId };
}

/**
 * Resolve identity using priority:
 * 1. Website  2. Phone  3. Google Maps URL  4. Name+City  5. Address
 */
export async function resolveBusinessIdentity(signals, { opportunityRecordId } = {}) {
  const index = await buildIdentityIndex();

  const website = normalizeWebsiteUrl(signals.website);
  const phone = normalizePhoneNumber(signals.phone);
  const mapsUrl = cleanText(signals.googleMapsUrl || signals.sourceUrl).toLowerCase();
  const nameCity = nameCityKey(signals.businessName, signals.city);
  const address = normalizeAddress(signals.address);

  let matchedId =
    (website && index.byWebsite.get(website)) ||
    (phone && index.byPhone.get(phone)) ||
    (mapsUrl && index.byMapsUrl.get(mapsUrl)) ||
    (nameCity && index.byNameCity.get(nameCity)) ||
    (address && index.byAddress.get(address)) ||
    (opportunityRecordId && index.byOpportunityId.get(opportunityRecordId)) ||
    null;

  if (matchedId) {
    const existing = await getBusinessIdentity(matchedId);
    return { identity: existing, matched: true, matchReason: inferMatchReason(existing, signals) };
  }

  const identity = buildIdentityRecord({
    id: newBusinessIdentityId(),
    businessName: signals.businessName,
    industry: signals.industry,
    category: signals.category,
    city: signals.city,
    state: signals.state,
    address: signals.address,
    website: signals.website,
    phone: signals.phone,
    normalizedPhone: phone,
    email: signals.email,
    facebookUrl: signals.facebookUrl,
    instagramUrl: signals.instagramUrl,
    linkedinUrl: signals.linkedinUrl,
    googleMapsUrl: signals.googleMapsUrl,
    opportunityRecordId,
    sourceCount: 0,
  });

  await saveBusinessIdentity(identity);
  return { identity, matched: false, matchReason: "new_identity" };
}

function inferMatchReason(identity, signals) {
  const website = normalizeWebsiteUrl(signals.website);
  const phone = normalizePhoneNumber(signals.phone);
  const mapsUrl = cleanText(signals.googleMapsUrl || signals.sourceUrl).toLowerCase();

  if (website && normalizeWebsiteUrl(identity.website) === website) return "website";
  if (phone && normalizePhoneNumber(identity.normalizedPhone || identity.phone) === phone) return "phone";
  if (mapsUrl && cleanText(identity.googleMapsUrl).toLowerCase() === mapsUrl) return "google_maps_url";
  if (
    nameCityKey(identity.businessName, identity.city) === nameCityKey(signals.businessName, signals.city)
  ) {
    return "name_city";
  }
  if (normalizeAddress(identity.address) === normalizeAddress(signals.address)) return "address";
  return "linked";
}

export async function mergeIdentityFields(identity, signals) {
  const merged = {
    ...identity,
    businessName: identity.businessName || signals.businessName,
    industry: identity.industry || signals.industry,
    category: identity.category || signals.category,
    city: identity.city || signals.city,
    state: identity.state || signals.state,
    address: identity.address || signals.address,
    website: identity.website || signals.website,
    phone: identity.phone || signals.phone,
    normalizedPhone: identity.normalizedPhone || normalizePhoneNumber(signals.phone),
    email: identity.email || signals.email,
    facebookUrl: identity.facebookUrl || signals.facebookUrl,
    instagramUrl: identity.instagramUrl || signals.instagramUrl,
    linkedinUrl: identity.linkedinUrl || signals.linkedinUrl,
    googleMapsUrl: identity.googleMapsUrl || signals.googleMapsUrl,
  };
  return saveBusinessIdentity(merged);
}
