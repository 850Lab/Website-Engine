import { getBuyerAffinity, OFFER_FIT_WEIGHTS } from "./constants.js";

const URGENCY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function scoreCapabilityCoverage(matchContext, overlappingCapabilities) {
  const recommended = matchContext.recommendedCapabilities;
  if (!recommended.length) return 0.4;

  let numerator = 0;
  let denominator = 0;
  for (const row of recommended) {
    denominator += row.fitScore || 0.1;
    if (overlappingCapabilities.includes(row.capabilityId)) {
      numerator += row.fitScore || 0.1;
    }
  }

  return denominator ? clamp(numerator / denominator, 0.2, 1) : 0.3;
}

function scoreCompositionCoverage(matchContext, offer) {
  const required = matchContext.requiredCapabilityIds;
  if (!required.length) return 0.85;

  const covered = required.filter((id) => offer.capabilityIds.includes(id)).length;
  return clamp(covered / required.length, 0, 1);
}

function scoreBuyerPersonaAlignment(matchContext, offer) {
  const affinity = getBuyerAffinity(matchContext.problemCategory);
  const buyers = offer.bestBuyers.map((row) => String(row).toLowerCase());
  const hits = affinity.filter((buyer) =>
    buyers.some((row) => row.includes(String(buyer).toLowerCase()) || String(buyer).toLowerCase().includes(row)),
  );
  return clamp(hits.length / Math.max(affinity.length, 1), 0.25, 1);
}

function scoreUrgencyAlignment(matchContext, offer) {
  const problemUrgency = matchContext.recommendedCapabilities.some((row) =>
    row.constraintResults?.some((check) => check.type === "timing" && check.status === "pass"),
  )
    ? "high"
    : "medium";
  const offerText = `${offer.urgency} ${offer.promise}`.toLowerCase();
  const urgentKeywords = ["delay", "downtime", "immediate", "urgent", "every day", "thousands per day"];
  const hasUrgentLanguage = urgentKeywords.some((word) => offerText.includes(word));
  const problemRank = URGENCY_RANK[problemUrgency] || 2;

  if (problemRank >= 3 && hasUrgentLanguage) return 1;
  if (problemRank >= 3 && !hasUrgentLanguage) return 0.65;
  return hasUrgentLanguage ? 0.8 : 0.7;
}

function scoreCommercialBandFit(offer) {
  const capabilities = offer.capabilities || [];
  if (!capabilities.length) return 0.6;

  const lows = capabilities.map((row) => row.marginProfile?.typicalContractLow || 0).filter(Boolean);
  const highs = capabilities.map((row) => row.marginProfile?.typicalContractHigh || 0).filter(Boolean);
  if (!lows.length || !highs.length) return 0.65;

  const avgLow = lows.reduce((sum, value) => sum + value, 0) / lows.length;
  const avgHigh = highs.reduce((sum, value) => sum + value, 0) / highs.length;
  const industrial = avgHigh >= 50000;
  return industrial ? 0.85 : 0.7;
}

function scoreBundleCoherence(matchContext, offer, compositionCoverage) {
  if (!matchContext.requiredCapabilityIds.length) {
    return offer.capabilityIds.length > 1 ? 0.75 : 0.65;
  }
  if (compositionCoverage >= 1 && offer.capabilityIds.length >= matchContext.requiredCapabilityIds.length) {
    return 1;
  }
  return compositionCoverage;
}

export function analyzeOfferFit(matchContext, candidate, offerWithCapabilities) {
  const offer = offerWithCapabilities;
  const overlappingCapabilities = candidate.overlappingCapabilities;

  const dimensions = {
    capabilityCoverage: scoreCapabilityCoverage(matchContext, overlappingCapabilities),
    compositionCoverage: scoreCompositionCoverage(matchContext, offer),
    buyerPersonaAlignment: scoreBuyerPersonaAlignment(matchContext, offer),
    urgencyAlignment: scoreUrgencyAlignment(matchContext, offer),
    commercialBandFit: scoreCommercialBandFit(offer),
    bundleCoherence: scoreBundleCoherence(
      matchContext,
      offer,
      scoreCompositionCoverage(matchContext, offer),
    ),
  };

  let weighted = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(OFFER_FIT_WEIGHTS)) {
    weighted += (dimensions[key] ?? 0) * weight;
    weightTotal += weight;
  }

  const offerFitScore = weightTotal ? Number((weighted / weightTotal).toFixed(4)) : 0;

  const selectionReasons = [
    ...candidate.selectionReasons,
    ...Object.entries(dimensions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${value}`),
  ];

  return {
    offerFitScore,
    dimensionBreakdown: Object.fromEntries(
      Object.entries(dimensions).map(([key, value]) => [key, Number(value.toFixed(4))]),
    ),
    weights: OFFER_FIT_WEIGHTS,
    selectionReasons,
    packagedCapabilities: overlappingCapabilities,
  };
}

export function compareOfferCandidates(a, b) {
  if (b.offerFitScore !== a.offerFitScore) return b.offerFitScore - a.offerFitScore;
  if (b.packagedCapabilities.length !== a.packagedCapabilities.length) {
    return b.packagedCapabilities.length - a.packagedCapabilities.length;
  }
  return String(a.offer.id).localeCompare(String(b.offer.id));
}

export function buildOfferDifferentiation(selected = []) {
  if (selected.length < 2) return [];
  const records = [];
  for (let i = 0; i < selected.length; i += 1) {
    for (let j = i + 1; j < selected.length; j += 1) {
      const a = selected[i];
      const b = selected[j];
      const stronger = a.offerFitScore >= b.offerFitScore ? a : b;
      const weaker = stronger === a ? b : a;
      records.push({
        offerA: stronger.offer.id,
        offerB: weaker.offer.id,
        whyStronger: `${stronger.offer.name} ranks higher on offer fit (${stronger.offerFitScore} vs ${weaker.offerFitScore})`,
        evidence: stronger.selectionReasons,
        whenPreferOther: `${weaker.offer.name} may be preferable for narrower capability scope`,
      });
    }
  }
  return records;
}
