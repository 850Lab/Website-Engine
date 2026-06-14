import { cleanText, normalizeBusinessName, normalizePhoneNumber, nowIso } from "../stage1/shared.js";

/**
 * Unified discovery record — every adapter must output this shape.
 */
export function createDiscoveryRecord(input = {}) {
  return {
    businessName: cleanText(input.businessName),
    category: cleanText(input.category),
    industry: cleanText(input.industry),
    phone: cleanText(input.phone),
    email: cleanText(input.email),
    website: cleanText(input.website),
    address: cleanText(input.address),
    city: cleanText(input.city),
    state: cleanText(input.state).toUpperCase(),
    source: cleanText(input.source),
    sourceUrl: cleanText(input.sourceUrl),
    discoveredAt: input.discoveredAt ?? nowIso(),
    facebookUrl: cleanText(input.facebookUrl),
    instagramUrl: cleanText(input.instagramUrl),
    linkedinUrl: cleanText(input.linkedinUrl),
    reviewCount: Number(input.reviewCount) || 0,
    rating: Number(input.rating) || 0,
    licenseNumber: cleanText(input.licenseNumber),
    googleMapsUrl: cleanText(input.googleMapsUrl),
    metadata: input.metadata ?? {},
  };
}

export function normalizeWebsiteUrl(url) {
  const trimmed = cleanText(url);
  if (!trimmed || trimmed === "[EXISTS]") return "";
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return `${parsed.protocol}//${parsed.hostname.replace(/^www\./, "").toLowerCase()}${parsed.pathname.replace(/\/$/, "") || ""}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

export function normalizeAddress(address) {
  return normalizeBusinessName(address).replace(/\s+/g, " ").trim();
}

export function identitySignalsFromDiscovery(record) {
  return {
    businessName: record.businessName,
    category: cleanText(record.category),
    industry: cleanText(record.industry),
    city: record.city,
    state: record.state,
    website: record.website,
    phone: record.phone,
    email: record.email,
    facebookUrl: record.facebookUrl,
    instagramUrl: record.instagramUrl,
    linkedinUrl: record.linkedinUrl,
    googleMapsUrl: record.googleMapsUrl || record.sourceUrl,
    address: record.address,
    source: record.source,
    sourceUrl: record.sourceUrl,
  };
}
