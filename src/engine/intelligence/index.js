import { generateOpportunities } from "../opportunities/index.js";
import { analyzeMarketFromDatabase } from "../market-analysis/index.js";
import { rankMarkets } from "../markets/index.js";

const CONFIDENCE_SCORE = {
  High: 100,
  Medium: 75,
  Low: 45,
  None: 0,
};

function money(value) {
  return Number(value || 0);
}

function normalizeConfidence(value) {
  const text = String(value || "None");
  if (text.startsWith("High")) return "High";
  if (text.startsWith("Medium")) return "Medium";
  if (text.startsWith("Low")) return "Low";
  return "None";
}

function revenueScore(value) {
  const amount = money(value);
  if (amount <= 0) return 0;
  return Math.min(100, Math.round(Math.log10(amount + 1) * 18));
}

function difficultyScore(difficulty) {
  const level = Number(difficulty);
  if (Number.isNaN(level)) return 50;
  return Math.max(0, Math.min(100, 100 - level * 10));
}

export function buildRecommendedNextAction(opportunity) {
  const channel = opportunity.channels?.[0] || "Phone";
  const action =
    channel === "Email" ? "Email" : channel === "Visit" ? "Visit" : channel === "Text" ? "Text" : "Call";
  const target = opportunity.industry || opportunity.market || "target market";
  const reachable = opportunity.reachableBusinesses || 0;
  const offer = opportunity.offer || "selected offer";

  if (reachable > 0) {
    return `${action} ${reachable} reachable ${target} businesses for ${offer}.`;
  }

  return `Validate ${target} demand and enrich contacts before outreach for ${offer}.`;
}

function enrichFromAnalysis(opportunity, analysis) {
  if (!analysis) return opportunity;
  if (opportunity.source === "industry-discovery" && opportunity.businessesFound > 0) {
    return opportunity;
  }

  const reachableBusinesses = Math.max(
    analysis.reachableByPhone || 0,
    analysis.reachableByEmail || 0,
  );

  return {
    ...opportunity,
    businessesFound: analysis.businessesFound,
    contactsFound: analysis.contactsFound,
    reachableByPhone: analysis.reachableByPhone,
    reachableByEmail: analysis.reachableByEmail,
    reachableBusinesses,
    contactCoverage: analysis.contactCoverage || 0,
    databaseConfidence: normalizeConfidence(analysis.databaseConfidence),
  };
}

function scoreOpportunity(opportunity) {
  const confidence = normalizeConfidence(opportunity.databaseConfidence);
  const opportunityScore = Math.round(
    revenueScore(opportunity.estimatedRevenuePotential) * 0.28 +
      Math.min(100, opportunity.contactCoverage || 0) * 0.18 +
      Math.min(100, (opportunity.reachableBusinesses || 0) * 1.5) * 0.2 +
      (CONFIDENCE_SCORE[confidence] ?? 0) * 0.14 +
      (opportunity.offerFitScore || 0) * 0.12 +
      difficultyScore(opportunity.executionDifficulty) * 0.08,
  );

  return {
    ...opportunity,
    databaseConfidence: confidence,
    opportunityScore,
    recommendedNextAction: buildRecommendedNextAction(opportunity),
  };
}

export async function buildOpportunityRadar() {
  const [markets, opportunities] = await Promise.all([rankMarkets(), generateOpportunities()]);

  const analyses = await Promise.all(markets.map((market) => analyzeMarketFromDatabase(market)));
  const analysisByMarketId = Object.fromEntries(analyses.map((row) => [row.marketId, row]));

  const enriched = opportunities.map((opportunity) => {
    const analysis = opportunity.marketId ? analysisByMarketId[opportunity.marketId] : null;
    const merged = enrichFromAnalysis(opportunity, analysis);
    return scoreOpportunity(merged);
  });

  enriched.sort(
    (a, b) =>
      b.opportunityScore - a.opportunityScore ||
      b.estimatedRevenuePotential - a.estimatedRevenuePotential ||
      b.reachableBusinesses - a.reachableBusinesses,
  );

  return enriched;
}
