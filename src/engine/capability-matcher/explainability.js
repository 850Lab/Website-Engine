import { createHash } from "node:crypto";
import { getCapabilityRegistryVersion } from "../capabilities/index.js";
import { summarizeConstraints } from "./constraints.js";
import { buildDifferentiation } from "./fit-score.js";

export const MATCHER_VERSION = "capability_matcher_v0";

export function buildInputHash(problem, capabilities) {
  const payload = JSON.stringify({
    problemId: problem.id,
    category: problem.category,
    confidence: problem.confidence,
    urgency: problem.urgency,
    affectedCapabilities: problem.affectedCapabilities,
    registryVersion: getCapabilityRegistryVersion(),
    capabilityIds: capabilities.map((row) => row.id).sort(),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function buildCapabilityExplainability({
  problem,
  problemContext,
  selected,
  rejected,
  compositionPlan,
  inputHash,
}) {
  const allConstraintResults = selected.flatMap((row) => row.constraintResults);

  return {
    problemId: problem.id,
    problemSummary: problem.title,
    situationIds: problemContext.situationIds,
    hypothesisIds: problemContext.hypothesisIds,
    matcherVersion: MATCHER_VERSION,
    inputHash,
    selected: selected.map((row, index) => ({
      capabilityId: row.capability.id,
      capabilityName: row.capability.name,
      rank: index + 1,
      fitScore: row.fitScore,
      dimensionBreakdown: row.dimensionBreakdown,
      selectionReasons: row.selectionReasons,
      evidenceRefs: [
        ...problemContext.evidenceRefs.factIds,
        ...problemContext.evidenceRefs.signalIds,
      ],
      constraintResults: row.constraintResults,
    })),
    rejected: rejected.map((row) => ({
      capabilityId: row.capabilityId,
      fitScore: row.fitScore ?? null,
      rejectionReason: row.rejectionReason,
      failedConstraints: row.failedConstraints || [],
      dimensionBreakdown: row.dimensionBreakdown || null,
    })),
    compositionPlan: compositionPlan || null,
    constraintSummary: summarizeConstraints(allConstraintResults),
    differentiation: buildDifferentiation(selected),
    generatedAt: new Date().toISOString(),
  };
}
