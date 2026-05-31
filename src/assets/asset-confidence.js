import { getThemeByCategory } from "../design-system/themes.js";

const PHONE_RE =
  /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{4}\b/;

const CATEGORY_KEYWORDS = {
  tree: ["tree", "arbor", "stump", "limb", "brush", "bucket", "chainsaw", "wood"],
  plumbing: ["plumb", "pipe", "drain", "water heater", "faucet", "sewer", "leak"],
  pressure: ["pressure wash", "power wash", "driveway", "siding", "concrete", "deck wash"],
  roofing: ["roof", "shingle", "gutter", "leak repair", "storm damage"],
  landscaping: ["lawn", "landscape", "mow", "hedge", "mulch", "irrigation", "yard"],
  hvac: ["hvac", "heating", "cooling", "furnace", "air condition", "ac unit", "thermostat"],
  generic: ["service", "repair", "install", "residential", "commercial", "licensed"],
};

const SCORE_WEIGHTS = {
  sourceMatch: 35,
  businessName: 25,
  phone: 20,
  category: 10,
  city: 10,
};

export const CONFIDENCE_THRESHOLD = 70;

function htmlToText(html) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function businessNameInText(businessName, text) {
  const words = String(businessName ?? "")
    .toLowerCase()
    .replace(/['']/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) return false;
  const hits = words.filter((w) => text.includes(w));
  return hits.length >= Math.min(2, words.length) || (words.length === 1 && hits.length === 1);
}

function phoneInText(phone, html, text) {
  if (PHONE_RE.test(String(html ?? ""))) return true;
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length >= 7) {
    const tail = digits.slice(-7);
    return text.replace(/\D/g, "").includes(tail);
  }
  return false;
}

function categoryKeywords(category) {
  const key = getThemeByCategory(category).key;
  return CATEGORY_KEYWORDS[key] ?? CATEGORY_KEYWORDS.generic;
}

function sourceMatchesBusiness(lead, pageUrl, sourceKind) {
  const website = String(lead.websiteUrl ?? "").trim();
  if (sourceKind === "website" && website && website !== "[EXISTS]") {
    return normalizeHost(pageUrl) === normalizeHost(website);
  }
  if (sourceKind === "social") {
    return /facebook\.com|fb\.com|instagram\.com/i.test(pageUrl);
  }
  return false;
}

/**
 * Score an image candidate using page context (max 100).
 * @param {object} params
 * @returns {{ score: number, breakdown: Record<string, number> }}
 */
export function scoreImageConfidence({ lead, pageHtml, pageUrl, sourceKind, category }) {
  const text = htmlToText(pageHtml);
  const breakdown = {};

  if (sourceMatchesBusiness(lead, pageUrl, sourceKind)) {
    breakdown.sourceMatch = SCORE_WEIGHTS.sourceMatch;
  }
  if (businessNameInText(lead.businessName, text)) {
    breakdown.businessName = SCORE_WEIGHTS.businessName;
  }
  if (phoneInText(lead.phone, pageHtml, text)) {
    breakdown.phone = SCORE_WEIGHTS.phone;
  }

  const keywords = categoryKeywords(category ?? lead.category);
  if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
    breakdown.category = SCORE_WEIGHTS.category;
  }

  const city = String(lead.city ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (city && city.length > 2 && text.includes(city)) {
    breakdown.city = SCORE_WEIGHTS.city;
  }

  const score = Object.values(breakdown).reduce((sum, n) => sum + n, 0);
  return { score, breakdown };
}

export function meetsConfidenceThreshold(score) {
  return score >= CONFIDENCE_THRESHOLD;
}
