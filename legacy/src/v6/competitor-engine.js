import { cleanText, nowIso } from "./shared.js";

function scoreDimension(value) {
  if (value === "strong") return 85;
  if (value === "average") return 60;
  if (value === "weak") return 35;
  return 50;
}

function buildArchetype(name, profile, category, city) {
  return {
    id: profile.id,
    name,
    type: profile.type,
    city,
    category,
    websiteQuality: profile.websiteQuality,
    ctaQuality: profile.ctaQuality,
    reviews: profile.reviews,
    seoOpportunity: profile.seoOpportunity,
    leadGeneration: profile.leadGeneration,
    summary: profile.summary,
  };
}

function compareTargetToCompetitor(target, competitor) {
  const dimensions = [
    {
      key: "websiteQuality",
      label: "Website quality",
      target: target.websiteQuality,
      competitor: competitor.websiteQuality,
      opportunity: scoreDimension(competitor.websiteQuality) - scoreDimension(target.websiteQuality),
    },
    {
      key: "ctaQuality",
      label: "CTA quality",
      target: target.ctaQuality,
      competitor: competitor.ctaQuality,
      opportunity: scoreDimension(competitor.ctaQuality) - scoreDimension(target.ctaQuality),
    },
    {
      key: "reviews",
      label: "Reviews",
      target: target.reviews,
      competitor: competitor.reviews,
      opportunity: scoreDimension(competitor.reviews) - scoreDimension(target.reviews),
    },
    {
      key: "seoOpportunity",
      label: "SEO",
      target: target.seoOpportunity,
      competitor: competitor.seoOpportunity,
      opportunity: scoreDimension(competitor.seoOpportunity) - scoreDimension(target.seoOpportunity),
    },
    {
      key: "leadGeneration",
      label: "Lead generation",
      target: target.leadGeneration,
      competitor: competitor.leadGeneration,
      opportunity: scoreDimension(competitor.leadGeneration) - scoreDimension(target.leadGeneration),
    },
  ];

  return {
    competitorId: competitor.id,
    competitorName: competitor.name,
    dimensions,
    gaps: dimensions.filter((row) => row.opportunity > 10).map((row) => row.label),
    advantages: dimensions.filter((row) => row.opportunity < -10).map((row) => row.label),
  };
}

function targetPosition(research) {
  const signals = research.onlinePresence?.opportunitySignals ?? {};
  const hasWebsite = research.onlinePresence?.hasWebsite;
  const reviewCount = research.reviews?.googleReviewCount ?? 0;

  return {
    websiteQuality: !hasWebsite ? "weak" : research.business.weakWebsite ? "weak" : "average",
    ctaQuality: signals.missingCTA ? "weak" : "average",
    reviews: reviewCount >= 25 ? "strong" : reviewCount >= 10 ? "average" : "weak",
    seoOpportunity: signals.noServiceAreaPage || signals.weakHomepageCopy ? "weak" : "average",
    leadGeneration:
      signals.noBookingForm || signals.missingCTA ? "weak" : hasWebsite ? "average" : "weak",
  };
}

/**
 * Produce a structured competitor landscape without live scraping.
 * Uses category archetypes for comparison framing in manual-entry workflows.
 */
export function buildCompetitorAnalysis(research) {
  const category = cleanText(research.business.category) || "Local Service";
  const city = cleanText(research.business.city) || "Local Area";
  const businessName = cleanText(research.business.name);

  const archetypes = [
    buildArchetype(`Top-rated ${category} in ${city}`, {
      id: "market_leader",
      type: "local_leader",
      websiteQuality: "strong",
      ctaQuality: "strong",
      reviews: "strong",
      seoOpportunity: "strong",
      leadGeneration: "strong",
      summary: "Typically ranks well locally with strong reviews, clear CTAs, and service-area pages.",
    }, category, city),
    buildArchetype(`Established ${category} competitor`, {
      id: "established_local",
      type: "established_local",
      websiteQuality: "average",
      ctaQuality: "average",
      reviews: "average",
      seoOpportunity: "average",
      leadGeneration: "average",
      summary: "Common mid-market competitor with a usable site and moderate review volume.",
    }, category, city),
    buildArchetype(`Budget ${category} option`, {
      id: "budget_option",
      type: "budget",
      websiteQuality: "weak",
      ctaQuality: "weak",
      reviews: "weak",
      seoOpportunity: "weak",
      leadGeneration: "weak",
      summary: "Often competes on price with a thin web presence and limited proof.",
    }, category, city),
  ];

  const target = targetPosition(research);
  const comparisons = archetypes.map((competitor) =>
    compareTargetToCompetitor(target, competitor)
  );

  const priorityGaps = [
    ...new Set(comparisons.flatMap((row) => row.gaps)),
  ].slice(0, 5);

  return {
    version: 1,
    generatedAt: nowIso(),
    businessName,
    category,
    city,
    methodology:
      "Archetype-based competitive framing for manual intake. Replace with live competitor discovery in a later phase.",
    competitors: archetypes,
    targetPosition: target,
    comparisons,
    summary: {
      headline: `${businessName} competitive positioning in ${city}`,
      priorityGaps,
      recommendation:
        priorityGaps.length > 0
          ? `Close the gap on ${priorityGaps.slice(0, 2).join(" and ")} to compete with the local market leader profile.`
          : "Maintain review momentum and sharpen conversion elements to defend local search visibility.",
      winThemes: [
        "Mobile-first calls and quote requests",
        "Visible Google review proof above the fold",
        "Dedicated service and service-area pages for local SEO",
      ],
    },
  };
}
