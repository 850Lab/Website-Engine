import { cleanText } from "../../src/stage1/shared.js";

export function findLegacyEntries(businessId, idMap, legacyMeta) {
  let qb = null;
  let pw = null;
  for (const [legacyId, entry] of Object.entries(idMap)) {
    if (entry.businessId !== businessId) continue;
    if (legacyMeta.qualified[legacyId]) qb = { legacyId, record: legacyMeta.qualified[legacyId] };
    if (legacyMeta.pw[legacyId]) pw = { legacyId, record: legacyMeta.pw[legacyId] };
  }
  return { qb, pw };
}

export function legacyRecordForCampaign({ qb, pw, campaign, offerById }) {
  const offer = offerById[campaign.offerId];
  const offerSlug = cleanText(offer?.slug).toLowerCase();

  if (pw && offerSlug === "pressure-washing") return { source: "pressure-washing", ...pw };
  if (qb && offerSlug === "website") return { source: "qualified-businesses", ...qb };
  if (pw && !qb) return { source: "pressure-washing", ...pw };
  if (qb) return { source: "qualified-businesses", ...qb };
  return null;
}
