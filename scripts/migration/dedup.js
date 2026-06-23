import { normalizeBusinessName, normalizePhoneNumber } from "../../src/stage1/shared.js";

export function pwDedupKey(lead = {}) {
  const phone = normalizePhoneNumber(lead.normalizedPhone || lead.phone);
  if (phone.length >= 12) return `phone:${phone}`;
  const name = normalizeBusinessName(lead.businessName);
  const city = normalizeBusinessName(lead.city);
  return `pw:name:${name}|${city}`;
}

export function phonesMatch(a, b) {
  const pa = normalizePhoneNumber(a);
  const pb = normalizePhoneNumber(b);
  return pa.length >= 12 && pa === pb;
}

export function mergePwIntoBusiness(business, lead, pwLegacyId) {
  const tags = new Set(business.tags ?? []);
  for (const [key, value] of Object.entries(lead.flags ?? {})) {
    if (value) tags.add(key);
  }

  return {
    ...business,
    tags: [...tags],
    legacyId: business.legacyId || pwLegacyId,
    source: {
      ...(business.source ?? {}),
      legacyIds: {
        ...(business.source?.legacyIds ?? {}),
        pw: pwLegacyId,
        qualified: business.source?.legacyIds?.qualified ?? business.legacyId,
      },
      pw: {
        source: lead.source,
        sourceQuery: lead.sourceQuery,
        discoveredAt: lead.discoveredAt,
      },
    },
    updatedAt: lead.updatedAt || business.updatedAt,
  };
}

export function registerIdMapEntry(idMap, legacyId, entry) {
  if (!legacyId) return;
  idMap[legacyId] = {
    ...(idMap[legacyId] ?? {}),
    ...entry,
    businessId: entry.businessId ?? idMap[legacyId]?.businessId,
    opportunities: idMap[legacyId]?.opportunities ?? {},
  };
}

export function setOpportunityOnIdMap(idMap, legacyId, campaignId, opportunityId) {
  if (!idMap[legacyId]) idMap[legacyId] = { businessId: null, opportunities: {} };
  idMap[legacyId].opportunities = {
    ...(idMap[legacyId].opportunities ?? {}),
    [campaignId]: opportunityId,
  };
}
