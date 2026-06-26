import { generateOpportunities } from "../opportunities/index.js";
import { analyzeMarketFromDatabase } from "../market-analysis/index.js";
import { rankMarkets } from "../markets/index.js";

export async function buildOpportunityRadar() {

  const markets = await rankMarkets();
  const opportunities = await generateOpportunities();

  const analyses = [];

  for (const market of markets) {
    analyses.push(await analyzeMarketFromDatabase(market));
  }

  const enriched = opportunities.map(opportunity => {

    const analysis =
      analyses.find(a => a.marketId === opportunity.marketId);

    const databaseScore =
      Math.min((analysis?.businessesFound || 0),100);

    const opportunityScore =
      Math.round(
        opportunity.priority * .35 +
        databaseScore * .35 +
        (analysis?.contactCoverage || 0) * .30
      );

    return {

      ...opportunity,

      businessesFound:
        analysis?.businessesFound || 0,

      reachableBusinesses:
        analysis?.reachableByPhone || 0,

      contactCoverage:
        analysis?.contactCoverage || 0,

      databaseConfidence:
        analysis?.databaseConfidence,

      opportunityScore

    };

  });

  enriched.sort(
    (a,b)=>b.opportunityScore-a.opportunityScore
  );

  return enriched;

}
