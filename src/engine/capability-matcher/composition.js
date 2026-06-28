import { getCompositionRule } from "./problem-category-map.js";

export function buildCompositionPlan(problemContext, rankedAnalyses = []) {
  const rule = getCompositionRule(problemContext.category);
  if (!rule || !rankedAnalyses.length) return null;

  const byId = new Map(rankedAnalyses.map((row) => [row.capability.id, row]));
  const requiredCapabilities = [];
  const optionalCapabilities = [];

  for (const capabilityId of rule.required || []) {
    const analysis = byId.get(capabilityId);
    if (!analysis) continue;
    requiredCapabilities.push(toComposedRef(analysis, "required"));
  }

  for (const capabilityId of rule.optional || []) {
    const analysis = byId.get(capabilityId);
    if (!analysis) continue;
    optionalCapabilities.push(toComposedRef(analysis, "optional"));
  }

  if (!requiredCapabilities.length) return null;

  const mandatoryScores = requiredCapabilities.map((row) => row.fitScore);
  const optionalScores = optionalCapabilities.map((row) => row.fitScore);
  const minMandatory = Math.min(...mandatoryScores);
  const avgOptional = optionalScores.length
    ? optionalScores.reduce((sum, value) => sum + value, 0) / optionalScores.length
    : 1;
  const compositionFit = Number((minMandatory * avgOptional).toFixed(4));

  const leadTimes = requiredCapabilities
    .map((row) => byId.get(row.capabilityId)?.capability?.scalability?.leadTimeDays || 7)
    .filter(Boolean);

  return {
    compositionId: `comp_${problemContext.category}_${problemContext.problemId}`,
    parentCapabilityId: rule.parentCapabilityId || null,
    requiredCapabilities,
    optionalCapabilities,
    criticalPath: requiredCapabilities.map((row) => row.capabilityId),
    estimatedMobilizationDays: leadTimes.length ? Math.max(...leadTimes) : 7,
    compositionFit,
  };
}

function toComposedRef(analysis, role) {
  return {
    capabilityId: analysis.capability.id,
    role,
    fitScore: analysis.fitScore,
    constraintSummary: analysis.constraintResults,
  };
}
