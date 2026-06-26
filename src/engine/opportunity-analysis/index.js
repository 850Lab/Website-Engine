import { rankMarkets } from "../markets/index.js";

function scoreMarket(market) {
  let score = 0;

  if (market.estimatedAnnualRevenue >= 5000000) score += 35;
  if (market.estimatedContractValue >= 500000) score += 25;
  if (market.recurring) score += 20;

  score += Math.max(0, 20 - market.difficulty);

  return Math.min(score, 100);
}

export async function analyzeMarkets() {
  const markets = await rankMarkets();

  return markets
    .map((market) => ({
      ...market,
      opportunityScore: scoreMarket(market),
      recommendation:
        market.estimatedAnnualRevenue >= 5000000
          ? "Worth validating"
          : "Lower priority",
    }))
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}

export async function getTopMarketOpportunity() {
  const markets = await analyzeMarkets();
  return markets[0] || null;
}
