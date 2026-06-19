import { cleanText, normalizeBusinessName, normalizePhoneNumber } from "../stage1/shared.js";

export function extractPlaceId(googleMapsUrl = "") {
  const url = cleanText(googleMapsUrl);
  if (!url) return "";

  const hexMatch = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
  if (hexMatch) return hexMatch[1];

  const cidMatch = url.match(/[?&]cid=(\d+)/i);
  if (cidMatch) return `cid:${cidMatch[1]}`;

  const placeMatch = url.match(/\/maps\/place\/([^/@?]+)/i);
  if (placeMatch) return `place:${decodeURIComponent(placeMatch[1]).slice(0, 120)}`;

  return `maps:${url.split("?")[0]}`;
}

export function normalizeAddress(address = "") {
  return cleanText(address).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function buildDedupKeys(lead = {}) {
  const keys = [];
  const placeId = extractPlaceId(lead.googleMapsUrl);
  if (placeId) keys.push({ key: `place:${placeId}`, strength: "exact", reason: "google_maps_place_id" });

  const phone = normalizePhoneNumber(lead.normalizedPhone || lead.phone);
  if (phone) keys.push({ key: `phone:${phone.slice(-10)}`, strength: "exact", reason: "normalized_phone" });

  const name = normalizeBusinessName(lead.businessName);
  const address = normalizeAddress(lead.address);
  if (name && address) {
    keys.push({ key: `name_addr:${name}|${address}`, strength: "exact", reason: "name_and_address" });
  }

  const city = normalizeBusinessName(lead.city);
  if (name && city) {
    keys.push({ key: `name_city:${name}|${city}`, strength: "possible", reason: "name_and_city" });
  }

  return keys;
}

export function buildDedupIndex(leads = []) {
  const index = new Map();
  for (const lead of leads) {
    for (const entry of buildDedupKeys(lead)) {
      if (!index.has(entry.key)) {
        index.set(entry.key, { leadId: lead.id, reason: entry.reason, strength: entry.strength });
      }
    }
  }
  return index;
}

export function resolveDuplicate(candidate = {}, index = new Map()) {
  const keys = buildDedupKeys(candidate);

  for (const entry of keys) {
    if (entry.strength !== "exact") continue;
    const hit = index.get(entry.key);
    if (hit) {
      return {
        action: "skip",
        reason: entry.reason,
        matchedLeadId: hit.leadId,
        key: entry.key,
      };
    }
  }

  for (const entry of keys) {
    if (entry.strength !== "possible") continue;
    const hit = index.get(entry.key);
    if (hit) {
      return {
        action: "add_possible_duplicate",
        reason: entry.reason,
        matchedLeadId: hit.leadId,
        key: entry.key,
      };
    }
  }

  return { action: "add", reason: null, matchedLeadId: null, key: null };
}

export function registerLeadInIndex(index, lead) {
  for (const entry of buildDedupKeys(lead)) {
    if (!index.has(entry.key)) {
      index.set(entry.key, { leadId: lead.id, reason: entry.reason, strength: entry.strength });
    }
  }
}

/** Legacy PW helper */
export function leadDedupKey(lead = {}) {
  const keys = buildDedupKeys(lead);
  const exact = keys.find((k) => k.strength === "exact");
  return exact?.key ?? keys[0]?.key ?? null;
}
