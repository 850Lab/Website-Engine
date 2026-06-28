import { randomUUID } from "node:crypto";
import { getProblem } from "../problems/index.js";
import { getCapabilityMatchesByProblemId } from "../capability-matches/index.js";
import { getOfferRecommendationsByProblemId } from "../offer-recommendations/index.js";
import { matchCapabilities } from "../capability-matcher/index.js";
import { recommendOffers } from "../offer-intelligence/index.js";
import { validateOpportunity } from "../opportunity-validator/index.js";
import {
  initializeOpportunityStore,
  saveOpportunity,
  listOpportunities,
} from "../opportunities/index.js";
import { getOfferWithCapabilities } from "../offers/index.js";
import {
  buildBuyer,
  buildConstraints,
  buildEstimatedValue,
  buildExecutionReadiness,
  buildIndustry,
  buildLocation,
  buildOpportunityExplainability,
  buildRecommendedNextAction,
} from "./explainability.js";

export const OPPORTUNITY_FACTORY_VERSION = "opportunity_factory_v0";

export async function buildOpportunity({ problem, capabilityMatch, offerRecommendation }) {
  if (!problem?.id) throw new Error("buildOpportunity requires problem");
  if (!capabilityMatch?.id) throw new Error("buildOpportunity requires capabilityMatch");
  if (!offerRecommendation?.id) throw new Error("buildOpportunity requires offerRecommendation");

  if (problem.id !== capabilityMatch.problemId) {
    throw new Error("Problem id must match capability match problemId");
  }
  if (problem.id !== offerRecommendation.problemId) {
    throw new Error("Problem id must match offer recommendation problemId");
  }
  if (capabilityMatch.id !== offerRecommendation.capabilityMatchId) {
    throw new Error("Capability match id must match offer recommendation capabilityMatchId");
  }

  const selectedOffer = offerRecommendation.recommendedOffers?.[0];
  if (!selectedOffer) {
    throw new Error("Offer recommendation must include at least one recommended offer");
  }

  const offerRecord = await getOfferWithCapabilities(selectedOffer.offerId);
  const buyer = buildBuyer(problem, selectedOffer);
  const location = buildLocation(problem);
  const industry = buildIndustry(problem, selectedOffer);
  const estimatedValue = buildEstimatedValue(selectedOffer, offerRecord);
  const constraints = buildConstraints(capabilityMatch, problem);
  const recommendedNextAction = buildRecommendedNextAction(selectedOffer, offerRecord);

  const explainability = buildOpportunityExplainability({
    problem,
    capabilityMatch,
    offerRecommendation,
    selectedOffer,
    offerRecord,
    buyer,
    location,
    industry,
    estimatedValue,
    constraints,
    recommendedNextAction,
  });

  const now = new Date().toISOString();

  return {
    id: `opp_${randomUUID()}`,
    title: `${selectedOffer.offerName} — ${problem.title}`,
    description: offerRecord?.promise || problem.description,
    problemId: problem.id,
    capabilityMatchId: capabilityMatch.id,
    offerRecommendationId: offerRecommendation.id,
    buyer,
    location,
    industry,
    estimatedValue,
    confidence: problem.confidence,
    executionReadiness: buildExecutionReadiness(capabilityMatch, { valid: true }),
    explainability,
    constraints,
    recommendedNextAction,
    status: "assembled",
    createdAt: now,
    updatedAt: now,
    metadata: {
      factoryVersion: OPPORTUNITY_FACTORY_VERSION,
      problemCategory: problem.category,
      offerId: selectedOffer.offerId,
      capabilityMatcherVersion: capabilityMatch.matcherVersion,
      offerIntelligenceVersion: offerRecommendation.offerIntelligenceVersion,
    },
  };
}

export async function buildOpportunityForProblem(problemId, options = {}) {
  let problem = options.problem || (await getProblem(problemId));
  if (!problem) {
    throw new Error(`Problem not found: ${problemId}`);
  }

  let capabilityMatch =
    options.capabilityMatch ||
    (await getCapabilityMatchesByProblemId(problemId)).slice(-1)[0] ||
    null;

  if (!capabilityMatch && options.ensureUpstream !== false) {
    capabilityMatch = await matchCapabilities(problem, { persist: options.persist !== false });
  }
  if (!capabilityMatch) {
    throw new Error(`No capability match available for problem: ${problemId}`);
  }

  let offerRecommendation =
    options.offerRecommendation ||
    (await getOfferRecommendationsByProblemId(problemId)).slice(-1)[0] ||
    null;

  if (!offerRecommendation && options.ensureUpstream !== false) {
    offerRecommendation = await recommendOffers(capabilityMatch, {
      persist: options.persist !== false,
    });
  }
  if (!offerRecommendation) {
    throw new Error(`No offer recommendation available for problem: ${problemId}`);
  }

  const assembled = await buildOpportunity({
    problem,
    capabilityMatch,
    offerRecommendation,
  });

  const validation = validateOpportunity(assembled);
  const opportunity = {
    ...assembled,
    status: validation.valid ? "validated" : "assembled",
    executionReadiness: validation.valid ? assembled.executionReadiness : "blocked",
    metadata: {
      ...assembled.metadata,
      validationStatus: validation.status,
      validationErrors: validation.errors,
    },
  };

  if (options.persist !== false && validation.valid) {
    await initializeOpportunityStore();
    return { opportunity: await saveOpportunity(opportunity), validation };
  }

  return { opportunity, validation };
}

export { buildOpportunityExplainability } from "./explainability.js";
