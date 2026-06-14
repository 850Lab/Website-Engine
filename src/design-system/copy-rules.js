/**
 * Premium Design System V1 — category copy patterns
 */

import { getThemeByCategory } from "./themes.js";

const COPY_BY_KEY = {
  tree: {
    accentLine: "Count On",
    headlineTemplate: (label) => `Professional ${label} You Can`,
    subTemplate: (label, city) =>
      `Safe. Reliable. Affordable ${label.toLowerCase()} for homes and businesses in ${city}.`,
    heroTrust: ["Licensed & Insured", "Experienced Crew", "Free Estimates"],
    trustSectionTitle: "Local. Reliable. Dedicated to Excellence.",
    servicesTitle: (label) => `Complete ${label} Solutions`,
    servicesBlurb: (cat, city) =>
      `Professional ${cat} for residential and commercial properties in ${city} and surrounding areas.`,
    testimonialQuote: (cat) =>
      `"Professional ${cat} — on time, fair pricing, and quality work from start to finish. Highly recommend."`,
    finalCtaTitle: "Ready to Get Started?",
    finalCtaSub: "Contact us today for a free, no-obligation estimate.",
    phoneSub: "Call for a Free Estimate",
    learnMoreAbout: "Learn More About Us",
    footerAbout: (cat, city) => `Trusted ${cat} serving ${city} and nearby communities.`,
  },
  plumbing: {
    accentLine: "Count On",
    headlineTemplate: (label) => `Professional ${label} You Can`,
    subTemplate: (label, city) =>
      `Safe. Reliable. Affordable ${label.toLowerCase()} for homes and businesses in ${city}.`,
    heroTrust: ["Licensed & Insured", "24/7 Emergency", "Free Estimates"],
    trustSectionTitle: "Local Plumbers You Can Trust.",
    servicesTitle: (label) => `Complete ${label} Solutions`,
    servicesBlurb: (cat, city) =>
      `Professional ${cat} for residential and commercial properties in ${city} and surrounding areas.`,
    testimonialQuote: (cat) =>
      `"Fast response, fair pricing, and quality ${cat.toLowerCase()} work. Highly recommend."`,
    finalCtaTitle: "Ready to Get Started?",
    finalCtaSub: "Contact us today for a free, no-obligation estimate.",
    phoneSub: "Call for a Free Estimate",
    learnMoreAbout: "Learn More About Us",
    footerAbout: (cat, city) => `Trusted ${cat} serving ${city} and nearby communities.`,
  },
  pressure: {
    accentLine: "Count On",
    headlineTemplate: (label) => `Professional ${label} You Can`,
    subTemplate: (label, city) =>
      `Restore curb appeal with expert ${label.toLowerCase()} for homes and businesses in ${city}.`,
    heroTrust: ["Licensed & Insured", "Same-Week Service", "Free Estimates"],
    trustSectionTitle: "Spotless Results. Local Team.",
    servicesTitle: (label) => `Complete ${label} Solutions`,
    servicesBlurb: (cat, city) =>
      `Driveways, siding, decks, and more — serving ${city} and surrounding areas.`,
    testimonialQuote: (cat) =>
      `"Our property looks brand new. Professional ${cat.toLowerCase()} from start to finish."`,
    finalCtaTitle: "Ready to Get Started?",
    finalCtaSub: "Book your free estimate today.",
    phoneSub: "Call for a Free Estimate",
    learnMoreAbout: "Learn More About Us",
    footerAbout: (cat, city) => `Trusted ${cat} serving ${city} and nearby communities.`,
  },
  roofing: {
    accentLine: "Count On",
    headlineTemplate: (label) => `Professional ${label} You Can`,
    subTemplate: (label, city) =>
      `Durable roof protection and repairs for homes and businesses in ${city}.`,
    heroTrust: ["Licensed & Insured", "Storm Damage Help", "Free Estimates"],
    trustSectionTitle: "Roofs Done Right. Local Crew.",
    servicesTitle: (label) => `Complete ${label} Solutions`,
    servicesBlurb: (cat, city) =>
      `Repairs, replacements, and inspections in ${city} and surrounding areas.`,
    testimonialQuote: (cat) =>
      `"Honest assessment, quality work, and a roof we trust. Highly recommend."`,
    finalCtaTitle: "Ready to Get Started?",
    finalCtaSub: "Schedule your free roof inspection today.",
    phoneSub: "Call for a Free Estimate",
    learnMoreAbout: "Learn More About Us",
    footerAbout: (cat, city) => `Trusted ${cat} serving ${city} and nearby communities.`,
  },
  landscaping: {
    accentLine: "Count On",
    headlineTemplate: (label) => `Professional ${label} You Can`,
    subTemplate: (label, city) =>
      `Beautiful lawns and outdoor spaces for homes and businesses in ${city}.`,
    heroTrust: ["Licensed & Insured", "Reliable Schedule", "Free Estimates"],
    trustSectionTitle: "Your Yard. Our Priority.",
    servicesTitle: (label) => `Complete ${label} Solutions`,
    servicesBlurb: (cat, city) =>
      `Lawn care, maintenance, and design in ${city} and surrounding areas.`,
    testimonialQuote: (cat) =>
      `"Our yard has never looked better. Professional ${cat.toLowerCase()} team."`,
    finalCtaTitle: "Ready to Get Started?",
    finalCtaSub: "Contact us today for a free, no-obligation estimate.",
    phoneSub: "Call for a Free Estimate",
    learnMoreAbout: "Learn More About Us",
    footerAbout: (cat, city) => `Trusted ${cat} serving ${city} and nearby communities.`,
  },
  hvac: {
    accentLine: "Count On",
    headlineTemplate: (label) => `Professional ${label} You Can`,
    subTemplate: (label, city) =>
      `Comfort you can count on — heating and cooling for homes and businesses in ${city}.`,
    heroTrust: ["Licensed & Insured", "Fast Response", "Free Estimates"],
    trustSectionTitle: "Comfort Experts. Local Team.",
    servicesTitle: (label) => `Complete ${label} Solutions`,
    servicesBlurb: (cat, city) =>
      `Install, repair, and maintenance in ${city} and surrounding areas.`,
    testimonialQuote: (cat) =>
      `"Quick diagnosis, fair price, and our system runs perfectly. Highly recommend."`,
    finalCtaTitle: "Ready to Get Started?",
    finalCtaSub: "Contact us today for a free, no-obligation estimate.",
    phoneSub: "Call for a Free Estimate",
    learnMoreAbout: "Learn More About Us",
    footerAbout: (cat, city) => `Trusted ${cat} serving ${city} and nearby communities.`,
  },
  generic: {
    accentLine: "Count On",
    headlineTemplate: (label) => `Professional ${label} You Can`,
    subTemplate: (label, city) =>
      `Safe. Reliable. Affordable ${label.toLowerCase()} for homes and businesses in ${city}.`,
    heroTrust: ["Licensed & Insured", "Experienced Team", "Free Estimates"],
    trustSectionTitle: "Local. Reliable. Dedicated to Excellence.",
    servicesTitle: (label) => `Complete ${label} Solutions`,
    servicesBlurb: (cat, city) =>
      `Professional ${cat} for residential and commercial properties in ${city} and surrounding areas.`,
    testimonialQuote: (cat) =>
      `"Professional ${cat} — on time, fair pricing, and quality work from start to finish. Highly recommend."`,
    finalCtaTitle: "Ready to Get Started?",
    finalCtaSub: "Contact us today for a free, no-obligation estimate.",
    phoneSub: "Call for a Free Estimate",
    learnMoreAbout: "Learn More About Us",
    footerAbout: (cat, city) => `Trusted ${cat} serving ${city} and nearby communities.`,
  },
};

export const DEFAULT_TRUST_POINTS = [
  "Fully licensed & insured",
  "Fast local response",
  "Clean, professional work",
  "Trusted by neighbors",
];

export const DEFAULT_SERVICES = [
  "Core residential services",
  "Commercial service options",
  "Emergency availability",
  "Free estimates",
  "Service area coverage",
];

function coalesce(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function cityBadge(city) {
  const cityName = coalesce(city, "your area");
  return cityName.toUpperCase().includes(",")
    ? cityName.split(",")[0].trim().toUpperCase()
    : cityName.toUpperCase();
}

export function getCopyRules(category) {
  const theme = getThemeByCategory(category);
  return COPY_BY_KEY[theme.key] ?? COPY_BY_KEY.generic;
}

/** Hero badge, headline lines, subheadline */
export function buildHeroCopy(category, city) {
  const theme = getThemeByCategory(category);
  const rules = getCopyRules(category);
  const cityName = coalesce(city, "your area");
  const badge = `${cityBadge(city)}'S TRUSTED ${theme.label.toUpperCase()} EXPERTS`;

  return {
    badge,
    line1: rules.headlineTemplate(theme.label),
    line2: rules.accentLine,
    sub: rules.subTemplate(theme.label, cityName),
    heroTrust: rules.heroTrust,
  };
}

export function buildBusinessSpecificHero(brief, fallbackHero) {
  const businessName = coalesce(brief.businessName, "");
  const category = coalesce(brief.category, "Local Service");
  const cityState =
    coalesce(brief.localSpecificity?.cityState, "") ||
    coalesce([brief.city, brief.state].filter(Boolean).join(", "), "");
  const rating = Number(brief.googleRating) || 0;
  const reviews = Number(brief.googleReviewCount) || 0;
  const hasReviewProof = rating > 0 && reviews > 0;
  const score = Number(brief.websiteScore) || 0;
  const weakWebsite = score > 0 && score <= 45;

  const heroLine1 = businessName ? `${businessName} Roofing Website` : fallbackHero.line1;
  const heroLine2 = weakWebsite ? "Built to Win More Calls" : "Built for Local Trust";

  const credibility = hasReviewProof
    ? `Trusted by local customers with ${rating.toFixed(1)} stars from ${reviews}+ Google reviews.`
    : `Built for local homeowners searching for reliable ${category.toLowerCase()} services.`;
  const conversion = weakWebsite
    ? "This version is focused on faster call decisions and clearer service confidence."
    : "This version is focused on clear local trust and faster booking decisions.";
  const location = cityState ? `Serving ${cityState}.` : "";

  return {
    ...fallbackHero,
    badge: cityState ? `${cityState.toUpperCase()} ROOFING` : fallbackHero.badge,
    line1: heroLine1,
    line2: heroLine2,
    sub: `${credibility} ${conversion} ${location}`.trim(),
    heroTrust: hasReviewProof
      ? [
          `${rating.toFixed(1)}★ from ${reviews}+ Google reviews`,
          "Licensed & Insured",
          "Local response team",
        ]
      : fallbackHero.heroTrust,
  };
}

export function getCtaLabels(category, briefCta, phone) {
  const rules = getCopyRules(category);
  const estimate = coalesce(briefCta, "Get a Free Estimate");
  return {
    estimate,
    phoneSub: rules.phoneSub,
    finalTitle: rules.finalCtaTitle,
    finalSub: rules.finalCtaSub,
    primaryPhone: phone ? `Call ${phone}` : estimate,
    callShort: "Call",
    learnMoreAbout: rules.learnMoreAbout,
  };
}

export function serviceDescription(service, category) {
  const svc = String(service ?? "").trim();
  const cat = coalesce(category, "service").toLowerCase();
  if (!svc) return `Professional ${cat} with clear pricing and dependable results.`;
  const short = svc.length > 48 ? `${svc.slice(0, 45)}…` : svc;
  const templates = [
    `${short} with transparent pricing and dependable timelines.`,
    `${short} completed by trained local technicians.`,
    `${short} focused on quality, safety, and clean results.`,
    `${short} with clear communication from estimate to finish.`,
  ];
  const index =
    Array.from(short).reduce((sum, char) => sum + char.charCodeAt(0), 0) % templates.length;
  return templates[index];
}

export function getSectionCopy(category, city) {
  const theme = getThemeByCategory(category);
  const rules = getCopyRules(category);
  const cat = coalesce(category, theme.label);
  const cityName = coalesce(city, "your area");

  return {
    servicesTitle: rules.servicesTitle(theme.label),
    servicesBlurb: rules.servicesBlurb(cat, cityName),
    trustTitle: rules.trustSectionTitle,
    testimonialQuote: rules.testimonialQuote(cat),
    footerAbout: rules.footerAbout(cat, cityName),
  };
}
