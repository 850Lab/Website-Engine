export function extractMatchContext(capabilityMatch = {}) {
  const recommendedCapabilities = Array.isArray(capabilityMatch.recommendedCapabilities)
    ? capabilityMatch.recommendedCapabilities
    : [];

  const fitByCapabilityId = new Map(
    recommendedCapabilities.map((row) => [row.capabilityId, row.fitScore ?? 0]),
  );

  const compositionPlan = capabilityMatch.compositionPlan || null;
  const requiredCapabilityIds = (compositionPlan?.requiredCapabilities || []).map(
    (row) => row.capabilityId,
  );
  const optionalCapabilityIds = (compositionPlan?.optionalCapabilities || []).map(
    (row) => row.capabilityId,
  );

  const targetCapabilityIds = [
    ...new Set([
      ...recommendedCapabilities.map((row) => row.capabilityId),
      ...requiredCapabilityIds,
      ...optionalCapabilityIds,
    ]),
  ];

  return {
    capabilityMatchId: capabilityMatch.id,
    problemId: capabilityMatch.problemId,
    problemCategory: capabilityMatch.metadata?.problemCategory || "unknown",
    recommendedCapabilities,
    fitByCapabilityId,
    compositionPlan,
    requiredCapabilityIds,
    optionalCapabilityIds,
    targetCapabilityIds,
    matcherVersion: capabilityMatch.matcherVersion,
    capabilityInputHash: capabilityMatch.inputHash,
  };
}
