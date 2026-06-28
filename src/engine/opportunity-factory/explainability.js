function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function extractBuyerLabel(problem) {
  const entityContext = problem.metadata?.entityContext || {};
  const situationTitle = problem.explainability?.situations?.[0]?.title;
  if (situationTitle) {
    const parts = situationTitle.split("—");
    if (parts[0]?.trim()) return parts[0].trim();
  }
  if (entityContext.primaryEntityId) return entityContext.primaryEntityId;
  return problem.title.split(" ").slice(0, 3).join(" ") || "Unknown buyer";
}

export function buildBuyer(problem, selectedOffer) {
  const entityContext = problem.metadata?.entityContext || {};
  return {
    entityId: entityContext.primaryEntityId || null,
    label: extractBuyerLabel(problem),
    type: entityContext.primaryEntityId ? "entity" : "inferred",
    persona: selectedOffer?.offerName ? `${selectedOffer.offerName} buyer` : null,
    industry: entityContext.industry || problem.affectedMarkets?.[0] || null,
  };
}

export function buildLocation(problem) {
  const entityContext = problem.metadata?.entityContext || {};
  const location = entityContext.location || {};
  return {
    city: location.city || null,
    county: location.county || null,
    state: location.state || null,
    country: location.country || "US",
    address: location.address || null,
    facilityName: location.facilityName || null,
    remoteEligible: !location.state && !location.city,
  };
}

export function buildIndustry(problem, selectedOffer) {
  return (
    problem.metadata?.entityContext?.industry ||
    problem.affectedMarkets?.[0] ||
    selectedOffer?.packagedCapabilities?.[0] ||
    null
  );
}

export function buildEstimatedValue(selectedOffer, offerRecord) {
  const capabilities = asArray(offerRecord?.capabilities);
  const lows = capabilities
    .map((row) => row.marginProfile?.typicalContractLow)
    .filter((value) => typeof value === "number");
  const highs = capabilities
    .map((row) => row.marginProfile?.typicalContractHigh)
    .filter((value) => typeof value === "number");

  const low = lows.length ? Math.min(...lows) : null;
  const high = highs.length ? Math.max(...highs) : null;
  const midpoint = low != null && high != null ? Math.round((low + high) / 2) : null;

  return {
    currency: "USD",
    contractLow: low,
    contractHigh: high,
    midpoint,
    basis: "assembled_from_offer_capability_margin_profiles",
    offerFitScore: selectedOffer?.offerFitScore ?? null,
  };
}

export function buildConstraints(capabilityMatch, problem) {
  const capabilitySummary = capabilityMatch.explainability?.constraintSummary || {};
  return {
    capabilityConstraints: capabilitySummary,
    problemSeverity: problem.severity || null,
    problemUrgency: problem.urgency || null,
    affectedMarkets: asArray(problem.affectedMarkets),
  };
}

export function buildRecommendedNextAction(selectedOffer, offerRecord) {
  const channels = asArray(offerRecord?.channels);
  const primaryChannel = channels.includes("Phone")
    ? "Phone"
    : channels.includes("Visit")
      ? "Visit"
      : channels[0] || "Email";

  return {
    action: primaryChannel === "Phone" ? "schedule_discovery_call" : "review_with_sales_lead",
    channel: primaryChannel,
    priority: problemUrgencyToPriority(selectedOffer) || "medium",
    rationale: "Assembled from offer channels — no execution dispatch",
  };
}

function problemUrgencyToPriority(selectedOffer) {
  if (!selectedOffer) return "medium";
  return selectedOffer.offerFitScore >= 0.9 ? "high" : "medium";
}

export function buildExecutionReadiness(capabilityMatch, validationResult) {
  if (!validationResult.valid) return "blocked";
  const constraintSummary = capabilityMatch.explainability?.constraintSummary || {};
  if ((constraintSummary.fail || 0) > 0) return "review_required";
  if ((constraintSummary.penalty || 0) > 0) return "review_required";
  return "ready_for_review";
}

export function buildOpportunityExplainability({
  problem,
  capabilityMatch,
  offerRecommendation,
  selectedOffer,
  offerRecord,
  buyer,
  location,
  industry,
  estimatedValue,
  constraints,
  recommendedNextAction,
}) {
  const selectedCapabilities = asArray(capabilityMatch.recommendedCapabilities)
    .filter((row) => asArray(selectedOffer?.packagedCapabilities).includes(row.capabilityId))
    .map((row) => ({
      capabilityId: row.capabilityId,
      capabilityName: row.capabilityName,
      fitScore: row.fitScore,
      rank: row.rank,
    }));

  return {
    whatProblem: {
      id: problem.id,
      title: problem.title,
      category: problem.category,
      confidence: problem.confidence,
    },
    whyExists: problem.explainability?.why || null,
    evidence: {
      situationIds: asArray(problem.supportingSituationIds),
      hypothesisIds: asArray(problem.supportingHypothesisIds),
      factIds: asArray(problem.supportingFactIds),
      relationshipIds: asArray(problem.supportingRelationshipIds),
      signalIds: asArray(problem.supportingSignalIds),
      facts: asArray(problem.explainability?.facts),
      signals: asArray(problem.explainability?.signals),
      relationships: asArray(problem.explainability?.relationships),
      situations: asArray(problem.explainability?.situations),
    },
    selectedCapability: {
      capabilityMatchId: capabilityMatch.id,
      matcherVersion: capabilityMatch.matcherVersion,
      capabilities: selectedCapabilities,
      compositionPlan: capabilityMatch.compositionPlan || null,
    },
    selectedOffer: {
      offerRecommendationId: offerRecommendation.id,
      offerId: selectedOffer.offerId,
      offerName: selectedOffer.offerName,
      offerFitScore: selectedOffer.offerFitScore,
      packagedCapabilities: asArray(selectedOffer.packagedCapabilities),
      dimensionBreakdown: selectedOffer.dimensionBreakdown || {},
    },
    buyer,
    location,
    constraints,
    commercialViability: {
      estimatedValue,
      industry,
      offerFitScore: selectedOffer.offerFitScore,
      capabilityFitScores: selectedCapabilities.map((row) => ({
        capabilityId: row.capabilityId,
        fitScore: row.fitScore,
      })),
      rationale: [
        "Assembled from validated problem, capability match, and offer recommendation",
        "No opportunity score applied — Score Council is downstream",
      ],
    },
    recommendedNextAction,
  };
}
