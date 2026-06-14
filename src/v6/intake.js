import { randomUUID } from "node:crypto";
import { cleanText } from "./shared.js";

const CATEGORY_PROFILES = [
  { match: /plumb/i, label: "Plumbing" },
  { match: /tree|stump/i, label: "Tree Service" },
  { match: /pressure wash|power wash/i, label: "Pressure Washing" },
  { match: /roof/i, label: "Roofing" },
  { match: /hvac|heating|cooling/i, label: "HVAC" },
  { match: /landscap|lawn/i, label: "Landscaping" },
  { match: /electric/i, label: "Electrical" },
  { match: /clean/i, label: "Cleaning" },
  { match: /pest|exterminat/i, label: "Pest Control" },
  { match: /paint/i, label: "Painting" },
];

function inferCategory(text) {
  const source = cleanText(text);
  const profile = CATEGORY_PROFILES.find((entry) => entry.match.test(source));
  return profile?.label ?? "Local Service";
}

function parsePlaceFromGoogleMapsUrl(url) {
  const decoded = decodeURIComponent(cleanText(url));
  const placeMatch = decoded.match(/\/maps\/place\/([^/@?]+)/i);
  if (!placeMatch) return {};

  const placeText = placeMatch[1].replace(/\+/g, " ").trim();
  const cityMatch = placeText.match(/,\s*([^,]+?)(?:,\s*[A-Z]{2})?$/);
  return {
    placeName: placeText,
    city: cityMatch?.[1]?.trim() ?? "",
  };
}

function normalizeWebsiteUrl(url) {
  const trimmed = cleanText(url);
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Normalize manual V6 intake into a stable working shape.
 */
export function normalizeV6Intake(input = {}, packageId = randomUUID()) {
  const businessName = cleanText(input.businessName);
  if (!businessName) {
    throw new Error("businessName is required");
  }

  const mapsHints = parsePlaceFromGoogleMapsUrl(input.googleMapsUrl);
  const category =
    cleanText(input.category) ||
    inferCategory(`${businessName} ${mapsHints.placeName ?? ""}`);
  const city = cleanText(input.city) || mapsHints.city || "Local Area";

  return {
    packageId,
    businessName,
    websiteUrl: normalizeWebsiteUrl(input.websiteUrl),
    googleMapsUrl: cleanText(input.googleMapsUrl),
    category,
    city,
    phone: cleanText(input.phone),
    googleReviewCount: Number(input.googleReviewCount) || 0,
    googleRating: Number(input.googleRating) || 0,
    industry: cleanText(input.industry),
    state: cleanText(input.state).toUpperCase(),
    address: cleanText(input.address),
    websiteStatus: cleanText(input.websiteStatus),
    websiteScore: Number(input.websiteScore) || 0,
    websiteScoreReasons: Array.isArray(input.websiteScoreReasons) ? input.websiteScoreReasons : [],
    qualificationReason: cleanText(input.qualificationReason),
    contactMethodCategory: cleanText(input.contactMethodCategory),
    notes: cleanText(input.notes),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build a lead-shaped object for existing engines without persisting to leads.json.
 */
export function buildWorkingLead(intake) {
  const lead = {
    id: intake.packageId,
    businessName: intake.businessName,
    category: intake.category,
    city: intake.city,
    phone: intake.phone,
    websiteUrl: intake.websiteUrl,
    googleReviewCount: intake.googleReviewCount,
    googleRating: intake.googleRating,
    industry: intake.industry,
    state: intake.state,
    address: intake.address,
    websiteStatus: intake.websiteStatus,
    websiteScore: intake.websiteScore,
    websiteScoreReasons: intake.websiteScoreReasons,
    qualificationReason: intake.qualificationReason,
    contactMethodCategory: intake.contactMethodCategory,
    notes: intake.notes,
    weakWebsite: false,
    socialEvidence: false,
    strongProof: false,
    websiteQuality: null,
    createdAt: intake.createdAt,
    updatedAt: new Date().toISOString(),
  };

  return {
    ...lead,
    serviceBusiness: true,
    score: 0,
    scoreBreakdown: [],
    status: "TARGET",
  };
}
