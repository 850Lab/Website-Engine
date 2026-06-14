import { identitySignalsFromDiscovery } from "../discovery-adapters/schema.js";
import { recordAdapterRun } from "../discovery-adapters/registry.js";
import { attachSourceToIdentity, saveBusinessIdentity } from "../identity/identity-store.js";
import { mergeIdentityFields, resolveBusinessIdentity } from "../identity/identity-resolution.js";
import { classifyContactMethod } from "../stage1/contact-method.js";
import { evaluateQualification } from "../stage1/qualification.js";
import {
  buildBusinessRecord,
  findByDedupKey,
  saveWebsiteQualityScore,
  upsertQualifiedBusiness,
} from "../stage1/qualified-business-store.js";
import {
  buildDedupKey,
  extractEmailsFromHtml,
  newBusinessId,
  normalizePhoneNumber,
  nowIso,
} from "../stage1/shared.js";
import { hasContactForm, scoreWebsiteQuality } from "../stage1/website-quality-score.js";
import { enrichQualifiedOpportunity } from "../enrichment/contact-enrichment.js";

/**
 * Source-agnostic ingest: adapter output → identity → qualification → enrichment → database
 */
export async function ingestDiscoveryRecord(discovery, context = {}) {
  const { runId, adapterId } = context;
  const phone = cleanText(discovery.phone);
  const normalizedPhone = normalizePhoneNumber(phone);
  const websiteUrl = cleanText(discovery.website);

  const quality = await scoreWebsiteQuality({
    websiteUrl,
    businessName: discovery.businessName,
    phone,
  });

  const email = cleanText(discovery.email) || (quality.html ? extractEmailsFromHtml(quality.html)[0] ?? "" : "");
  const socialUrls = [
    ...new Set(
      [
        ...(quality.socialUrls ?? []),
        discovery.facebookUrl,
        discovery.instagramUrl,
        discovery.linkedinUrl,
      ].filter(Boolean),
    ),
  ];

  const contactMethodCategory = classifyContactMethod({
    phone,
    normalizedPhone,
    email,
    html: quality.html,
    socialUrls,
    websiteUrl,
    hasContactForm: quality.html ? hasContactForm(quality.html) : false,
  });

  const qualification = evaluateQualification({
    source: adapterId ?? discovery.source,
    websiteStatus: quality.websiteStatus,
    websiteScore: quality.websiteScore,
    phone,
    normalizedPhone,
    email,
    html: quality.html,
  });

  const dedupKey = buildDedupKey({
    businessName: discovery.businessName,
    city: discovery.city,
    phone,
    googleMapsUrl: discovery.googleMapsUrl || discovery.sourceUrl,
  });

  const signals = identitySignalsFromDiscovery({
    ...discovery,
    email,
    website: websiteUrl,
    phone,
  });

  const existingRecord = await findByDedupKey(dedupKey);
  if (existingRecord) {
    const { identity } = await resolveBusinessIdentity(signals, {
      opportunityRecordId: existingRecord.id,
    });
    await mergeIdentityFields(identity, signals);
    await attachSourceToIdentity({
      businessIdentityId: identity.id,
      opportunityRecordId: existingRecord.id,
      adapterId: adapterId ?? discovery.source,
      sourceUrl: discovery.sourceUrl,
      discoveredAt: discovery.discoveredAt,
      snapshot: { businessName: discovery.businessName },
    });
    return {
      action: "duplicate",
      record: existingRecord,
      identity,
      qualification,
    };
  }

  const { identity, matched, matchReason } = await resolveBusinessIdentity(signals);

  if (matched) {
    await mergeIdentityFields(identity, signals);
    await attachSourceToIdentity({
      businessIdentityId: identity.id,
      opportunityRecordId: identity.opportunityRecordId,
      adapterId: adapterId ?? discovery.source,
      sourceUrl: discovery.sourceUrl,
      discoveredAt: discovery.discoveredAt,
      snapshot: { businessName: discovery.businessName },
    });
    return {
      action: "identity_duplicate",
      identity,
      matchReason,
      qualification,
    };
  }

  const record = buildBusinessRecord({
    id: newBusinessId(),
    businessName: discovery.businessName,
    industry: discovery.industry,
    category: discovery.category,
    city: discovery.city,
    state: discovery.state,
    address: discovery.address,
    googleMapsUrl: discovery.googleMapsUrl || discovery.sourceUrl,
    googleRating: discovery.rating,
    googleReviewCount: discovery.reviewCount,
    websiteUrl,
    websiteStatus: quality.websiteStatus,
    websiteScore: quality.websiteScore,
    websiteScoreReasons: quality.websiteScoreReasons,
    websiteScoreConfidence: quality.websiteScoreConfidence,
    phone,
    normalizedPhone,
    email,
    socialUrls,
    facebookUrl: discovery.facebookUrl,
    instagramUrl: discovery.instagramUrl,
    linkedinUrl: discovery.linkedinUrl,
    contactMethodCategory,
    qualificationStatus: qualification.qualificationStatus,
    qualificationReason: qualification.qualificationReason,
    dateFound: discovery.discoveredAt ?? nowIso(),
    dateScored: nowIso(),
    source: adapterId ?? discovery.source,
    discoveryRunId: runId ?? null,
    dedupKey,
    businessIdentityId: identity.id,
  });

  await upsertQualifiedBusiness(record);
  await saveWebsiteQualityScore({
    businessId: record.id,
    businessName: record.businessName,
    websiteUrl: record.websiteUrl,
    websiteScore: record.websiteScore,
    websiteStatus: record.websiteStatus,
    reasons: record.websiteScoreReasons,
    confidence: record.websiteScoreConfidence,
    performanceScore: quality.performanceScore,
    signals: quality.signals,
    scoredAt: nowIso(),
  });

  await saveBusinessIdentity({
    ...identity,
    opportunityRecordId: record.id,
    website: websiteUrl,
    email,
    googleMapsUrl: discovery.googleMapsUrl || discovery.sourceUrl,
    facebookUrl: discovery.facebookUrl,
    instagramUrl: discovery.instagramUrl,
    linkedinUrl: discovery.linkedinUrl,
  });

  await attachSourceToIdentity({
    businessIdentityId: identity.id,
    opportunityRecordId: record.id,
    adapterId: adapterId ?? discovery.source,
    sourceUrl: discovery.sourceUrl,
    discoveredAt: discovery.discoveredAt,
    snapshot: { businessName: discovery.businessName },
  });

  let finalRecord = record;
  if (qualification.qualificationStatus === "qualified") {
    const enriched = await enrichQualifiedOpportunity(record);
    if (enriched.record) finalRecord = enriched.record;
  }

  return {
    action: "added",
    record: finalRecord,
    identity,
    qualification,
  };
}

function cleanText(value) {
  return String(value ?? "").trim();
}

export async function ingestAdapterResults(adapterId, discoveries, context = {}) {
  const stats = {
    businessesFound: discoveries.length,
    businessesAdded: 0,
    duplicatesResolved: 0,
    errors: 0,
  };

  const results = [];

  for (const discovery of discoveries) {
    try {
      const result = await ingestDiscoveryRecord(discovery, { ...context, adapterId });
      results.push(result);
      if (result.action === "added") {
        stats.businessesAdded += 1;
        if (result.qualification?.qualificationStatus === "qualified") {
          // counted in added
        }
      } else {
        stats.duplicatesResolved += 1;
      }
    } catch {
      stats.errors += 1;
    }
  }

  await recordAdapterRun(adapterId, stats);
  return { stats, results };
}
