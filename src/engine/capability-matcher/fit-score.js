import { getCategoryWeights } from "./problem-category-map.js";
import { constraintPenaltyFactor } from "./constraints.js";
import {
  applySemanticCalibration,
  isCommerciallyIrrelevant,
} from "./calibration.js";

const MATURITY_SCORE = {
  experimental: 0.55,
  proven: 0.75,
  scaled: 0.9,
  legacy: 0.65,
};

const URGENCY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function scoreOverlap(matchedProblems = [], targetProblems = []) {
  if (!targetProblems.length) return 0.4;
  if (!matchedProblems.length) return 0.2;
  return clamp(matchedProblems.length / Math.max(targetProblems.length, 1), 0.35, 1);
}

function scoreLocation(constraintResults = []) {
  const geo = constraintResults.find((row) => row.type === "geo");
  if (!geo) return 0.7;
  if (geo.status === "pass") return 1;
  if (geo.status === "penalty") return 0.75;
  return 0;
}

function scoreTiming(constraintResults = [], capability = {}, urgency = "medium") {
  const timing = constraintResults.find((row) => row.type === "timing");
  const leadTime = capability.scalability?.leadTimeDays ?? 7;
  const urgencyRank = URGENCY_RANK[urgency] || 2;
  let base = timing?.status === "pass" ? 0.9 : 0.65;
  if (urgencyRank >= 3 && leadTime <= 2) base = 1;
  if (urgencyRank >= 3 && leadTime > 5) base = 0.5;
  return base;
}

function scoreCapacity(capability = {}) {
  const capacity = capability.estimatedCapacity || {};
  if (!capacity.available) return 0.5;
  const free = Math.max(capacity.available - (capacity.committed || 0), 0);
  return clamp(free / capacity.available, 0.3, 1);
}

function scoreHistorical(capability = {}) {
  const perf = capability.historicalPerformance || {};
  if (typeof perf.winRate === "number") {
    return clamp(perf.winRate, 0.2, 0.95);
  }
  return MATURITY_SCORE[capability.maturity] || 0.6;
}

function scoreRisk(capability = {}) {
  const difficulty = capability.executionDifficulty || 5;
  return clamp(1 - difficulty / 10, 0.2, 0.9);
}

export function analyzeFit(problemContext, candidate, constraintResults, targetProblems) {
  const capability = candidate.capability;
  const weights = getCategoryWeights(capability.category);

  const dimensions = {
    problemTypeAlignment: scoreOverlap(candidate.matchedProblems, targetProblems),
    industryFit: candidate.hintMatch ? 0.9 : 0.7,
    locationFit: scoreLocation(constraintResults),
    scaleFit: capability.scalability?.surgeMultiplier ? 0.8 : 0.65,
    timingFit: scoreTiming(constraintResults, capability, problemContext.urgency),
    equipmentMatch: (capability.requiredEquipment || []).length ? 0.85 : 0.9,
    certificationMatch: (capability.requiredCertifications || []).length ? 0.85 : 0.9,
    historicalSuccess: scoreHistorical(capability),
    capacity: scoreCapacity(capability),
    riskInverse: scoreRisk(capability),
    urgencyAlignment: scoreTiming(constraintResults, capability, problemContext.urgency),
    confidencePropagation: clamp(problemContext.confidence, 0.4, 1),
  };

  let weighted = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    weighted += (dimensions[key] ?? 0) * weight;
    weightTotal += weight;
  }

  const rawFit = weightTotal ? weighted / weightTotal : 0;
  const penalty = constraintPenaltyFactor(constraintResults);
  const problemConfidenceCap = clamp(problemContext.confidence || 0.5, 0.5, 1);
  let fitScore = clamp(rawFit * penalty * problemConfidenceCap, 0, 1);

  fitScore = applySemanticCalibration(problemContext.category, capability.id, fitScore);
  if (isCommerciallyIrrelevant(problemContext.category, capability)) {
    fitScore = Math.min(fitScore, 0.35);
  }

  return {
    fitScore: Number(fitScore.toFixed(4)),
    dimensionBreakdown: Object.fromEntries(
      Object.entries(dimensions).map(([key, value]) => [key, Number(value.toFixed(4))]),
    ),
    weights,
    rawFit: Number(rawFit.toFixed(4)),
    penaltyFactor: Number(penalty.toFixed(4)),
  };
}

export function compareCapabilities(a, b) {
  if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;

  const aWin = a.capability.historicalPerformance?.winRate || 0;
  const bWin = b.capability.historicalPerformance?.winRate || 0;
  if (bWin !== aWin) return bWin - aWin;

  const maturityOrder = { scaled: 3, proven: 2, experimental: 1, legacy: 0 };
  const aMaturity = maturityOrder[a.capability.maturity] || 0;
  const bMaturity = maturityOrder[b.capability.maturity] || 0;
  if (bMaturity !== aMaturity) return bMaturity - aMaturity;

  return String(a.capability.id).localeCompare(String(b.capability.id));
}

export function buildDifferentiation(selected = []) {
  if (selected.length < 2) return [];

  const records = [];
  for (let i = 0; i < selected.length; i += 1) {
    for (let j = i + 1; j < selected.length; j += 1) {
      const a = selected[i];
      const b = selected[j];
      const stronger = a.fitScore >= b.fitScore ? a : b;
      const weaker = stronger === a ? b : a;
      records.push({
        capabilityA: stronger.capability.id,
        capabilityB: weaker.capability.id,
        whyStronger: `${stronger.capability.name} ranks higher on fit (${stronger.fitScore} vs ${weaker.fitScore})`,
        evidence: stronger.selectionReasons,
        whenPreferOther: `${weaker.capability.name} may be preferable when ${weaker.capability.category} scope is primary`,
      });
    }
  }
  return records;
}
