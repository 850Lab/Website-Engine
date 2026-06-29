export const ABSTENTION_THRESHOLDS = {
  minProblemConfidence: 0.55,
  minCapabilityFit: 0.48,
  maxOfferCapabilityGap: 0.35,
  minStrongRecommendations: 1,
  strongFitScore: 0.5,
  sparseUnknownConfidence: 0.65,
  generalServicesConfidence: 0.7,
};

function buildAbstention(reason, evidence, recommendedNextInput) {
  return {
    status: "abstained",
    reason,
    evidence,
    recommendedNextInput,
  };
}

export function evaluateCommercialActionability({
  problem,
  capabilityMatch,
  offerRecommendation,
  signal,
}) {
  const recommended = capabilityMatch?.recommendedCapabilities || [];
  const topCapability = recommended[0];
  const topOffer = offerRecommendation?.recommendedOffers?.[0];
  const signalType = signal?.signalType || problem?.metadata?.signalType || null;

  const evidence = {
    problemConfidence: typeof problem?.confidence === "number" ? problem.confidence : 0,
    problemCategory: problem?.category || null,
    situationCategory: problem?.metadata?.situationCategory || null,
    topCapabilityFit: topCapability?.fitScore ?? 0,
    topCapabilityId: topCapability?.capabilityId || null,
    offerFit: topOffer?.offerFitScore ?? 0,
    offerId: topOffer?.offerId || null,
    signalType,
    recommendedCount: recommended.length,
    supportingFacts: problem?.supportingFactIds?.length ?? 0,
    supportingSignals: problem?.supportingSignalIds?.length ?? 0,
  };

  if (!signalType || signalType === "unknown") {
    return {
      actionable: false,
      abstained: buildAbstention(
        "unknown_signal_category",
        evidence,
        "Need identifiable signal type with commercial context",
      ),
    };
  }

  if (evidence.problemConfidence < ABSTENTION_THRESHOLDS.minProblemConfidence) {
    return {
      actionable: false,
      abstained: buildAbstention(
        "insufficient_commercial_confidence",
        evidence,
        "Need buyer, project size, deadline, or procurement signal",
      ),
    };
  }

  const strongRecommendations = recommended.filter(
    (row) => (row.fitScore ?? 0) >= ABSTENTION_THRESHOLDS.strongFitScore,
  );

  if (
    recommended.length === 0 ||
    strongRecommendations.length < ABSTENTION_THRESHOLDS.minStrongRecommendations
  ) {
    return {
      actionable: false,
      abstained: buildAbstention(
        "weak_recommendations",
        evidence,
        "Need stronger capability fit or clearer industrial service scope",
      ),
    };
  }

  if (evidence.topCapabilityFit < ABSTENTION_THRESHOLDS.minCapabilityFit) {
    return {
      actionable: false,
      abstained: buildAbstention(
        "weak_capability_fit",
        evidence,
        "Need stronger capability alignment before commercial action",
      ),
    };
  }

  if (
    typeof evidence.offerFit === "number" &&
    evidence.offerFit - evidence.topCapabilityFit > ABSTENTION_THRESHOLDS.maxOfferCapabilityGap
  ) {
    return {
      actionable: false,
      abstained: buildAbstention(
        "offer_capability_mismatch",
        evidence,
        "Offer fit must be supported by capability fit before outreach",
      ),
    };
  }

  if (
    (problem?.category === "unknown" || problem?.metadata?.situationCategory === "Unknown") &&
    evidence.problemConfidence < ABSTENTION_THRESHOLDS.sparseUnknownConfidence &&
    evidence.supportingFacts < 2
  ) {
    return {
      actionable: false,
      abstained: buildAbstention(
        "sparse_evidence",
        evidence,
        "Need buyer, project size, deadline, or procurement signal",
      ),
    };
  }

  if (
    problem?.category === "general_services_demand" &&
    evidence.problemConfidence < ABSTENTION_THRESHOLDS.generalServicesConfidence
  ) {
    return {
      actionable: false,
      abstained: buildAbstention(
        "unclear_commercial_action",
        evidence,
        "Need buyer, project size, deadline, or procurement signal",
      ),
    };
  }

  return { actionable: true, evidence };
}
