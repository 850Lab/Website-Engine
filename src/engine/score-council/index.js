const CONFIDENCE_LABEL_SCORE = {
  High: 90,
  Medium: 70,
  Low: 45,
  None: 10,
};

const CEO_MODES = {
  cash_flow: {
    revenue: 0.15,
    profit: 0.1,
    execution: 0.15,
    risk: 0.05,
    relationship: 0.05,
    competition: 0.05,
    timing: 0.15,
    confidence: 0.1,
    recurring: 0.05,
    strategicValue: 0.05,
    probability: 0.05,
    speed: 0.15,
  },
  enterprise: {
    revenue: 0.2,
    profit: 0.1,
    execution: 0.1,
    risk: 0.08,
    relationship: 0.15,
    competition: 0.05,
    timing: 0.05,
    confidence: 0.1,
    recurring: 0.05,
    strategicValue: 0.17,
    probability: 0.05,
    speed: 0.0,
  },
  recurring: {
    revenue: 0.1,
    profit: 0.15,
    execution: 0.1,
    risk: 0.05,
    relationship: 0.15,
    competition: 0.05,
    timing: 0.05,
    confidence: 0.1,
    recurring: 0.2,
    strategicValue: 0.05,
    probability: 0.05,
    speed: 0.05,
  },
  fastest_win: {
    revenue: 0.05,
    profit: 0.05,
    execution: 0.15,
    risk: 0.05,
    relationship: 0.1,
    competition: 0.1,
    timing: 0.1,
    confidence: 0.1,
    recurring: 0.05,
    strategicValue: 0.05,
    probability: 0.2,
    speed: 0.15,
  },
  five_million_plus: {
    revenue: 0.25,
    profit: 0.1,
    execution: 0.08,
    risk: 0.12,
    relationship: 0.1,
    competition: 0.05,
    timing: 0.05,
    confidence: 0.15,
    recurring: 0.05,
    strategicValue: 0.15,
    probability: 0.05,
    speed: 0.0,
  },
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function money(value) {
  return Number(value || 0);
}

function normalizeConfidenceLabel(value) {
  const text = String(value || "None");
  if (text.startsWith("High")) return "High";
  if (text.startsWith("Medium")) return "Medium";
  if (text.startsWith("Low")) return "Low";
  return "None";
}

function logRevenueScore(value) {
  const amount = money(value);
  if (amount <= 0) return 0;
  return clamp(Math.log10(amount + 1) * 18);
}

function result(score, confidence, evidence = [], assumptions = []) {
  return {
    score: clamp(score),
    confidence: clamp(confidence),
    evidence,
    assumptions,
  };
}

function scoreRevenue(opportunity) {
  const revenue = money(opportunity.estimatedRevenuePotential);
  const contract = money(opportunity.estimatedContractValue);
  const score = logRevenueScore(revenue || contract);
  const confidence = revenue > 0 ? 75 : 40;
  return result(
    score,
    confidence,
    [
      `Estimated revenue potential: $${revenue.toLocaleString()}`,
      `Estimated contract value: $${contract.toLocaleString()}`,
    ],
    revenue > 0 ? [] : ["Revenue potential is directional or missing"],
  );
}

function scoreProfit(opportunity) {
  const contract = money(opportunity.estimatedContractValue);
  const marginGuess =
    opportunity.offerId === "offer_ktm_manpower" ? 0.28 : opportunity.offerId === "offer_website_growth" ? 0.55 : 0.45;
  const score = clamp(logRevenueScore(contract * marginGuess));
  return result(
    score,
    contract > 0 ? 60 : 35,
    [`Contract value basis: $${contract.toLocaleString()}`, `Assumed margin profile: ${Math.round(marginGuess * 100)}%`],
    ["Margin profile inferred from offer type until capability economics are attached"],
  );
}

function scoreExecution(opportunity) {
  const difficulty = Number(opportunity.executionDifficulty);
  const base = Number.isNaN(difficulty) ? 50 : clamp(100 - difficulty * 10);
  const coverageBoost = clamp((opportunity.contactCoverage || 0) * 0.2);
  return result(
    clamp(base + coverageBoost * 0.3),
    Number.isNaN(difficulty) ? 40 : 70,
    [
      `Execution difficulty: ${Number.isNaN(difficulty) ? "unknown" : difficulty}/10`,
      `Contact coverage: ${opportunity.contactCoverage || 0}%`,
    ],
    [],
  );
}

function scoreRisk(opportunity) {
  const difficulty = Number(opportunity.executionDifficulty) || 5;
  const institutional = opportunity.offerId === "offer_ktm_manpower" ? 15 : 0;
  const riskPenalty = difficulty * 8 + institutional;
  return result(
    clamp(100 - riskPenalty),
    65,
    [
      `Execution difficulty contributes to risk: ${difficulty}/10`,
      institutional ? "Institutional buyer mix increases access risk" : "Buyer mix is primarily commercial/local",
    ],
    ["Risk score is inverse exposure (higher is better / lower risk)"],
  );
}

function scoreRelationship(opportunity) {
  const reachable = opportunity.reachableBusinesses || 0;
  const coverage = opportunity.contactCoverage || 0;
  const score = clamp(reachable * 1.2 + coverage * 0.4);
  return result(
    score,
    reachable > 0 ? 70 : 30,
    [`Reachable businesses: ${reachable}`, `Contact coverage: ${coverage}%`],
    reachable > 0 ? [] : ["No reachable contacts reduces relationship leverage"],
  );
}

function scoreCompetition(opportunity) {
  const crowdedIndustry =
    ["Restaurants", "Pressure Washing", "Roofing"].includes(opportunity.industry || opportunity.market) ? 15 : 0;
  const marketLibrary = opportunity.source === "market-library" ? 10 : 0;
  return result(
    clamp(85 - crowdedIndustry - marketLibrary),
    55,
    [
      `Industry/market: ${opportunity.industry || opportunity.market || "unknown"}`,
      `Source: ${opportunity.source || "unknown"}`,
    ],
    ["Competition score is inverse intensity (higher is better)"],
  );
}

function scoreTiming(opportunity) {
  const coverage = opportunity.contactCoverage || 0;
  const reachable = opportunity.reachableBusinesses || 0;
  const channelBoost = (opportunity.channels || []).includes("Phone") ? 10 : 0;
  return result(
    clamp(coverage * 0.5 + Math.min(reachable, 40) + channelBoost),
    60,
    [`Channels: ${(opportunity.channels || []).join(", ") || "none"}`, `Reachable businesses: ${reachable}`],
    [],
  );
}

function scoreConfidence(opportunity) {
  const label = normalizeConfidenceLabel(opportunity.databaseConfidence);
  const score = CONFIDENCE_LABEL_SCORE[label] ?? 10;
  return result(
    score,
    score,
    [`Database confidence: ${label}`, `Businesses found: ${opportunity.businessesFound || 0}`],
    label === "None" ? ["Insufficient database evidence"] : [],
  );
}

function scoreRecurring(opportunity) {
  const kpis = (opportunity.kpis || []).join(" ").toLowerCase();
  const recurringHints = /repeat|recurring|monthly|contract|retention/.test(kpis);
  const offerBoost = opportunity.offerId === "offer_pressure_washing" ? 20 : 0;
  const score = clamp((recurringHints ? 70 : 35) + offerBoost);
  return result(
    score,
    recurringHints ? 65 : 40,
    [`KPI keywords scanned: ${(opportunity.kpis || []).join(", ") || "none"}`],
    recurringHints ? [] : ["Recurring potential inferred weakly from KPIs"],
  );
}

function scoreStrategicValue(opportunity) {
  const revenue = money(opportunity.estimatedRevenuePotential);
  const ktm = opportunity.offerId === "offer_ktm_manpower" ? 20 : 0;
  const marketBacked = String(opportunity.confidence || "").includes("database supported") ? 10 : 0;
  return result(
    clamp(logRevenueScore(revenue) * 0.7 + ktm + marketBacked),
    60,
    [`Offer: ${opportunity.offer || opportunity.offerId || "unknown"}`, `Confidence note: ${opportunity.confidence || "n/a"}`],
    [],
  );
}

function scoreProbability(opportunity) {
  const fit = opportunity.offerFitScore || 50;
  const coverage = opportunity.contactCoverage || 0;
  const reachable = opportunity.reachableBusinesses || 0;
  return result(
    clamp(fit * 0.6 + coverage * 0.25 + Math.min(reachable, 20) * 0.5),
    55,
    [
      `Offer fit score: ${fit}`,
      `Contact coverage: ${coverage}%`,
      `Reachable businesses: ${reachable}`,
    ],
    ["Probability is pre-learning directional estimate"],
  );
}

function scoreSpeed(opportunity) {
  const channels = opportunity.channels || [];
  let channelScore = 40;
  if (channels.includes("Phone") || channels.includes("Text")) channelScore = 75;
  if (channels.includes("Visit")) channelScore = Math.max(channelScore, 55);
  if (channels.includes("Email")) channelScore = Math.max(channelScore, 50);
  const reachableBoost = Math.min(opportunity.reachableBusinesses || 0, 30);
  return result(
    clamp(channelScore + reachableBoost * 0.5),
    65,
    [`Primary channels: ${channels.join(", ") || "none"}`, `Reachable businesses: ${opportunity.reachableBusinesses || 0}`],
    [],
  );
}

const ENGINE_FNS = {
  revenue: scoreRevenue,
  profit: scoreProfit,
  execution: scoreExecution,
  risk: scoreRisk,
  relationship: scoreRelationship,
  competition: scoreCompetition,
  timing: scoreTiming,
  confidence: scoreConfidence,
  recurring: scoreRecurring,
  strategicValue: scoreStrategicValue,
  probability: scoreProbability,
  speed: scoreSpeed,
};

function flattenEvidence(scores) {
  return Object.entries(scores).flatMap(([engine, row]) =>
    row.evidence.map((line) => `${engine}: ${line}`),
  );
}

function flattenAssumptions(scores) {
  return [...new Set(Object.values(scores).flatMap((row) => row.assumptions))];
}

function buildScoreVector(scores) {
  return Object.fromEntries(Object.entries(scores).map(([key, row]) => [key, row.score]));
}

export function scoreOpportunity(opportunity, mode = "cash_flow") {
  const weights = CEO_MODES[mode] || CEO_MODES.cash_flow;
  const scores = Object.fromEntries(
    Object.entries(ENGINE_FNS).map(([name, fn]) => [name, fn(opportunity)]),
  );

  const compositeScore = clamp(
    Object.entries(weights).reduce((sum, [engine, weight]) => sum + (scores[engine]?.score || 0) * weight, 0),
  );

  return {
    mode,
    compositeScore,
    scores,
    scoreVector: buildScoreVector(scores),
    evidence: flattenEvidence(scores),
    assumptions: flattenAssumptions(scores),
  };
}

export { CEO_MODES };
