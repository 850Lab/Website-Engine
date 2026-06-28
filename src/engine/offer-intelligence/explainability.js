import { createHash } from "node:crypto";
import { getOfferRegistryVersion } from "../offers/index.js";
import { buildOfferDifferentiation } from "./fit-score.js";

export const OFFER_INTELLIGENCE_VERSION = "offer_intelligence_v0";

export function buildOfferInputHash(capabilityMatch, offers) {
  const payload = JSON.stringify({
    capabilityMatchId: capabilityMatch.id,
    capabilityInputHash: capabilityMatch.inputHash,
    offerRegistryVersion: getOfferRegistryVersion(),
    offerIds: offers.map((row) => row.id).sort(),
    recommendedCapabilityIds: (capabilityMatch.recommendedCapabilities || [])
      .map((row) => row.capabilityId)
      .sort(),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function buildOfferExplainability({
  capabilityMatch,
  matchContext,
  selected,
  rejected,
  inputHash,
}) {
  return {
    capabilityMatchId: capabilityMatch.id,
    problemId: matchContext.problemId,
    problemCategory: matchContext.problemCategory,
    capabilityMatcherVersion: matchContext.matcherVersion,
    capabilityInputHash: matchContext.capabilityInputHash,
    offerIntelligenceVersion: OFFER_INTELLIGENCE_VERSION,
    inputHash,
    selected: selected.map((row, index) => ({
      offerId: row.offer.id,
      offerName: row.offer.name,
      rank: index + 1,
      offerFitScore: row.offerFitScore,
      dimensionBreakdown: row.dimensionBreakdown,
      selectionReasons: row.selectionReasons,
      packagedCapabilities: row.packagedCapabilities,
      eligibilityChecks: row.eligibilityChecks,
    })),
    rejected: rejected.map((row) => ({
      offerId: row.offerId,
      offerFitScore: row.offerFitScore ?? null,
      rejectionReason: row.rejectionReason,
      failedChecks: row.failedChecks || [],
      eligibilityChecks: row.eligibilityChecks || null,
    })),
    differentiation: buildOfferDifferentiation(selected),
    generatedAt: new Date().toISOString(),
  };
}
