import { listOffers } from "../offers/index.js";
import { rankMarkets } from "../markets/index.js";

export async function generateOpportunities() {
  const offers = await listOffers();
  const markets = await rankMarkets();

  const opportunities = [];

  for (const offer of offers) {
    for (const market of markets) {

      const matchesBuyer =
        offer.bestBuyers.some((buyer) =>
          market.name.toLowerCase().includes(buyer.toLowerCase())
        ) ||
        offer.bestBuyers.includes(market.name);

      if (!matchesBuyer) continue;

      opportunities.push({
        id: `${offer.id}__${market.id}`,

        offerId: offer.id,
        marketId: market.id,

        offer: offer.name,
        market: market.name,

        promise: offer.promise,
        urgency: offer.urgency,

        buyer: market.name,

        channels: offer.channels,

        kpis: offer.kpis,

        estimatedAnnualRevenue:
          market.estimatedAnnualRevenue,

        estimatedContractValue:
          market.estimatedContractValue,

        priority:
          market.priority,

        confidence:
          market.confidence
      });
    }
  }

  return opportunities.sort(
    (a,b)=>b.priority-a.priority
  );
}
