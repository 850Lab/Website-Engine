import { getActiveMission } from "../campaigns/index.js";
import { buildExecutionPlan } from "../execution/index.js";
import { discoverMissionBuyers } from "../discovery/index.js";

export async function buildOperatingPicture() {
  const mission = await getActiveMission();
  const executionPlan = await buildExecutionPlan(mission);
  const buyers = await discoverMissionBuyers(mission);

  const primaryContact =
    executionPlan.contacts?.find((contact) => contact.isPrimary) ||
    executionPlan.contacts?.[0] ||
    null;

  return {
    mission,

    nextAction: executionPlan.buyer
      ? {
          type: primaryContact?.type === "email" ? "Email" : "Call",
          buyer: executionPlan.buyer,
          contact: primaryContact,
          confidence: executionPlan.scoring.score,
          reasons: executionPlan.scoring.reasons,
        }
      : null,

    metrics: {
      buyersFound: buyers.length,
      contactsFound: executionPlan.contacts?.length || 0,
      opportunities: 0,
    },

    executionPlan,
  };
}
