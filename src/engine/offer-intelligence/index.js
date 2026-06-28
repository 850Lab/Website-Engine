import { listOffers, getOfferWithCapabilities } from "../offers/index.js";
import { getCapabilityMatchesByProblemId } from "../capability-matches/index.js";
import {
  initializeOfferRecommendationStore,
  saveOfferRecommendation,
  listOfferRecommendations,
} from "../offer-recommendations/index.js";
import { extractMatchContext } from "./match-context.js";
import { findCandidateOffers, rejectNonCandidateOffers } from "./candidates.js";
import { evaluateOfferEligibility, hasEligibilityFailure } from "./eligibility.js";
import { analyzeOfferFit, compareOfferCandidates } from "./fit-score.js";
import {
  buildOfferExplainability,
  buildOfferInputHash,
  OFFER_INTELLIGENCE_VERSION,
} from "./explainability.js";

export async function recommendOffers(capabilityMatch, options = {}) {
  if (!capabilityMatch?.id) {
    throw new Error("recommendOffers requires a capability match with id");
  }
  if (!capabilityMatch.recommendedCapabilities?.length) {
    throw new Error("recommendOffers requires recommended capabilities on the capability match");
  }

  const offers = options.offers || (await listOffers());
  const matchContext = extractMatchContext(capabilityMatch);
  const inputHash = buildOfferInputHash(capabilityMatch, offers);

  const candidates = findCandidateOffers(matchContext, offers);
  const preRejected = rejectNonCandidateOffers(matchContext, offers, candidates);

  const analyzed = [];
  const eligibilityRejected = [];

  for (const candidate of candidates) {
    const eligibility = evaluateOfferEligibility(matchContext, candidate);
    if (hasEligibilityFailure(eligibility)) {
      eligibilityRejected.push({
        offerId: candidate.offer.id,
        rejectionReason: eligibility.checks
          .filter((row) => row.blocksOffer)
          .map((row) => row.message)
          .join("; "),
        failedChecks: eligibility.checks.filter((row) => row.blocksOffer).map((row) => row.check),
        eligibilityChecks: eligibility.checks,
      });
      continue;
    }

    const offerWithCapabilities = options.attachCapabilities === false
      ? candidate.offer
      : await getOfferWithCapabilities(candidate.offer.id);

    const fitAnalysis = analyzeOfferFit(matchContext, candidate, offerWithCapabilities);
    analyzed.push({
      offer: offerWithCapabilities,
      eligibilityChecks: eligibility.checks,
      ...fitAnalysis,
    });
  }

  analyzed.sort(compareOfferCandidates);

  const recommendedOffers = analyzed.map((row, index) => ({
    offerId: row.offer.id,
    offerName: row.offer.name,
    rank: index + 1,
    offerFitScore: row.offerFitScore,
    dimensionBreakdown: row.dimensionBreakdown,
    selectionReasons: row.selectionReasons,
    packagedCapabilities: row.packagedCapabilities,
    eligibilityChecks: row.eligibilityChecks,
  }));

  const rejectedOffers = [...preRejected, ...eligibilityRejected];

  const explainability = buildOfferExplainability({
    capabilityMatch,
    matchContext,
    selected: analyzed,
    rejected: rejectedOffers,
    inputHash,
  });

  const recommendation = {
    capabilityMatchId: capabilityMatch.id,
    problemId: capabilityMatch.problemId,
    recommendedOffers,
    rejectedOffers,
    explainability,
    offerIntelligenceVersion: OFFER_INTELLIGENCE_VERSION,
    inputHash,
    generatedAt: explainability.generatedAt,
    metadata: {
      problemCategory: matchContext.problemCategory,
      candidateCount: candidates.length,
      recommendedCount: recommendedOffers.length,
      rejectedCount: rejectedOffers.length,
      capabilityMatcherVersion: matchContext.matcherVersion,
    },
  };

  if (options.persist !== false) {
    await initializeOfferRecommendationStore();
    return saveOfferRecommendation(recommendation);
  }

  return recommendation;
}

export async function selectOffersFromCapabilityMatch(capabilityMatch, options = {}) {
  return recommendOffers(capabilityMatch, options);
}

export async function recommendOffersForProblem(problemId, options = {}) {
  const matches = await getCapabilityMatchesByProblemId(problemId);
  const capabilityMatch = matches[matches.length - 1];
  if (!capabilityMatch) {
    throw new Error(`No capability match found for problem: ${problemId}`);
  }
  return recommendOffers(capabilityMatch, options);
}

export async function recommendOffersFromCapabilityMatches(options = {}) {
  await initializeOfferRecommendationStore();

  if (options.problemId) {
    const result = await recommendOffersForProblem(options.problemId, options);
    return {
      recommendations: await listOfferRecommendations(),
      matched: [result],
    };
  }

  if (options.capabilityMatch) {
    const result = await recommendOffers(options.capabilityMatch, options);
    return {
      recommendations: await listOfferRecommendations(),
      matched: [result],
    };
  }

  return { recommendations: await listOfferRecommendations(), matched: [] };
}

export { OFFER_INTELLIGENCE_VERSION };
