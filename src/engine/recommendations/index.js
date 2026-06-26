import { discoverMissionBuyers } from "../discovery/index.js";

export async function getNextRecommendedAction(mission) {
  const buyers = await discoverMissionBuyers(mission);
  const buyer = buyers[0];

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
      confidence: buyer.score,
    },
    reasons: [
      "Highest ranked buyer",
      `Matches ${mission.target.buyer}`,
      buyer.phoneAvailable ? "Phone available" : "Phone not available",
      buyer.emailAvailable ? "Email available" : "Email not available",
    ],
  };
}
