import { cleanText } from "../stage1/shared.js";
import { fillTemplate } from "../sales-brief/industry-rules.js";
import { PW_SCRIPTS } from "../pressure-washing/scripts.js";

export const WEBSITE_FENCE_DISCOVERY = [
  "Which fence types drive most of your revenue — wood, vinyl, chain link, or commercial?",
  "Do customers usually call after seeing project photos, or are they mostly price shopping?",
  "What objections come up most when someone requests a fence estimate?",
  "Do most customers find you through Google, referrals, or contractor relationships?",
  "What makes customers choose you instead of another fence company in Beaumont?",
];

export const PW_RESTAURANT_DISCOVERY = [
  "How often do you have the dumpster pad cleaned?",
  "Does grease buildup around the dumpster or back door ever become an issue?",
  "Do customers ever mention the condition of the entrance or sidewalks?",
  "Who normally handles exterior cleaning around the property?",
  "Do you currently have someone maintaining the dumpster pad and back concrete?",
];

function websiteFenceContent(focus, record = {}) {
  const city = cleanText(record.city) || cleanText(focus.city) || "Beaumont";
  const businessName = cleanText(record.businessName) || "your business";
  const ctx = { city, businessName, industry: "fence company" };

  return {
    openingLine:
      "Hey, this is Jaylan with Pivotal Websites. I'm calling fence companies in Beaumont — I put together a quick website preview concept and wanted to see who handles marketing or estimates on your side.",
    primaryAngle:
      "Fence buyers compare price and proof quickly — learn how estimates are won before suggesting any online improvement.",
    problem:
      "Fence companies in Beaumont often lose estimate requests when their website doesn't show project proof or a clear quote path.",
    recommendedOffer: cleanText(focus.offer) || "Website Preview + More Estimate Requests",
    goldenQuestion: fillTemplate(
      "When someone in {city} requests three fence quotes, what helps them pick the company they trust?",
      ctx,
    ),
    discoveryQuestions: WEBSITE_FENCE_DISCOVERY.map((q) => fillTemplate(q, ctx)),
    nextAction: "Call with fence-company discovery — learn how they win estimates before mentioning the preview.",
  };
}

function pwRestaurantContent(focus, lead = {}) {
  const businessName = cleanText(lead.businessName) || "your location";
  const offer = cleanText(focus.offer) || "Dumpster Pad Cleaning";

  return {
    openingLine: PW_SCRIPTS.restaurantOpener.replace(
      "Who usually handles exterior cleaning for your location?",
      `Who usually handles exterior cleaning for ${businessName}?`,
    ),
    offer: `${offer} — free walkthrough + quote for dumpster pad, entrance, and sidewalk cleaning.`,
    pressureWashingAngle:
      "Restaurant exterior in Beaumont — dumpster pad grease buildup, entrance stains, and foot-traffic concrete.",
    goldenQuestion:
      "If you could fix one exterior area customers see first — the entrance, sidewalk, or dumpster pad — which would make the biggest difference?",
    discoveryQuestions: [...PW_RESTAURANT_DISCOVERY],
    likelyNeeds: ["dumpster pad cleaning", "entrance concrete", "grease buildup"],
  };
}

export function isWebsiteFenceFocus(focus = {}) {
  return /fence/i.test(normalizeFocusIndustry(focus.industry));
}

export function isPwRestaurantFocus(focus = {}) {
  const ind = normalizeFocusIndustry(focus.industry);
  return ind === "restaurants" || ind === "restaurant" || /restaurant|food|cafe/.test(ind);
}

function normalizeFocusIndustry(value) {
  return cleanText(value).toLowerCase();
}

export function applyWebsiteFocusToLead(lead, focus) {
  if (!focus || !isWebsiteFenceFocus(focus)) return lead;
  const content = websiteFenceContent(focus, lead);
  return {
    ...lead,
    openingLine: content.openingLine,
    primaryAngle: content.primaryAngle,
    problem: content.problem,
    recommendedOffer: content.recommendedOffer,
    goldenQuestion: content.goldenQuestion,
    discoveryQuestions: content.discoveryQuestions,
    nextAction: content.nextAction,
  };
}

export function applyPwFocusToLead(lead, focus) {
  if (!focus || !isPwRestaurantFocus(focus)) return lead;
  const content = pwRestaurantContent(focus, lead);
  return {
    ...lead,
    openingLine: content.openingLine,
    offer: content.offer,
    pressureWashingAngle: content.pressureWashingAngle,
    goldenQuestion: content.goldenQuestion,
    discoveryQuestions: content.discoveryQuestions,
    likelyNeeds: content.likelyNeeds,
  };
}

export function buildFocusedWebsiteDiscoveryQuestions(focus, record = {}, analysis = null) {
  if (isWebsiteFenceFocus(focus)) {
    return websiteFenceContent(focus, record).discoveryQuestions;
  }
  return null;
}

export function buildFocusedPwDiscoveryQuestions(focus, lead = {}) {
  if (isPwRestaurantFocus(focus)) {
    return pwRestaurantContent(focus, lead).discoveryQuestions;
  }
  return null;
}
