import { discoverMissionBuyers } from "../discovery/index.js";
import { scoreBuyerForMission } from "../scoring/index.js";

export async function getNextRecommendedAction(mission) {
  const buyers = await discoverMissionBuyers(mission);

  const rankedBuyers = buyers
    .map((buyer) => {
      const scoring = scoreBuyerForMission(buyer, mission);
      return {
        ...buyer,
        opportunityScore: scoring.score,
        opportunityReasons: scoring.reasons,
        opportunityAnalyses: scoring.analyses,
      };
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  const buyer = rankedBuyers[0];

  if (!buyer) {
    return {
      missionId: mission.id,
      buyer: null,
      contact: null,
      recommendation: {
        channel: mission.channels[0],
        action: "Run Discovery",
        confidence: 0,
      },
      reasons: [
        "No matching buyers found",
        "Mission target needs more data",
      ],
    };
  }

  return {
    missionId: mission.id,
    buyer,
    contact: {
      name: null,
      role: mission.target.decisionMakers[0],
    },
    recommendation: {
      channel: buyer.phoneAvailable ? "Phone" : mission.channels[0],
      action: buyer.phoneAvailable ? "Call" : "Research Contact",
      confidence: buyer.opportunityScore,
    },
    reasons: buyer.opportunityReasons,
    analyses: buyer.opportunityAnalyses,
  };
}
