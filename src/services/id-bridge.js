import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanText } from "../stage1/shared.js";
import { getBusiness, getBusinessByLegacyId } from "./businesses.js";
import { getOpportunity } from "./opportunities.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ID_MAP_FILE = join(ROOT, "data", "migration", "id-map.json");

/** Null = not loaded yet; object (possibly empty) = loaded or intentionally absent. */
let cachedEntries = null;

export function clearIdMapCache() {
  cachedEntries = null;
}

export async function loadIdMapEntries() {
  if (cachedEntries !== null) return cachedEntries;

  try {
    const raw = await readFile(ID_MAP_FILE, "utf8");
    const parsed = JSON.parse(raw);
    cachedEntries = parsed.entries ?? parsed;
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`[id-bridge] id-map unavailable (${err.code}): ${err.message}`);
    }
    cachedEntries = {};
  }

  return cachedEntries;
}

export function isLegacyBusinessId(id) {
  const value = cleanText(id);
  return value.startsWith("qbd_") || value.startsWith("pwl_");
}

export function isSchemaBusinessId(id) {
  const value = cleanText(id);
  return value.startsWith("biz_");
}

export async function resolveLegacyToBusinessId(legacyId) {
  const needle = cleanText(legacyId);
  if (!needle) return null;
  if (isSchemaBusinessId(needle)) return needle;

  const business = await getBusinessByLegacyId(needle);
  if (business?.id) return business.id;

  const map = await loadIdMapEntries();
  return map[needle]?.businessId ?? null;
}

export async function resolveLegacyToOpportunityId(legacyId, campaignId) {
  const legacy = cleanText(legacyId);
  const campaign = cleanText(campaignId);
  if (!legacy || !campaign) return null;

  const businessId = await resolveLegacyToBusinessId(legacy);
  if (!businessId) return null;

  const { listOpportunitiesForBusiness } = await import("./opportunities.js");
  const opportunities = await listOpportunitiesForBusiness(businessId);
  const match = opportunities.find((row) => row.campaignId === campaign);
  if (match?.id) return match.id;

  const map = await loadIdMapEntries();
  return map[legacy]?.opportunities?.[campaign] ?? null;
}

export async function resolveBusinessToLegacyIds(businessId) {
  const needle = cleanText(businessId);
  if (!needle) return [];

  const business = await getBusiness(needle);
  if (business?.legacyId) return [business.legacyId];

  const map = await loadIdMapEntries();
  const legacyIds = [];
  for (const [legacyId, entry] of Object.entries(map)) {
    if (entry?.businessId === needle) legacyIds.push(legacyId);
  }

  return [...new Set(legacyIds)];
}

export async function resolvePrimaryLegacyId(businessId) {
  const business = await getBusiness(businessId);
  if (business?.legacyId) return business.legacyId;
  const legacyIds = await resolveBusinessToLegacyIds(businessId);
  return legacyIds[0] ?? null;
}

async function opportunityIdsForLegacyLead(legacyId, businessId) {
  const { listOpportunitiesForBusiness } = await import("./opportunities.js");
  const opportunities = await listOpportunitiesForBusiness(businessId);
  const opportunityIds = Object.fromEntries(
    opportunities.map((row) => [row.campaignId, row.id]),
  );

  const map = await loadIdMapEntries();
  const mapped = map[cleanText(legacyId)]?.opportunities;
  if (mapped && typeof mapped === "object") {
    for (const [campaignId, opportunityId] of Object.entries(mapped)) {
      if (!opportunityIds[campaignId]) opportunityIds[campaignId] = opportunityId;
    }
  }

  return opportunityIds;
}

export async function resolveLegacyLeadId(legacyId) {
  const businessId = await resolveLegacyToBusinessId(legacyId);
  if (!businessId) {
    return {
      legacyId: cleanText(legacyId),
      businessId: null,
      opportunityIds: {},
    };
  }

  return {
    legacyId: cleanText(legacyId),
    businessId,
    opportunityIds: await opportunityIdsForLegacyLead(legacyId, businessId),
  };
}

export async function resolveSchemaLeadContext({ businessId, campaignId }) {
  const legacyId = await resolvePrimaryLegacyId(businessId);
  let opportunityId = null;
  if (campaignId) {
    const { listOpportunitiesForBusiness } = await import("./opportunities.js");
    const opportunities = await listOpportunitiesForBusiness(businessId);
    opportunityId = opportunities.find((row) => row.campaignId === campaignId)?.id ?? null;
  }
  return {
    businessId: cleanText(businessId),
    legacyId,
    campaignId: cleanText(campaignId) || null,
    opportunityId,
  };
}

export async function resolveLegacyToSchemaContext(legacyId, campaignId = null) {
  const resolved = await resolveLegacyLeadId(legacyId);
  const opportunityId = campaignId
    ? resolved.opportunityIds[campaignId] ?? (await resolveLegacyToOpportunityId(legacyId, campaignId))
    : null;
  return {
    ...resolved,
    campaignId: cleanText(campaignId) || null,
    opportunityId,
    opportunity: opportunityId ? await getOpportunity(opportunityId) : null,
    business: resolved.businessId ? await getBusiness(resolved.businessId) : null,
  };
}
