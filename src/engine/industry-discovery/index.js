import { readFile } from "node:fs/promises";

const ROOT = new URL("../../../", import.meta.url);

async function loadCollection(path, key) {
  const file = new URL(path, ROOT);
  const raw = JSON.parse(await readFile(file, "utf8"));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw[key])) return raw[key];
  throw new Error(`Unsupported JSON structure in ${path}`);
}

function normalizeIndustry(value) {
  const text = String(value || "").trim();
  return text || "Unknown";
}

function confidenceFromCount(count) {
  if (count >= 25) return "High";
  if (count >= 10) return "Medium";
  if (count > 0) return "Low";
  return "None";
}

export async function discoverIndustries() {
  const businesses = await loadCollection("data/businesses.json", "businesses");
  const contacts = await loadCollection("data/contacts.json", "contacts");

  const contactsByBusiness = contacts.reduce((acc, contact) => {
    if (!acc[contact.businessId]) acc[contact.businessId] = [];
    acc[contact.businessId].push(contact);
    return acc;
  }, {});

  const profiles = new Map();

  for (const business of businesses) {
    const industry = normalizeIndustry(business.industry);
    if (!profiles.has(industry)) {
      profiles.set(industry, {
        industry,
        businessIds: new Set(),
        contactsFound: 0,
        reachableByPhone: new Set(),
        reachableByEmail: new Set(),
      });
    }

    const profile = profiles.get(industry);
    profile.businessIds.add(business.id);

    const businessContacts = contactsByBusiness[business.id] || [];
    profile.contactsFound += businessContacts.length;

    for (const contact of businessContacts) {
      if (contact.type === "phone") profile.reachableByPhone.add(business.id);
      if (contact.type === "email") profile.reachableByEmail.add(business.id);
    }
  }

  const results = [...profiles.values()].map((profile) => {
    const businessesFound = profile.businessIds.size;
    const reachableByPhone = profile.reachableByPhone.size;
    const reachableByEmail = profile.reachableByEmail.size;
    const reachableBusinesses = new Set([
      ...profile.reachableByPhone,
      ...profile.reachableByEmail,
    ]).size;
    const contactCoverage =
      businessesFound > 0
        ? Math.min(100, Math.round(((reachableByPhone + reachableByEmail) / businessesFound) * 50))
        : 0;

    return {
      industry: profile.industry,
      businessesFound,
      contactsFound: profile.contactsFound,
      reachableByPhone,
      reachableByEmail,
      reachableBusinesses,
      contactCoverage,
      databaseConfidence: confidenceFromCount(businessesFound),
    };
  });

  return results.sort(
    (a, b) =>
      b.businessesFound - a.businessesFound ||
      b.reachableBusinesses - a.reachableBusinesses ||
      a.industry.localeCompare(b.industry),
  );
}
