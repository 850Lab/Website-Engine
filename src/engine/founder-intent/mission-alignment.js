function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function overlapScore(needles = [], haystack = "") {
  const text = normalizeText(haystack);
  if (!text) return 0;
  let hits = 0;
  for (const needle of needles) {
    if (normalizeText(needle) && text.includes(normalizeText(needle))) hits += 1;
  }
  return needles.length ? hits / needles.length : 0;
}

function geographyMatch(opportunity, mission) {
  const oppText = [
    opportunity?.location?.city,
    opportunity?.location?.state,
    opportunity?.headline,
    opportunity?.summary,
    opportunity?.title,
  ]
    .filter(Boolean)
    .join(" ");
  const labels = (mission.geography || []).map((row) => row.label || row.city || row.state).filter(Boolean);
  return overlapScore(labels, oppText);
}

function offerMatch(opportunity, mission) {
  const oppOffer = opportunity?.offerId || opportunity?.offer?.offerId || opportunity?.recommendedOfferId;
  if (oppOffer && mission.offers?.includes(oppOffer)) return 1;
  const oppText = [opportunity?.title, opportunity?.summary, opportunity?.headline].filter(Boolean).join(" ");
  return overlapScore(mission.offers || [], oppText) * 0.5;
}

function signalMatch(opportunity, mission) {
  const signalType = opportunity?.signalType || opportunity?.signal?.signalType || opportunity?.metadata?.signalType;
  const required = mission.requiredSignals || [];
  const ignored = mission.ignoredSignals || [];
  if (signalType && ignored.map(normalizeText).includes(normalizeText(signalType))) {
    return 0;
  }
  if (signalType && required.map(normalizeText).includes(normalizeText(signalType))) {
    return 1;
  }
  const text = [signalType, opportunity?.headline, opportunity?.summary, opportunity?.problemCategory]
    .filter(Boolean)
    .join(" ");
  return overlapScore(required, text);
}

function buyerMatch(opportunity, mission) {
  const text = [
    opportunity?.buyerType,
    opportunity?.title,
    opportunity?.summary,
    opportunity?.situationCategory,
    opportunity?.problemCategory,
  ]
    .filter(Boolean)
    .join(" ");
  return overlapScore(mission.buyerTypes || [], text);
}

export function alignOpportunityToMission(opportunity, mission) {
  const missionMatch = Math.min(
    1,
    geographyMatch(opportunity, mission) * 0.25 +
      offerMatch(opportunity, mission) * 0.3 +
      signalMatch(opportunity, mission) * 0.25 +
      buyerMatch(opportunity, mission) * 0.2,
  );

  const opportunityConfidence = Number(opportunity?.confidence ?? opportunity?.problemConfidence ?? 0.5);
  const commercialValue = Number(opportunity?.commercialValue ?? opportunityConfidence);
  const revenuePotential = Number(
    opportunity?.revenuePotential ?? mission?.revenueTarget?.amount ?? commercialValue * 10000,
  );
  const urgency = normalizeText(opportunity?.urgency || "medium");
  const executionDifficulty =
    urgency === "high" ? "medium" : mission?.constraints?.length > 3 ? "high" : "medium";

  let recommendedNextAction = "Review mission fit and approve for outreach preparation";
  if (missionMatch < 0.35) {
    recommendedNextAction = "Deprioritize — weak mission fit";
  } else if (mission.approvalPolicy?.requireFounderApprovalBeforeOutreach) {
    recommendedNextAction = "Founder review required before any outreach action";
  }

  return {
    missionId: mission.missionId,
    missionName: mission.name,
    missionMatch: Number(missionMatch.toFixed(4)),
    opportunityConfidence: Number(opportunityConfidence.toFixed(4)),
    commercialValue: Number(commercialValue.toFixed(4)),
    revenuePotential,
    urgency,
    executionDifficulty,
    recommendedNextAction,
  };
}

export function rankOpportunitiesForMission(opportunities = [], mission) {
  return opportunities
    .map((opportunity) => ({
      opportunity,
      alignment: alignOpportunityToMission(opportunity, mission),
    }))
    .sort((a, b) => b.alignment.missionMatch - a.alignment.missionMatch);
}
