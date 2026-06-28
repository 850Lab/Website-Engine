export function findCandidateOffers(matchContext, offers = []) {
  const fitById = matchContext.fitByCapabilityId;
  const candidates = [];

  for (const offer of offers) {
    const overlappingCapabilities = offer.capabilityIds.filter((id) =>
      matchContext.targetCapabilityIds.includes(id),
    );

    if (!overlappingCapabilities.length) continue;

    const weightedCapabilityFit = overlappingCapabilities.reduce(
      (sum, id) => sum + (fitById.get(id) || 0),
      0,
    );

    candidates.push({
      offer,
      overlappingCapabilities,
      weightedCapabilityFit,
      selectionReasons: [
        `Shares ${overlappingCapabilities.length} capability(ies): ${overlappingCapabilities.join(", ")}`,
      ],
    });
  }

  return candidates.sort((a, b) => b.weightedCapabilityFit - a.weightedCapabilityFit);
}

export function rejectNonCandidateOffers(matchContext, offers = [], candidates = []) {
  const candidateIds = new Set(candidates.map((row) => row.offer.id));
  return offers
    .filter((offer) => !candidateIds.has(offer.id))
    .map((offer) => ({
      offerId: offer.id,
      rejectionReason: "No overlap with recommended or composition capabilities",
      failedChecks: ["candidate_filter"],
    }));
}
