import { getCapabilityMatch } from "../capability-matches/index.js";
import { getOfferRecommendation } from "../offer-recommendations/index.js";
import { buildOpportunityForProblem } from "../opportunity-factory/index.js";
import { getProblem } from "../problems/index.js";
import { listOpportunities } from "../opportunities/index.js";
import { requireInputRef, runPipelineStage } from "./utils.js";

async function findOpportunityForOffer(offerRecommendationId) {
  const opportunities = await listOpportunities();
  return (
    opportunities.find((row) => row.offerRecommendationId === offerRecommendationId) || null
  );
}

export async function opportunityBuildHandler(job, context) {
  return runPipelineStage(job, context, {
    stage: "opportunity",
    jobType: "opportunity.build",
    async execute(jobRef, stageContext) {
      const offerRecommendationId = requireInputRef(jobRef, "opportunity.build");
      const offerRecommendation = await getOfferRecommendation(offerRecommendationId);
      if (!offerRecommendation) {
        throw new Error(`Offer recommendation not found: ${offerRecommendationId}`);
      }

      const existing = await findOpportunityForOffer(offerRecommendationId);
      if (existing) {
        await stageContext.emitDomain("opportunity.completed", {
          subjectType: "opportunity",
          subjectId: existing.id,
          offerRecommendationId,
          problemId: existing.problemId,
          opportunityId: existing.id,
        });

        return {
          outputRefs: [existing.id],
          skipped: true,
          metadata: {
            offerRecommendationId,
            opportunityId: existing.id,
            skipped: true,
          },
        };
      }

      const problem = await getProblem(offerRecommendation.problemId);
      if (!problem) {
        throw new Error(`Problem not found: ${offerRecommendation.problemId}`);
      }

      const capabilityMatch = await getCapabilityMatch(offerRecommendation.capabilityMatchId);
      if (!capabilityMatch) {
        throw new Error(`Capability match not found: ${offerRecommendation.capabilityMatchId}`);
      }

      const { opportunity } = await buildOpportunityForProblem(problem.id, {
        problem,
        capabilityMatch,
        offerRecommendation,
        ensureUpstream: false,
        persist: true,
      });

      if (!opportunity?.id) {
        throw new Error(
          `opportunity.build produced no opportunity for offer ${offerRecommendationId}`,
        );
      }

      await stageContext.emitDomain("opportunity.completed", {
        subjectType: "opportunity",
        subjectId: opportunity.id,
        offerRecommendationId,
        problemId: problem.id,
        opportunityId: opportunity.id,
      });

      return {
        outputRefs: [opportunity.id],
        metadata: {
          offerRecommendationId,
          opportunityId: opportunity.id,
          problemId: problem.id,
        },
      };
    },
  });
}
