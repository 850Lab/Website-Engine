import { collectEvidenceForHypothesis } from "../evidence-engine/index.js";
import {
  calculateHypothesisConfidence,
  PROMOTION_THRESHOLD,
} from "../confidence-engine/index.js";
import { findContradictions } from "../contradictions/index.js";
import {
  getHypothesis,
  initializeHypothesisStore,
  listHypotheses,
  updateHypothesis,
} from "../hypotheses/index.js";
import {
  buildExplainability,
  createProblem,
  initializeProblemStore,
  listProblems,
} from "../problems/index.js";
import { getSituation } from "../situations/index.js";
import { requireInputRef, runPipelineStage } from "./utils.js";

const SEVERITY_BY_CATEGORY = {
  expansion_contractor_demand: "high",
  hiring_staffing_surge: "high",
  turnaround_labor_surge: "high",
  emergency_response_demand: "critical",
  funding_program_demand: "medium",
  infrastructure_restoration_demand: "medium",
  capital_project_services_demand: "medium",
  general_services_demand: "low",
};

const URGENCY_BY_SITUATION_PRIORITY = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
};

async function findProblemForHypothesis(hypothesisId) {
  const problems = await listProblems();
  return problems.find((row) => row.supportingHypothesisIds?.includes(hypothesisId)) || null;
}

async function prepareHypothesisForPromotion(hypothesisId) {
  const hypothesis = await getHypothesis(hypothesisId);
  if (!hypothesis) {
    throw new Error(`Hypothesis not found: ${hypothesisId}`);
  }

  const situationId = hypothesis.originatingSituationIds?.[0];
  const allHypotheses = await listHypotheses();

  for (const row of allHypotheses) {
    if (
      row.originatingSituationIds?.includes(situationId) &&
      row.metadata?.polarity === "negative" &&
      row.status !== "rejected" &&
      row.status !== "promoted"
    ) {
      await updateHypothesis(row.id, { status: "rejected" }, { force: true });
    }
  }

  const evidenceBundle = await collectEvidenceForHypothesis(hypothesis);
  const confidenceResult = calculateHypothesisConfidence(hypothesis, evidenceBundle, {
    contradictions: [],
  });
  const nextStatus =
    confidenceResult.confidence >= PROMOTION_THRESHOLD * 0.8 ? "supported" : "generated";

  return updateHypothesis(
    hypothesis.id,
    {
      supportingSignalIds: evidenceBundle.signals.map((row) => row.id),
      supportingFactIds: evidenceBundle.facts.map((row) => row.id),
      supportingRelationshipIds: evidenceBundle.relationships.map((row) => row.id),
      missingEvidence: evidenceBundle.missingEvidence,
      confidence: confidenceResult.confidence,
      confidenceBreakdown: confidenceResult.confidenceBreakdown,
      evidenceWeight: evidenceBundle.evidenceWeight,
      status: nextStatus,
      metadata: {
        ...hypothesis.metadata,
        reasoning: confidenceResult.reasoning,
      },
    },
    { force: nextStatus !== hypothesis.status },
  );
}

async function promoteHypothesisToProblem(hypothesis) {
  const evidenceBundle = await collectEvidenceForHypothesis(hypothesis);
  const allHypotheses = await listHypotheses();
  const contradictions = findContradictions(allHypotheses);
  const relatedContradictions = contradictions.filter((item) =>
    item.hypothesisIds.includes(hypothesis.id),
  );
  const activeContradictions = relatedContradictions.filter((item) => {
    const otherId = item.hypothesisIds.find((id) => id !== hypothesis.id);
    const other = allHypotheses.find((row) => row.id === otherId);
    return other && other.status !== "rejected";
  });
  const confidenceResult = calculateHypothesisConfidence(hypothesis, evidenceBundle, {
    contradictions: activeContradictions,
  });

  if ((hypothesis.metadata?.polarity || "positive") === "negative") {
    await updateHypothesis(
      hypothesis.id,
      { status: "rejected", confidence: confidenceResult.confidence },
      { force: hypothesis.status !== "rejected" },
    );
    throw new Error(`Hypothesis ${hypothesis.id} is negative polarity and was rejected`);
  }

  if (confidenceResult.confidence < PROMOTION_THRESHOLD || activeContradictions.length > 0) {
    await updateHypothesis(
      hypothesis.id,
      {
        status: "rejected",
        confidence: confidenceResult.confidence,
        confidenceBreakdown: confidenceResult.confidenceBreakdown,
      },
      { force: true },
    );
    throw new Error(`Hypothesis ${hypothesis.id} did not meet promotion threshold`);
  }

  const situation = evidenceBundle.situation || (await getSituation(hypothesis.originatingSituationIds?.[0]));
  if (!situation) {
    throw new Error(`Situation not found for hypothesis ${hypothesis.id}`);
  }

  const explainability = buildExplainability({
    hypothesis,
    evidenceBundle,
    contradictions: relatedContradictions,
    confidenceResult,
  });

  const problem = await createProblem({
    title: hypothesis.title,
    description: hypothesis.description,
    category: hypothesis.metadata?.problemCategoryCandidate || "unknown",
    severity:
      SEVERITY_BY_CATEGORY[hypothesis.metadata?.problemCategoryCandidate] || "medium",
    urgency: URGENCY_BY_SITUATION_PRIORITY[situation.priority] || "medium",
    confidence: confidenceResult.confidence,
    supportingHypothesisIds: [hypothesis.id],
    supportingSituationIds: hypothesis.originatingSituationIds,
    supportingFactIds: evidenceBundle.facts.map((row) => row.id),
    supportingRelationshipIds: evidenceBundle.relationships.map((row) => row.id),
    supportingSignalIds: evidenceBundle.signals.map((row) => row.id),
    affectedMarkets:
      situation.summary?.affectedMarkets ||
      situation.marketIds ||
      hypothesis.metadata?.affectedMarkets,
    affectedCapabilities:
      situation.summary?.affectedCapabilities ||
      situation.capabilityIds ||
      hypothesis.metadata?.affectedCapabilities,
    explainability,
    metadata: {
      inferenceEngine: "problem_inference_v0",
      promotionThreshold: PROMOTION_THRESHOLD,
      entityContext: {
        location: situation.location || null,
        industry: situation.metadata?.industry || null,
        primaryEntityId: situation.entityIds?.[0] || null,
        affectedMarkets: situation.summary?.affectedMarkets || situation.marketIds || [],
      },
    },
  });

  await updateHypothesis(
    hypothesis.id,
    {
      status: "promoted",
      confidence: confidenceResult.confidence,
      confidenceBreakdown: confidenceResult.confidenceBreakdown,
    },
    { force: true },
  );

  return problem;
}

export async function problemInferHandler(job, context) {
  return runPipelineStage(job, context, {
    stage: "problem",
    jobType: "problem.infer",
    async execute(jobRef, stageContext) {
      const hypothesisId = requireInputRef(jobRef, "problem.infer");
      await initializeHypothesisStore();
      await initializeProblemStore();

      const existingProblem = await findProblemForHypothesis(hypothesisId);
      if (existingProblem) {
        await stageContext.emitDomain("problems.completed", {
          subjectType: "problem",
          subjectId: existingProblem.id,
          hypothesisId,
          hypothesisIds: [hypothesisId],
          problemId: existingProblem.id,
        });

        return {
          outputRefs: [existingProblem.id],
          skipped: true,
          metadata: {
            hypothesisId,
            problemId: existingProblem.id,
            skipped: true,
          },
        };
      }

      const hypothesis = await prepareHypothesisForPromotion(hypothesisId);
      const problem = await promoteHypothesisToProblem(hypothesis);

      await stageContext.emitDomain("problems.completed", {
        subjectType: "problem",
        subjectId: problem.id,
        hypothesisId,
        hypothesisIds: [hypothesisId],
        problemId: problem.id,
      });

      return {
        outputRefs: [problem.id],
        metadata: {
          hypothesisId,
          problemId: problem.id,
        },
      };
    },
  });
}
