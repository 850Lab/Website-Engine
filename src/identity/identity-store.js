import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DATA_DIR, writeJsonFileSafe } from "../storage.js";
import { cleanText, nowIso } from "../stage1/shared.js";

export const IDENTITIES_FILE = join(DATA_DIR, "business-identities.json");
export const SOURCES_FILE = join(DATA_DIR, "business-sources.json");

async function readCollection(filePath, key) {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.[key])) return parsed[key];
    return [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeCollection(filePath, key, rows) {
  await writeJsonFileSafe(filePath, { version: 1, [key]: rows });
}

export function newBusinessIdentityId() {
  return `bid_${randomUUID().slice(0, 8)}`;
}

export function newBusinessSourceId() {
  return `src_${randomUUID().slice(0, 8)}`;
}

export async function listBusinessIdentities() {
  return readCollection(IDENTITIES_FILE, "identities");
}

export async function listBusinessSources() {
  const sources = await readCollection(SOURCES_FILE, "sources");
  return sources.sort((a, b) => String(b.discoveredAt).localeCompare(String(a.discoveredAt)));
}

export async function getBusinessIdentity(identityId) {
  const identities = await listBusinessIdentities();
  return identities.find((row) => row.id === identityId) ?? null;
}

export async function getSourcesForIdentity(identityId) {
  const sources = await listBusinessSources();
  return sources.filter((row) => row.businessIdentityId === identityId);
}

export async function findSourceByAdapterUrl(adapterId, sourceUrl) {
  const sources = await listBusinessSources();
  const needle = cleanText(sourceUrl).toLowerCase();
  return (
    sources.find(
      (row) => row.adapterId === adapterId && cleanText(row.sourceUrl).toLowerCase() === needle,
    ) ?? null
  );
}

export async function saveBusinessIdentity(identity) {
  const identities = await listBusinessIdentities();
  const index = identities.findIndex((row) => row.id === identity.id);
  const next = { ...identity, updatedAt: nowIso() };
  if (index === -1) {
    identities.push(next);
  } else {
    identities[index] = { ...identities[index], ...next };
  }
  await writeCollection(IDENTITIES_FILE, "identities", identities);
  return index === -1 ? next : identities[index];
}

export async function saveBusinessSource(source) {
  const sources = await listBusinessSources();
  const index = sources.findIndex((row) => row.id === source.id);
  const next = { ...source, updatedAt: nowIso() };
  if (index === -1) {
    sources.push(next);
  } else {
    sources[index] = { ...sources[index], ...next };
  }
  await writeCollection(SOURCES_FILE, "sources", sources);
  return index === -1 ? next : sources[index];
}

export function buildIdentityRecord(input) {
  return {
    id: input.id ?? newBusinessIdentityId(),
    businessName: cleanText(input.businessName),
    industry: cleanText(input.industry),
    category: cleanText(input.category),
    city: cleanText(input.city),
    state: cleanText(input.state).toUpperCase(),
    address: cleanText(input.address),
    website: cleanText(input.website),
    phone: cleanText(input.phone),
    normalizedPhone: cleanText(input.normalizedPhone),
    email: cleanText(input.email),
    facebookUrl: cleanText(input.facebookUrl),
    instagramUrl: cleanText(input.instagramUrl),
    linkedinUrl: cleanText(input.linkedinUrl),
    googleMapsUrl: cleanText(input.googleMapsUrl),
    opportunityRecordId: input.opportunityRecordId ?? null,
    sourceCount: Number(input.sourceCount) || 0,
    createdAt: input.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
}

export async function attachSourceToIdentity({
  businessIdentityId,
  opportunityRecordId,
  adapterId,
  sourceUrl,
  discoveredAt,
  snapshot = {},
}) {
  const existing = await findSourceByAdapterUrl(adapterId, sourceUrl);
  if (existing) return existing;

  const source = await saveBusinessSource({
    id: newBusinessSourceId(),
    businessIdentityId,
    opportunityRecordId,
    adapterId,
    sourceUrl,
    discoveredAt: discoveredAt ?? nowIso(),
    snapshot,
  });

  const identity = await getBusinessIdentity(businessIdentityId);
  if (identity) {
    const sources = await getSourcesForIdentity(businessIdentityId);
    await saveBusinessIdentity({
      ...identity,
      sourceCount: sources.length,
      opportunityRecordId: opportunityRecordId ?? identity.opportunityRecordId,
    });
  }

  return source;
}
