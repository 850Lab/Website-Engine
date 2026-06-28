const REQUIRED_EXPLAINABILITY_KEYS = [
  "whatProblem",
  "whyExists",
  "evidence",
  "selectedCapability",
  "selectedOffer",
  "buyer",
  "location",
  "constraints",
  "commercialViability",
  "recommendedNextAction",
];

function check(rule, condition, message, passMessage) {
  return {
    rule,
    status: condition ? "pass" : "fail",
    message: condition ? passMessage : message,
    blocksOpportunity: !condition,
  };
}

function hasLocation(location = {}) {
  return Boolean(
    location.city ||
      location.state ||
      location.country ||
      location.remoteEligible,
  );
}

function hasBuyer(buyer = {}) {
  return Boolean(buyer.entityId || buyer.label);
}

function hasRecommendedAction(action = {}) {
  return Boolean(action.action && action.channel);
}

export function validateOpportunity(opportunity = {}) {
  const checks = [];

  checks.push(
    check(
      "problem_reference",
      Boolean(opportunity.problemId),
      "Missing problemId",
      "Problem reference present",
    ),
  );
  checks.push(
    check(
      "capability_match_reference",
      Boolean(opportunity.capabilityMatchId),
      "Missing capabilityMatchId",
      "Capability match reference present",
    ),
  );
  checks.push(
    check(
      "offer_recommendation_reference",
      Boolean(opportunity.offerRecommendationId),
      "Missing offerRecommendationId",
      "Offer recommendation reference present",
    ),
  );
  checks.push(
    check(
      "title",
      Boolean(opportunity.title),
      "Missing title",
      "Title present",
    ),
  );
  checks.push(
    check(
      "description",
      Boolean(opportunity.description),
      "Missing description",
      "Description present",
    ),
  );
  checks.push(
    check(
      "confidence",
      typeof opportunity.confidence === "number" && opportunity.confidence > 0,
      "Missing or invalid confidence",
      "Confidence present",
    ),
  );
  checks.push(
    check(
      "buyer",
      hasBuyer(opportunity.buyer),
      "Missing buyer entityId or label",
      "Buyer present",
    ),
  );
  checks.push(
    check(
      "location",
      hasLocation(opportunity.location),
      "Missing location",
      "Location present",
    ),
  );
  checks.push(
    check(
      "recommended_next_action",
      hasRecommendedAction(opportunity.recommendedNextAction),
      "Missing recommendedNextAction",
      "Recommended next action present",
    ),
  );

  const explainability = opportunity.explainability || {};
  for (const key of REQUIRED_EXPLAINABILITY_KEYS) {
    checks.push(
      check(
        `explainability_${key}`,
        explainability[key] != null,
        `Missing explainability.${key}`,
        `Explainability ${key} present`,
      ),
    );
  }

  checks.push(
    check(
      "explainability_evidence_refs",
      Array.isArray(explainability.evidence?.situationIds) &&
        explainability.evidence.situationIds.length > 0,
      "Explainability evidence must reference situations via problem chain",
      "Evidence references present",
    ),
  );

  checks.push(
    check(
      "selected_capability",
      Boolean(explainability.selectedCapability?.capabilityMatchId) &&
        Array.isArray(explainability.selectedCapability?.capabilities) &&
        explainability.selectedCapability.capabilities.length > 0,
      "Selected capability explainability incomplete",
      "Selected capability explainability present",
    ),
  );

  checks.push(
    check(
      "selected_offer",
      Boolean(explainability.selectedOffer?.offerId),
      "Selected offer explainability incomplete",
      "Selected offer explainability present",
    ),
  );

  const failedChecks = checks.filter((row) => row.blocksOpportunity);
  const valid = failedChecks.length === 0;

  return {
    valid,
    status: valid ? "validated" : "rejected",
    checks,
    errors: failedChecks.map((row) => row.message),
    validatedAt: new Date().toISOString(),
  };
}

export function validateOpportunityOrThrow(opportunity) {
  const result = validateOpportunity(opportunity);
  if (!result.valid) {
    throw new Error(`Opportunity validation failed: ${result.errors.join("; ")}`);
  }
  return result;
}
