import { listCapabilities } from "../capabilities/index.js";
import { getProblem } from "../problems/index.js";
import {
  initializeCapabilityMatchStore,
  saveCapabilityMatch,
  listCapabilityMatches,
} from "../capability-matches/index.js";
import { getProblemsSolvedForCategory } from "./problem-category-map.js";
import { extractProblemContext } from "./problem-context.js";
import { findCandidateCapabilities, rejectNonCandidates } from "./candidates.js";
import { evaluateConstraints, hasHardConstraintFailure } from "./constraints.js";
import { analyzeFit, compareCapabilities } from "./fit-score.js";
import { buildCompositionPlan } from "./composition.js";
import {
  buildCapabilityExplainability,
  buildInputHash,
  MATCHER_VERSION,
} from "./explainability.js";

function topSelectionReasons(candidate, fitAnalysis) {
  const ranked = Object.entries(fitAnalysis.dimensionBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`);
  return [...candidate.selectionReasons, ...ranked];
}

export async function matchCapabilities(problem, options = {}) {
  if (!problem?.id) {
    throw new Error("matchCapabilities requires a Problem with id");
  }

  const capabilities = options.capabilities || (await listCapabilities());
  const problemContext = extractProblemContext(problem);
  const targetProblems = getProblemsSolvedForCategory(problemContext.category);
  const inputHash = buildInputHash(problem, capabilities);

  const candidates = findCandidateCapabilities(problemContext, capabilities);
  const preRejected = rejectNonCandidates(problemContext, capabilities, candidates);

  const analyzed = [];
  const constraintRejected = [];

  for (const candidate of candidates) {
    const constraintResults = evaluateConstraints(problemContext, candidate.capability);
    if (hasHardConstraintFailure(constraintResults)) {
      constraintRejected.push({
        capabilityId: candidate.capability.id,
        fitScore: 0,
        rejectionReason: constraintResults
          .filter((row) => row.blocksExecution)
          .map((row) => row.message)
          .join("; "),
        failedConstraints: constraintResults.filter((row) => row.blocksExecution).map((row) => row.type),
      });
      continue;
    }

    const fitAnalysis = analyzeFit(problemContext, candidate, constraintResults, targetProblems);
    analyzed.push({
      capability: candidate.capability,
      selectionReasons: topSelectionReasons(candidate, fitAnalysis),
      matchedProblems: candidate.matchedProblems,
      constraintResults,
      ...fitAnalysis,
    });
  }

  analyzed.sort(compareCapabilities);

  const recommendedCapabilities = analyzed.map((row, index) => ({
    capabilityId: row.capability.id,
    capabilityName: row.capability.name,
    rank: index + 1,
    fitScore: row.fitScore,
    dimensionBreakdown: row.dimensionBreakdown,
    selectionReasons: row.selectionReasons,
    constraintResults: row.constraintResults,
  }));

  const compositionPlan = buildCompositionPlan(problemContext, analyzed);
  const rejectedCapabilities = [...preRejected, ...constraintRejected];

  const explainability = buildCapabilityExplainability({
    problem,
    problemContext,
    selected: analyzed,
    rejected: rejectedCapabilities,
    compositionPlan,
    inputHash,
  });

  const recommendation = {
    problemId: problem.id,
    recommendedCapabilities,
    rejectedCapabilities,
    compositionPlan,
    explainability,
    matcherVersion: MATCHER_VERSION,
    inputHash,
    generatedAt: explainability.generatedAt,
    metadata: {
      problemCategory: problemContext.category,
      candidateCount: candidates.length,
      recommendedCount: recommendedCapabilities.length,
      rejectedCount: rejectedCapabilities.length,
    },
  };

  if (options.persist !== false) {
    await initializeCapabilityMatchStore();
    return saveCapabilityMatch(recommendation);
  }

  return recommendation;
}

export async function matchCapabilitiesForProblems(options = {}) {
  await initializeCapabilityMatchStore();

  const problems = options.problemId
    ? [await getProblem(options.problemId)].filter(Boolean)
    : options.problems || [];

  if (!problems.length) {
    return { recommendations: await listCapabilityMatches(), matched: [] };
  }

  const matched = [];
  for (const problem of problems) {
    matched.push(await matchCapabilities(problem, { persist: options.persist !== false }));
  }

  return {
    recommendations: await listCapabilityMatches(),
    matched,
  };
}

export { MATCHER_VERSION };
