const PROMOTION_THRESHOLD = 0.6;
const CONTESTED_THRESHOLD = 0.55;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number(value.toFixed(3));
}

function averageConfidence(items) {
  if (!items.length) return 0;
  const total = items.reduce((sum, item) => sum + (item.confidence ?? 0), 0);
  return total / items.length;
}

export function calculateHypothesisConfidence(hypothesis, evidenceBundle, options = {}) {
  const situation = evidenceBundle.situation;
  const contradictions = asArray(options.contradictions);

  const situationConfidence = situation?.confidence ?? 0;
  const factConfidence = averageConfidence(evidenceBundle.facts);
  const relationshipConfidence = averageConfidence(evidenceBundle.relationships);
  const evidenceWeight = evidenceBundle.evidenceWeight ?? 0;

  const contradictionPenalty = contradictions.reduce(
    (sum, row) => sum + (row.confidencePenalty ?? 0.1),
    0,
  );

  const missingPenalty = Math.min(
    0.15,
    asArray(evidenceBundle.missingEvidence).filter((row) => row.priority === "critical").length *
      0.05,
  );

  const polarity = hypothesis.metadata?.polarity || "positive";
  const polarityAdjustment = polarity === "negative" ? -0.05 : 0;

  const weighted =
    situationConfidence * 0.3 +
    factConfidence * 0.25 +
    relationshipConfidence * 0.15 +
    evidenceWeight * 0.3 -
    contradictionPenalty -
    missingPenalty +
    polarityAdjustment;

  const confidence = round(clamp(weighted));

  const confidenceBreakdown = {
    situationConfidence: round(situationConfidence),
    factConfidence: round(factConfidence),
    relationshipConfidence: round(relationshipConfidence),
    evidenceWeight: round(evidenceWeight),
    contradictionPenalty: round(contradictionPenalty),
    missingPenalty: round(missingPenalty),
    polarityAdjustment: round(polarityAdjustment),
    final: confidence,
    promotionThreshold: PROMOTION_THRESHOLD,
    eligibleForPromotion: confidence >= PROMOTION_THRESHOLD && contradictionPenalty === 0,
  };

  const reasoning = [
    `Situation confidence ${confidenceBreakdown.situationConfidence} contributes 30%.`,
    `Average fact confidence ${confidenceBreakdown.factConfidence} contributes 25%.`,
    `Average relationship confidence ${confidenceBreakdown.relationshipConfidence} contributes 15%.`,
    `Evidence tier weight ${confidenceBreakdown.evidenceWeight} contributes 30%.`,
    contradictionPenalty
      ? `Contradiction penalty ${confidenceBreakdown.contradictionPenalty} applied.`
      : "No contradiction penalty applied.",
    missingPenalty
      ? `Missing evidence penalty ${confidenceBreakdown.missingPenalty} applied.`
      : "No critical missing evidence penalty applied.",
  ];

  return {
    confidence,
    confidenceBreakdown,
    reasoning,
    promotionThreshold: PROMOTION_THRESHOLD,
    contestedThreshold: CONTESTED_THRESHOLD,
    eligibleForPromotion: confidenceBreakdown.eligibleForPromotion,
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export { PROMOTION_THRESHOLD, CONTESTED_THRESHOLD };
