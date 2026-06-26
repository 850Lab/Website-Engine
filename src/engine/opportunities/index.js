import { listOffers } from "../offers/index.js";
import { rankMarkets } from "../markets/index.js";
import { discoverIndustries } from "../industry-discovery/index.js";

const CONSTRUCTION_INDUSTRIES = new Set([
  "roofing",
  "hvac",
  "electrical",
  "concrete",
  "plumbing",
  "construction",
  "fence companies",
  "fencing",
  "landscaping",
  "pool service",
  "tree service",
]);

function slug(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function industryMatchesBuyer(industryName, buyerName) {
  const industry = normalizeText(industryName);
  const buyer = normalizeText(buyerName);
  if (!industry || !buyer) return false;
  if (industry === buyer) return true;
  if (industry.includes(buyer) || buyer.includes(industry)) return true;
  if (buyer === "commercial construction" && CONSTRUCTION_INDUSTRIES.has(industry)) return true;
  if (buyer === "fence companies" && (industry.includes("fence") || industry === "fencing")) {
    return true;
  }
  return false;
}

function findMatchingBuyer(offer, industryName) {
  return offer.bestBuyers.find((buyer) => industryMatchesBuyer(industryName, buyer)) || null;
}

function findMarketForBuyer(markets, buyerName) {
  const buyer = normalizeText(buyerName);
  return (
    markets.find((market) => normalizeText(market.name) === buyer) ||
    markets.find((market) =>
      (market.keywords || []).some((keyword) => buyer.includes(normalizeText(keyword))),
    ) ||
    null
  );
}

function estimateEconomics(offer, profile, market) {
  if (market) {
    const scale = Math.min(1, profile.businessesFound / Math.max(market.keywords?.length ? 25 : 1, 25));
    return {
      estimatedRevenuePotential: Math.round(market.estimatedAnnualRevenue * Math.max(scale, 0.15)),
      estimatedContractValue: market.estimatedContractValue,
      executionDifficulty: market.difficulty ?? 6,
      priority: market.priority ?? 50,
      marketConfidence: market.confidence ?? "Directional",
    };
  }

  const perBusinessAnnual =
    offer.id.includes("ktm") ? 120000 : offer.id.includes("website") ? 15000 : 10000;

  return {
    estimatedRevenuePotential: profile.businessesFound * perBusinessAnnual,
    estimatedContractValue: perBusinessAnnual,
    executionDifficulty: offer.id.includes("ktm") ? 7 : 5,
    priority: Math.min(100, profile.businessesFound + profile.contactCoverage / 2),
    marketConfidence: "Directional - needs validation",
  };
}

function offerFitScore(offer, profile, buyer) {
  let score = 50;
  if (buyer && industryMatchesBuyer(profile.industry, buyer)) score += 30;
  score += Math.min(20, profile.contactCoverage / 5);
  return Math.min(100, Math.round(score));
}

function buildIndustryOpportunity(offer, profile, markets) {
  const buyer = findMatchingBuyer(offer, profile.industry);
  if (!buyer) return null;

  const market = findMarketForBuyer(markets, buyer);
  const economics = estimateEconomics(offer, profile, market);

  return {
    id: `${offer.id}__industry_${slug(profile.industry)}`,
    offerId: offer.id,
    marketId: market?.id ?? null,
    industry: profile.industry,
    market: profile.industry,
    offer: offer.name,
    buyer,
    pain: offer.pain,
    promise: offer.promise,
    urgency: offer.urgency,
    kpis: offer.kpis,
    channels: offer.channels,
    businessesFound: profile.businessesFound,
    contactsFound: profile.contactsFound,
    reachableByPhone: profile.reachableByPhone,
    reachableByEmail: profile.reachableByEmail,
    reachableBusinesses: profile.reachableBusinesses,
    contactCoverage: profile.contactCoverage,
    estimatedRevenuePotential: economics.estimatedRevenuePotential,
    estimatedContractValue: economics.estimatedContractValue,
    estimatedAnnualRevenue: economics.estimatedRevenuePotential,
    databaseConfidence: profile.databaseConfidence,
    executionDifficulty: economics.executionDifficulty,
    priority: economics.priority,
    confidence: economics.marketConfidence,
    offerFitScore: offerFitScore(offer, profile, buyer),
    source: "industry-discovery",
  };
}

function buildMarketOpportunity(offer, market) {
  const matchesBuyer =
    offer.bestBuyers.some((buyer) => industryMatchesBuyer(market.name, buyer)) ||
    offer.bestBuyers.includes(market.name);

  if (!matchesBuyer) return null;

  const buyer =
    offer.bestBuyers.find((candidate) => industryMatchesBuyer(market.name, candidate)) ||
    market.name;

  return {
    id: `${offer.id}__market_${market.id}`,
    offerId: offer.id,
    marketId: market.id,
    industry: market.name,
    market: market.name,
    offer: offer.name,
    buyer,
    pain: offer.pain,
    promise: offer.promise,
    urgency: offer.urgency,
    kpis: offer.kpis,
    channels: offer.channels,
    businessesFound: 0,
    contactsFound: 0,
    reachableByPhone: 0,
    reachableByEmail: 0,
    reachableBusinesses: 0,
    contactCoverage: 0,
    estimatedRevenuePotential: market.estimatedAnnualRevenue,
    estimatedContractValue: market.estimatedContractValue,
    estimatedAnnualRevenue: market.estimatedAnnualRevenue,
    databaseConfidence: "None",
    executionDifficulty: market.difficulty ?? 6,
    priority: market.priority,
    confidence: market.confidence,
    offerFitScore: 80,
    source: "market-library",
  };
}

export async function generateOpportunities() {
  const [offers, markets, industries] = await Promise.all([
    listOffers(),
    rankMarkets(),
    discoverIndustries(),
  ]);

  const byId = new Map();

  for (const offer of offers) {
    for (const profile of industries) {
      const opportunity = buildIndustryOpportunity(offer, profile, markets);
      if (opportunity) byId.set(opportunity.id, opportunity);
    }

    for (const market of markets) {
      const opportunity = buildMarketOpportunity(offer, market);
      if (opportunity) byId.set(opportunity.id, opportunity);
    }
  }

  return [...byId.values()].sort((a, b) => b.priority - a.priority);
}
