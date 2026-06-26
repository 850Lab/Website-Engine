import { readFile } from "node:fs/promises";

const ROOT = new URL("../../../", import.meta.url);

async function loadBusinesses() {
  const file = new URL("data/businesses.json", ROOT);
  const raw = JSON.parse(await readFile(file, "utf8"));
  return Array.isArray(raw) ? raw : raw.businesses || [];
}

function normalize(value) {
  return String(value || "").toLowerCase();
}

function includesAny(value, terms) {
  const text = normalize(value);
  return terms.some((term) => text.includes(normalize(term)));
}

function targetTerms(mission) {
  const target = mission.target || {};
  return [
    target.industry,
    target.buyer,
    ...(target.keywords || []),
  ].filter(Boolean);
}

function regionTerms(mission) {
  const target = mission.target || {};
  return [
    target.region,
    "Beaumont",
    "Port Arthur",
    "Nederland",
    "Port Neches",
    "Groves",
    "Orange",
    "Silsbee",
  ].filter(Boolean);
}

function scoreBusiness(business, mission) {
  let score = 0;

  const buyerTerms = targetTerms(mission);
  const geoTerms = regionTerms(mission);

  const buyerMatch =
    includesAny(business.industry, buyerTerms) ||
    includesAny(business.name, buyerTerms) ||
    includesAny(business.tags?.join(" "), buyerTerms);

  const regionMatch =
    includesAny(business.region, geoTerms) ||
    includesAny(business.city, geoTerms) ||
    includesAny(business.address, geoTerms);

  if (!buyerMatch) return 0;

  if (includesAny(business.industry, buyerTerms)) score += 50;
  if (includesAny(business.name, buyerTerms)) score += 25;
  if (includesAny(business.tags?.join(" "), buyerTerms)) score += 15;
  if (regionMatch) score += 15;
  if (business.signals?.hasPhone) score += 10;
  if (business.signals?.hasEmail) score += 5;
  if ((business.signals?.reviewCount || 0) > 20) score += 5;

  return score;
}

export async function discoverMissionBuyers(mission) {
  const businesses = await loadBusinesses();

  return businesses
    .map((business) => ({
      id: business.id,
      legacyId: business.legacyId,
      name: business.name,
      industry: business.industry,
      region: business.region,
      city: business.city,
      state: business.state,
      address: business.address,
      website: business.website,
      phoneAvailable: Boolean(business.signals?.hasPhone),
      emailAvailable: Boolean(business.signals?.hasEmail),
      score: scoreBusiness(business, mission),
      signals: business.signals || {},
    }))
    .filter((buyer) => buyer.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);
}
