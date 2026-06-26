import { discoverMissionBuyers } from "../discovery/index.js";
import { scoreBuyerForMission } from "../scoring/index.js";
import { discoverBuyerContacts } from "../contacts/index.js";

export async function buildExecutionPlan(mission) {
  const buyers = await discoverMissionBuyers(mission);

  if (!buyers.length) {
    return {
      recommendation: null,
      buyers: [],
    };
  }

  const ranked = buyers
    .map((buyer) => ({
      buyer,
      scoring: scoreBuyerForMission(buyer, mission),
    }))
    .sort((a, b) => b.scoring.score - a.scoring.score);

  const top = ranked[0];

  const contacts = await discoverBuyerContacts(top.buyer, mission);

  return {
    buyer: top.buyer,
    scoring: top.scoring,
    contacts,
  };
}
