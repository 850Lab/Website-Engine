import { readFile } from "node:fs/promises";

const ROOT = new URL("../../../", import.meta.url);

async function loadCollection(path, key) {
  const file = new URL(path, ROOT);
  const raw = JSON.parse(await readFile(file, "utf8"));

  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw[key])) return raw[key];

  throw new Error(`Unsupported JSON structure in ${path}`);
}

function includesAny(value, terms) {
  const text = String(value || "").toLowerCase();
  return terms.some((term) => text.includes(String(term).toLowerCase()));
}

export async function analyzeMarketFromDatabase(market) {
  const businesses = await loadCollection("data/businesses.json", "businesses");
  const contacts = await loadCollection("data/contacts.json", "contacts");

  const matchedBusinesses = businesses.filter((business) => {
    const haystack = [
      business.name,
      business.industry,
      business.region,
      business.city,
      business.address,
      ...(business.tags || []),
    ].join(" ");

    return includesAny(haystack, market.keywords || []);
  });

  const businessIds = new Set(matchedBusinesses.map((business) => business.id));

  const matchedContacts = contacts.filter((contact) =>
    businessIds.has(contact.businessId)
  );

  const phoneContacts = matchedContacts.filter((contact) => contact.type === "phone");
  const emailContacts = matchedContacts.filter((contact) => contact.type === "email");

  const reachableByPhone = new Set(phoneContacts.map((contact) => contact.businessId)).size;
  const reachableByEmail = new Set(emailContacts.map((contact) => contact.businessId)).size;

  const contactCoverage =
    matchedBusinesses.length > 0
      ? Math.round(((reachableByPhone + reachableByEmail) / matchedBusinesses.length) * 50)
      : 0;

  return {
    marketId: market.id,
    marketName: market.name,
    businessesFound: matchedBusinesses.length,
    contactsFound: matchedContacts.length,
    reachableByPhone,
    reachableByEmail,
    contactCoverage,
    databaseConfidence:
      matchedBusinesses.length >= 25 ? "High" :
      matchedBusinesses.length >= 10 ? "Medium" :
      matchedBusinesses.length > 0 ? "Low" :
      "None",
    topBusinesses: matchedBusinesses.slice(0, 10).map((business) => ({
      id: business.id,
      name: business.name,
      industry: business.industry,
      city: business.city,
      hasPhone: Boolean(business.signals?.hasPhone),
      hasEmail: Boolean(business.signals?.hasEmail),
    })),
  };
}
