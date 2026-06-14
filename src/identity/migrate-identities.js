import { listQualifiedBusinesses, upsertQualifiedBusiness } from "../stage1/qualified-business-store.js";
import { buildDedupKey, normalizePhoneNumber, nowIso } from "../stage1/shared.js";
import { identitySignalsFromDiscovery } from "../discovery-adapters/schema.js";
import {
  attachSourceToIdentity,
  buildIdentityRecord,
  getBusinessIdentity,
  listBusinessIdentities,
  listBusinessSources,
  saveBusinessIdentity,
} from "./identity-store.js";
import { resolveBusinessIdentity } from "./identity-resolution.js";

export async function migrateRecordsToIdentities() {
  const records = await listQualifiedBusinesses();
  const existingIdentities = await listBusinessIdentities();
  if (existingIdentities.length >= records.length * 0.9 && records.every((r) => r.businessIdentityId)) {
    return { migrated: 0, skipped: records.length, alreadyComplete: true };
  }

  let migrated = 0;
  let skipped = 0;

  for (const record of records) {
    if (record.businessIdentityId) {
      const identity = await getBusinessIdentity(record.businessIdentityId);
      if (identity) {
        skipped += 1;
        continue;
      }
    }

    const discovery = {
      businessName: record.businessName,
      category: record.category,
      industry: record.industry,
      phone: record.phone,
      email: record.email,
      website: record.websiteUrl,
      address: record.address,
      city: record.city,
      state: record.state,
      source: record.source ?? "google_maps",
      sourceUrl: record.googleMapsUrl ?? "",
      googleMapsUrl: record.googleMapsUrl ?? "",
      facebookUrl: (record.socialUrls ?? []).find((u) => /facebook/i.test(u)) ?? "",
      instagramUrl: (record.socialUrls ?? []).find((u) => /instagram/i.test(u)) ?? "",
      linkedinUrl: (record.socialUrls ?? []).find((u) => /linkedin/i.test(u)) ?? "",
    };

    const signals = identitySignalsFromDiscovery(discovery);
    const { identity } = await resolveBusinessIdentity(
      { ...signals, industry: record.industry, category: record.category },
      { opportunityRecordId: record.id },
    );

    await saveBusinessIdentity({
      ...identity,
      opportunityRecordId: record.id,
      website: identity.website || record.websiteUrl,
      email: identity.email || record.email,
      googleMapsUrl: identity.googleMapsUrl || record.googleMapsUrl,
    });

    await attachSourceToIdentity({
      businessIdentityId: identity.id,
      opportunityRecordId: record.id,
      adapterId: record.source ?? "google_maps",
      sourceUrl: record.googleMapsUrl || record.dedupKey || buildDedupKey(record),
      discoveredAt: record.dateFound ?? nowIso(),
      snapshot: { businessName: record.businessName, city: record.city },
    });

    await upsertQualifiedBusiness({
      ...record,
      businessIdentityId: identity.id,
      normalizedPhone: record.normalizedPhone || normalizePhoneNumber(record.phone),
    });

    migrated += 1;
  }

  return { migrated, skipped, alreadyComplete: false };
}

export async function getIdentityMigrationStatus() {
  const records = await listQualifiedBusinesses();
  const identities = await listBusinessIdentities();
  const sources = await listBusinessSources();
  const withIdentity = records.filter((r) => r.businessIdentityId).length;

  return {
    opportunityRecords: records.length,
    identities: identities.length,
    sources: sources.length,
    recordsWithIdentity: withIdentity,
    migrationComplete: withIdentity === records.length && identities.length > 0,
  };
}
