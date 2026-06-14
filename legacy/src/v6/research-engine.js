import { enrichLead } from "../enrich.js";
import { generateBrief } from "../brief.js";
import { cleanText, nowIso } from "./shared.js";

function buildServiceArea(lead, brief) {
  const city = cleanText(lead.city) || "the local area";
  return {
    primaryCity: city,
    coverageDescription: `Residential and commercial ${brief.category || "service"} coverage in ${city} and nearby neighborhoods.`,
    suggestedPages: [
      `${city} ${brief.category || "Services"}`,
      "Service Area Map",
      "Neighborhood Coverage",
    ],
  };
}

function buildContactBlock(lead) {
  return {
    phone: cleanText(lead.phone) || null,
    websiteUrl: cleanText(lead.websiteUrl) || null,
    googleMapsUrl: cleanText(lead.googleMapsUrl) || null,
    preferredCta: lead.phone ? "Call for a free estimate" : "Request a quote online",
  };
}

/**
 * Collect structured business research from manual intake + website enrichment.
 */
export async function buildResearchReport(lead, intake) {
  const { fields: enriched } = await enrichLead(lead);
  const mergedLead = { ...lead, ...enriched };
  const brief = generateBrief(mergedLead);

  const reviews = {
    googleRating: Number(mergedLead.googleRating) || null,
    googleReviewCount: Number(mergedLead.googleReviewCount) || 0,
    strongProof: Boolean(mergedLead.strongProof),
    onSiteTestimonials: !enriched.opportunitySignals?.noReviewsTestimonialsShown,
  };

  const trustSignals = [
    ...(brief.trustPoints ?? []),
    mergedLead.socialEvidence ? "Social profiles linked or discoverable" : null,
    mergedLead.websiteQuality === "strong" ? "Website shows baseline trust cues" : null,
    mergedLead.websiteQuality === "weak" ? "Website trust presentation needs improvement" : null,
  ].filter(Boolean);

  return {
    version: 1,
    generatedAt: nowIso(),
    business: {
      name: mergedLead.businessName,
      category: mergedLead.category,
      city: mergedLead.city,
      serviceBusiness: Boolean(mergedLead.serviceBusiness),
      websiteQuality: mergedLead.websiteQuality ?? "unknown",
      weakWebsite: Boolean(mergedLead.weakWebsite),
    },
    services: brief.servicesToHighlight ?? [],
    reviews,
    serviceArea: buildServiceArea(mergedLead, brief),
    uniqueSellingPoints: [
      `${mergedLead.businessName} focuses on ${brief.category || "local service"} in ${mergedLead.city || "the area"}.`,
      ...(brief.trustPoints ?? []).slice(0, 3),
    ],
    trustSignals,
    contact: buildContactBlock({ ...mergedLead, googleMapsUrl: intake.googleMapsUrl }),
    onlinePresence: {
      hasWebsite: Boolean(cleanText(mergedLead.websiteUrl)),
      opportunitySignals: enriched.opportunitySignals ?? {},
      socialEvidence: Boolean(mergedLead.socialEvidence),
      outreachAngle: mergedLead.outreachAngle,
    },
    narrativeSummary: [
      `${mergedLead.businessName} is a ${mergedLead.category || "local service"} business serving ${mergedLead.city || "the local market"}.`,
      reviews.googleReviewCount
        ? `They show ${reviews.googleReviewCount} Google reviews${reviews.googleRating ? ` at ${reviews.googleRating} stars` : ""}.`
        : "Public review volume appears limited or not provided.",
      mergedLead.weakWebsite || !cleanText(mergedLead.websiteUrl)
        ? "The online presence has clear room to convert more search traffic into calls and quote requests."
        : "The website has a foundation to build on, with conversion and trust opportunities still available.",
    ].join(" "),
    sources: [
      intake.websiteUrl ? "business_website" : null,
      intake.googleMapsUrl ? "google_maps_url" : null,
      "manual_intake",
      enriched.enriched ? "website_enrichment" : null,
    ].filter(Boolean),
    enrichedLead: mergedLead,
  };
}
