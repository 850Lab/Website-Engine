import { recommendOffers } from "../offer-intelligence/index.js";
import {
  getCapabilityMatch,
  initializeCapabilityMatchStore,
} from "../capability-matches/index.js";
import {
  getOfferRecommendationsByCapabilityMatchId,
  initializeOfferRecommendationStore,
} from "../offer-recommendations/index.js";
import { requireInputRef, runPipelineStage } from "./utils.js";

export async function offerRecommendHandler(job, context) {
  return runPipelineStage(job, context, {
    stage: "offer",
    jobType: "offer.recommend",
    async execute(jobRef, stageContext) {
      const capabilityMatchId = requireInputRef(jobRef, "offer.recommend");
      await initializeCapabilityMatchStore();
      await initializeOfferRecommendationStore();

      const capabilityMatch = await getCapabilityMatch(capabilityMatchId);
      if (!capabilityMatch) {
        throw new Error(`Capability match not found: ${capabilityMatchId}`);
      }

      const existing = await getOfferRecommendationsByCapabilityMatchId(capabilityMatchId);
      let offerRecommendation = existing[existing.length - 1] || null;

      if (!offerRecommendation) {
        offerRecommendation = await recommendOffers(capabilityMatch, { persist: true });
      }

      if (!offerRecommendation?.id) {
        throw new Error(
          `offer.recommend produced no recommendation for capability match ${capabilityMatchId}`,
        );
      }

      await stageContext.emitDomain("offer.completed", {
        subjectType: "offer_recommendation",
        subjectId: offerRecommendation.id,
        capabilityMatchId,
        problemId: offerRecommendation.problemId,
        offerRecommendationId: offerRecommendation.id,
      });

      return {
        outputRefs: [offerRecommendation.id],
        skipped: Boolean(existing.length),
        metadata: {
          capabilityMatchId,
          offerRecommendationId: offerRecommendation.id,
          skipped: Boolean(existing.length),
        },
      };
    },
  });
}
