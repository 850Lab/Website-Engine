import {
  cleanText,
  normalizeBusinessName,
  normalizePhoneNumber,
  nowIso,
} from "../../src/stage1/shared.js";
import { buildBusiness, emptyBusinessSignals } from "../../src/schema/business.js";
import { buildContact } from "../../src/schema/contact.js";
import { newBusinessId } from "../../src/schema/ids.js";

function tagsFromPwFlags(flags = {}) {
  return Object.entries(flags)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);
}

function computeHasWebsite(record) {
  const url = cleanText(record.websiteUrl || record.website);
  if (!url) return false;
  const status = cleanText(record.websiteStatus).toLowerCase();
  if (status === "no_website") return false;
  return true;
}

function mapQualifiedToBusiness(record, wqsByLegacyId) {
  const legacyId = record.id;
  const wqs = wqsByLegacyId.get(legacyId);
  const websiteUrl = cleanText(record.websiteUrl);
  const signals = {
    ...emptyBusinessSignals(),
    reviewCount: record.googleReviewCount ?? null,
    rating: record.googleRating ?? null,
    hasWebsite: computeHasWebsite(record),
    websiteQualityScore: wqs?.websiteScore ?? record.websiteScore ?? null,
    hasContactForm:
      wqs?.signals?.noBookingForm === false ? true : wqs?.signals?.noBookingForm === true ? false : null,
    hasPhone: Boolean(cleanText(record.normalizedPhone || record.phone)),
    hasEmail: Boolean(cleanText(record.email)),
    socialProfileCount: Array.isArray(record.socialUrls) ? record.socialUrls.length : 0,
  };

  return buildBusiness({
    id: newBusinessId(),
    legacyId,
    name: record.businessName,
    industry: cleanText(record.industry) || cleanText(record.category),
    region: cleanText(record.city) || "Unknown",
    city: cleanText(record.city),
    state: cleanText(record.state),
    address: cleanText(record.address),
    website: websiteUrl || null,
    tags: record.source === "twilio_test" ? ["legacy:twilio_test"] : [],
    signals,
    dedupKey: cleanText(record.dedupKey) || `legacy:qbd:${legacyId}`,
    identityId: cleanText(record.businessIdentityId) || null,
    source: {
      adapterId: cleanText(record.source) || "google_maps",
      discoveredAt: record.dateFound ?? record.updatedAt ?? nowIso(),
      legacy: {
        discoveryRunId: record.discoveryRunId ?? null,
        googleMapsUrl: record.googleMapsUrl ?? null,
        qualificationStatus: record.qualificationStatus ?? null,
        socialUrls: record.socialUrls ?? [],
      },
    },
    createdAt: record.dateFound ?? nowIso(),
    updatedAt: record.updatedAt ?? nowIso(),
  });
}

function mapPwToBusiness(record) {
  const legacyId = record.id;
  const phone = cleanText(record.normalizedPhone || record.phone);
  const dedupKey =
    phone && phone.replace(/\D/g, "").length >= 10
      ? `phone:${normalizePhoneNumber(phone)}`
      : `pw:name:${normalizeBusinessName(record.businessName)}|${cleanText(record.city).toLowerCase()}`;

  return buildBusiness({
    id: newBusinessId(),
    legacyId,
    name: record.businessName,
    industry: cleanText(record.industry),
    region: cleanText(record.city) || "Unknown",
    city: cleanText(record.city),
    state: "TX",
    address: cleanText(record.address),
    website: cleanText(record.website) || null,
    tags: tagsFromPwFlags(record.flags),
    signals: {
      ...emptyBusinessSignals(),
      reviewCount: record.reviewCount ?? null,
      rating: record.googleRating ?? null,
      hasWebsite: Boolean(cleanText(record.website)),
      hasPhone: Boolean(phone),
      hasEmail: false,
      socialProfileCount: 0,
    },
    dedupKey,
    source: {
      adapterId: cleanText(record.source) || "manual",
      sourceQuery: cleanText(record.sourceQuery) || null,
      discoveredAt: record.discoveredAt ?? record.createdAt ?? nowIso(),
      legacy: {
        googleMapsUrl: record.googleMapsUrl ?? null,
        pwFlags: record.flags ?? {},
      },
    },
    createdAt: record.createdAt ?? nowIso(),
    updatedAt: record.updatedAt ?? nowIso(),
  });
}

function mergeBusinesses(primary, secondary) {
  const tags = [...new Set([...(primary.tags ?? []), ...(secondary.tags ?? [])])];
  return buildBusiness({
    ...primary,
    tags,
    signals: {
      ...(primary.signals ?? {}),
      ...(secondary.signals ?? {}),
      reviewCount: secondary.signals?.reviewCount ?? primary.signals?.reviewCount,
      rating: secondary.signals?.rating ?? primary.signals?.rating,
    },
    source: {
      ...(primary.source ?? {}),
      legacy: {
        ...(primary.source?.legacy ?? {}),
        mergedLegacyIds: {
          ...(primary.source?.legacy?.mergedLegacyIds ?? {}),
          pw: secondary.legacyId,
        },
      },
    },
    updatedAt: nowIso(),
  });
}

function buildContactsForBusiness(business, legacyRecord, source) {
  const contacts = [];
  const phone = cleanText(legacyRecord.normalizedPhone || legacyRecord.phone);
  if (phone) {
    contacts.push(
      buildContact({
        businessId: business.id,
        type: "phone",
        value: phone,
        isPrimary: true,
        isCallable: phone.replace(/\D/g, "").length >= 10,
        source,
      }),
    );
  }

  const email = cleanText(legacyRecord.email);
  if (email) {
    contacts.push(
      buildContact({
        businessId: business.id,
        type: "email",
        value: email,
        isPrimary: true,
        isCallable: false,
        source,
      }),
    );
  }

  const owner = cleanText(legacyRecord.ownerOrManagerName);
  if (owner) {
    contacts.push(
      buildContact({
        businessId: business.id,
        type: "person",
        value: owner,
        role: cleanText(legacyRecord.contactRole) || "Owner/Manager",
        isPrimary: false,
        isCallable: false,
        source,
      }),
    );
  }

  return contacts;
}

export function migrateBusinessesAndContacts(legacy, wqsByLegacyId) {
  const idMap = {};
  const legacyMeta = { qualified: {}, pw: {} };
  const warnings = [];
  const phoneToBusinessId = new Map();
  const businesses = [];
  const contacts = [];

  for (const record of legacy.qualifiedBusinesses) {
    const business = mapQualifiedToBusiness(record, wqsByLegacyId);
    businesses.push(business);
    idMap[record.id] = { businessId: business.id, source: "qualified-businesses" };
    legacyMeta.qualified[record.id] = record;

    const phoneNorm = normalizePhoneNumber(record.normalizedPhone || record.phone);
    if (phoneNorm) phoneToBusinessId.set(phoneNorm, business.id);

    contacts.push(...buildContactsForBusiness(business, record, "qualified-businesses"));
  }

  const businessById = Object.fromEntries(businesses.map((b) => [b.id, b]));

  for (const record of legacy.pwLeads) {
    const pwPhoneNorm = normalizePhoneNumber(record.normalizedPhone || record.phone);
    let businessId = pwPhoneNorm ? phoneToBusinessId.get(pwPhoneNorm) : null;
    let business;

    if (businessId && businessById[businessId]) {
      business = mergeBusinesses(businessById[businessId], mapPwToBusiness(record));
      businessById[businessId] = business;
      const idx = businesses.findIndex((b) => b.id === businessId);
      if (idx !== -1) businesses[idx] = business;
      idMap[record.id] = {
        businessId: business.id,
        source: "pressure-washing",
        mergedInto: business.legacyId,
      };
      warnings.push({
        type: "cross_store_merge",
        pwLegacyId: record.id,
        businessId: business.id,
      });
    } else {
      business = mapPwToBusiness(record);
      businesses.push(business);
      businessById[business.id] = business;
      idMap[record.id] = { businessId: business.id, source: "pressure-washing" };
      contacts.push(...buildContactsForBusiness(business, record, "pressure-washing"));
    }

    legacyMeta.pw[record.id] = record;
  }

  return { businesses, contacts, idMap, legacyMeta, warnings };
}

export function buildWqsIndex(scores = []) {
  const map = new Map();
  for (const row of scores) {
    if (row.businessId) map.set(row.businessId, row);
  }
  return map;
}
