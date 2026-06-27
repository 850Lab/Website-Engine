import { generateOpportunities } from "../opportunities/index.js";
import { analyzeMarketFromDatabase } from "../market-analysis/index.js";
import { rankMarkets } from "../markets/index.js";
import { scoreOpportunity as scoreWithCouncil } from "../score-council/index.js";

function normalizeConfidence(value) {
  const text = String(value || "None");
  if (text.startsWith("High")) return "High";
  if (text.startsWith("Medium")) return "Medium";
  if (text.startsWith("Low")) return "Low";
  return "None";
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

function applyScoreCouncil(opportunity, mode) {
  const scoreCouncil = scoreWithCouncil(opportunity, mode);

  return {
    ...opportunity,
    databaseConfidence: normalizeConfidence(opportunity.databaseConfidence),
    scoreCouncil,
    scoreVector: scoreCouncil.scoreVector,
    opportunityScore: scoreCouncil.compositeScore,
    recommendedNextAction: buildRecommendedNextAction(opportunity),
  };
}

export async function buildOpportunityRadar({ mode = "cash_flow" } = {}) {
  const [markets, opportunities] = await Promise.all([rankMarkets(), generateOpportunities()]);

  const analyses = await Promise.all(markets.map((market) => analyzeMarketFromDatabase(market)));
  const analysisByMarketId = Object.fromEntries(analyses.map((row) => [row.marketId, row]));

  const enriched = opportunities.map((opportunity) => {
    const analysis = opportunity.marketId ? analysisByMarketId[opportunity.marketId] : null;
    const merged = enrichFromAnalysis(opportunity, analysis);
    return applyScoreCouncil(merged, mode);
  });

  enriched.sort(
    (a, b) =>
      b.opportunityScore - a.opportunityScore ||
      b.estimatedRevenuePotential - a.estimatedRevenuePotential ||
      b.reachableBusinesses - a.reachableBusinesses,
  );

  return enriched;
}

export { scoreWithCouncil as scoreOpportunity };
