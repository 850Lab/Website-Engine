import { analyzeContactability } from "./analyzers/contactability.js";
import { analyzeRegionFit } from "./analyzers/region-fit.js";
import { analyzeOfferFit } from "./analyzers/offer-fit.js";

export function scoreBuyerForMission(buyer, mission) {
  const analyses = [
    analyzeOfferFit(buyer, mission),
    analyzeRegionFit(buyer, mission),
    analyzeContactability(buyer, mission),
  ];

  const score = analyses.reduce((sum, item) => sum + item.score, 0);
  const reasons = analyses.flatMap((item) => item.reasons);

  return {
    score,
    reasons,
    analyses,
  };
}
