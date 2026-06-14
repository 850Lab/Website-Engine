import { generatePreviewSiteV3 } from "../preview-v3.js";
import { generateBrief } from "../brief.js";
import { cleanText, nowIso } from "./shared.js";

function buildPages(brief, lead) {
  const city = cleanText(lead.city) || "your area";
  const category = cleanText(lead.category) || "local service";

  return [
    {
      slug: "home",
      title: "Homepage",
      purpose: "Convert search traffic into calls and quote requests.",
      sections: brief.homepageSections ?? [],
      primaryCta: brief.ctaText,
    },
    {
      slug: "about",
      title: "About",
      purpose: "Establish trust with local ownership, experience, and credentials.",
      sections: ["Company story", "Licensed & insured", "Why homeowners choose us", "Service area"],
    },
    {
      slug: "services",
      title: "Services",
      purpose: "Clarify the full service range and capture high-intent visitors.",
      sections: (brief.servicesToHighlight ?? []).map((service) => `${service} detail block`),
    },
    {
      slug: "reviews",
      title: "Reviews",
      purpose: "Surface Google reputation and testimonials.",
      sections: ["Star rating summary", "Featured testimonials", "Review CTA"],
    },
    {
      slug: "contact",
      title: "Contact",
      purpose: "Make it easy to call, email, or request service.",
      sections: ["Phone & hours", "Map / directions", "Quote form", "Emergency availability"],
    },
    {
      slug: "quote",
      title: "Quote Form",
      purpose: "Capture leads after hours and from paid/local search campaigns.",
      sections: ["Short lead form", "Service selector", "Preferred callback time", "Privacy note"],
    },
  ].map((page) => ({
    ...page,
    seoTitle: `${lead.businessName} | ${page.title}`,
    seoDescription: `${lead.businessName} provides ${category} in ${city}. ${page.purpose}`,
  }));
}

function buildLocalSeo(brief, lead) {
  const city = cleanText(lead.city) || "Local Area";
  const category = cleanText(lead.category) || "Local Service";
  return {
    primaryKeyword: `${category} ${city}`,
    secondaryKeywords: (brief.servicesToHighlight ?? [])
      .slice(0, 3)
      .map((service) => `${service} ${city}`),
    schemaRecommendations: ["LocalBusiness", "Service", "FAQPage"],
    locationPages: [`${city} ${category}`, `${city} service area`],
    onPageChecklist: [
      "City + service in title tag and H1",
      "NAP consistency in footer",
      "Embedded map or directions block",
      "Internal links between services and contact",
    ],
  };
}

/**
 * Generate website redesign deliverable using reusable v3 templates.
 */
export async function buildWebsiteRedesign(lead) {
  const brief = generateBrief(lead);
  const preview = await generatePreviewSiteV3(lead);
  const previewUrl = `/previews/${preview.dirName}/index.html`;

  return {
    version: 1,
    generatedAt: nowIso(),
    businessName: lead.businessName,
    templateVersion: "v3",
    previewUrl,
    previewDirName: preview.dirName,
    slug: preview.slug,
    heroHeadline: brief.heroHeadline,
    ctaText: brief.ctaText,
    trustPoints: brief.trustPoints ?? [],
    services: brief.servicesToHighlight ?? [],
    pages: buildPages(brief, lead),
    localSeo: buildLocalSeo(brief, lead),
    redesignSummary: [
      `Rebuilt ${lead.businessName} around clearer mobile CTAs, proof, and service clarity.`,
      `Homepage angle: ${brief.websiteAngle}.`,
      `Primary CTA: ${brief.ctaText}.`,
    ].join(" "),
  };
}
