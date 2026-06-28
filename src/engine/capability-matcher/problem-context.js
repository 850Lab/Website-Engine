function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function extractProblemContext(problem = {}) {
  const entityContext = isObject(problem.metadata?.entityContext)
    ? problem.metadata.entityContext
    : {};

  return {
    problemId: problem.id,
    category: problem.category || "unknown",
    confidence: typeof problem.confidence === "number" ? problem.confidence : 0,
    urgency: problem.urgency || "medium",
    severity: problem.severity || "medium",
    affectedCapabilities: asArray(problem.affectedCapabilities),
    affectedMarkets: asArray(problem.affectedMarkets),
    location: isObject(entityContext.location) ? entityContext.location : null,
    industry: entityContext.industry || null,
    scale: entityContext.scale || problem.metadata?.scale || null,
    budget: entityContext.budget || problem.metadata?.budget || null,
    unionRequired: Boolean(entityContext.unionRequired || problem.metadata?.unionRequired),
    situationIds: asArray(problem.supportingSituationIds),
    hypothesisIds: asArray(problem.supportingHypothesisIds),
    evidenceRefs: {
      factIds: asArray(problem.supportingFactIds),
      relationshipIds: asArray(problem.supportingRelationshipIds),
      signalIds: asArray(problem.supportingSignalIds),
    },
  };
}

export function regionTokensFromLocation(location) {
  if (!location) return ["US"];
  const tokens = ["US"];
  if (location.country) tokens.push(String(location.country).toUpperCase());
  if (location.state) tokens.push(`${String(location.country || "US").toUpperCase()}-${String(location.state).toUpperCase()}`);
  return [...new Set(tokens)];
}
