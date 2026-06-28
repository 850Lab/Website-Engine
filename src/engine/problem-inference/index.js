import { listSituations, getSituation } from "../situations/index.js";
import {
  createHypothesis,
  updateHypothesis,
  listHypotheses,
  initializeHypothesisStore,
} from "../hypotheses/index.js";
import { generateHypothesesFromSituation } from "../hypothesis-generator/index.js";
import { collectEvidenceForHypothesis } from "../evidence-engine/index.js";
import { calculateHypothesisConfidence, PROMOTION_THRESHOLD } from "../confidence-engine/index.js";
import {
  findContradictions,
  detectCompetingHypotheses,
  applyContradictionsToHypotheses,
} from "../contradictions/index.js";
import {
  createProblem,
  buildExplainability,
  initializeProblemStore,
  listProblems,
} from "../problems/index.js";

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

export async function inferProblems(options = {}) {
  await initializeHypothesisStore();
  await initializeProblemStore();

  const situations = options.situationId
    ? [await getSituation(options.situationId)].filter(Boolean)
    : await listSituations();

  if (!situations.length) {
    return { hypotheses: [], contradictions: [], problems: [], promoted: [], rejected: [] };
  }

  const createdHypotheses = [];

  for (const situation of situations) {
    const drafts = await generateHypothesesFromSituation(situation.id);
    for (const draft of drafts) {
      createdHypotheses.push(await createHypothesis(draft));
    }
  }

  const evaluated = [];
  for (const hypothesis of createdHypotheses) {
    const evidenceBundle = await collectEvidenceForHypothesis(hypothesis);
    const confidenceResult = calculateHypothesisConfidence(hypothesis, evidenceBundle, {
      contradictions: [],
    });

    const nextStatus =
      confidenceResult.confidence >= PROMOTION_THRESHOLD * 0.8 ? "supported" : "generated";

    evaluated.push(
      await updateHypothesis(
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
      ),
    );
  }

  const contradictions = findContradictions(evaluated);
  const competing = detectCompetingHypotheses(evaluated);

  for (const link of competing) {
    await updateHypothesis(link.a.id, {
      competingHypothesisIds: [link.b.id],
    });
    await updateHypothesis(link.b.id, {
      competingHypothesisIds: [link.a.id],
    });
  }

  const contestedDrafts = applyContradictionsToHypotheses(evaluated, contradictions);
  const contested = [];
  for (const row of contestedDrafts) {
    const existing = evaluated.find((item) => item.id === row.id);
    if (!existing) continue;

    const evidenceBundle = await collectEvidenceForHypothesis(existing);
    const relatedContradictions = contradictions.filter((item) =>
      item.hypothesisIds.includes(row.id),
    );
    const confidenceResult = calculateHypothesisConfidence(existing, evidenceBundle, {
      contradictions: relatedContradictions,
    });

    contested.push(
      await updateHypothesis(
        row.id,
        {
          status: row.status,
          contradictionIds: row.contradictionIds,
          confidence: confidenceResult.confidence,
          confidenceBreakdown: confidenceResult.confidenceBreakdown,
          evidenceWeight: evidenceBundle.evidenceWeight,
          missingEvidence: evidenceBundle.missingEvidence,
        },
        { force: row.status !== existing.status },
      ),
    );
  }

  const promoted = [];
  const rejected = [];

  for (const hypothesis of contested.filter((row) => row.metadata?.polarity === "negative")) {
    if (hypothesis.status === "promoted") continue;
    rejected.push(
      await updateHypothesis(
        hypothesis.id,
        { status: "rejected" },
        { force: hypothesis.status !== "rejected" },
      ),
    );
  }

  const refreshed = await listHypotheses();
  const positiveCandidates = refreshed.filter(
    (row) =>
      (row.metadata?.polarity || "positive") === "positive" &&
      row.status !== "rejected" &&
      row.status !== "promoted",
  );

  for (const hypothesis of positiveCandidates) {
    const evidenceBundle = await collectEvidenceForHypothesis(hypothesis);
    const relatedContradictions = contradictions.filter((item) =>
      item.hypothesisIds.includes(hypothesis.id),
    );
    const activeContradictions = relatedContradictions.filter((item) => {
      const otherId = item.hypothesisIds.find((id) => id !== hypothesis.id);
      const other = refreshed.find((row) => row.id === otherId);
      return other && other.status !== "rejected";
    });
    const confidenceResult = calculateHypothesisConfidence(hypothesis, evidenceBundle, {
      contradictions: activeContradictions,
    });

    if (
      confidenceResult.confidence < PROMOTION_THRESHOLD ||
      activeContradictions.length > 0
    ) {
      if (hypothesis.status !== "promoted") {
        rejected.push(
          await updateHypothesis(
            hypothesis.id,
            {
              status: "rejected",
              confidence: confidenceResult.confidence,
              confidenceBreakdown: confidenceResult.confidenceBreakdown,
            },
            { force: true },
          ),
        );
      }
      continue;
    }

    const situation = evidenceBundle.situation;
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
        situation.summary?.affectedMarkets || situation.marketIds || hypothesis.metadata?.affectedMarkets,
      affectedCapabilities:
        situation.summary?.affectedCapabilities ||
        situation.capabilityIds ||
        hypothesis.metadata?.affectedCapabilities,
      explainability,
      metadata: {
        inferenceEngine: "problem_inference_v0",
        promotionThreshold: PROMOTION_THRESHOLD,
      },
    });

    promoted.push(problem);
    await updateHypothesis(
      hypothesis.id,
      {
        status: "promoted",
        confidence: confidenceResult.confidence,
        confidenceBreakdown: confidenceResult.confidenceBreakdown,
      },
      { force: true },
    );
  }

  return {
    hypotheses: await listHypotheses(),
    contradictions,
    problems: await listProblems(),
    promoted,
    rejected,
  };
}

export { PROMOTION_THRESHOLD };
