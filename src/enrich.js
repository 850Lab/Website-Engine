const PHONE_RE =
  /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;

const SOCIAL_RE = /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.com|instagram\.com)\/[^\s"'<>]+/i;

const CTA_PATTERNS = [
  /\bcall now\b/i,
  /\bget (?:a )?quote\b/i,
  /\bfree estimate\b/i,
  /\bcontact us\b/i,
  /\bschedule\b/i,
  /\bbook now\b/i,
  /\brequest (?:a )?(?:quote|service|appointment)\b/i,
  /href=["']tel:/i,
  /<button[^>]*>/i,
  /\bclick to call\b/i,
];

const GENERIC_TITLE_PATTERNS = [
  /^home$/i,
  /^welcome$/i,
  /^index$/i,
  /^default$/i,
  /^untitled$/i,
];

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

function hasRealWebsiteUrl(websiteUrl) {
  const url = String(websiteUrl ?? "").trim();
  return Boolean(url) && url !== "[EXISTS]";
}

function normalizeUrl(url) {
  const trimmed = String(url ?? "").trim();
  if (!trimmed || trimmed === "[EXISTS]") return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function fetchHtml(url, timeoutMs = 12000) {
  const target = normalizeUrl(url);
  if (!target) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: FETCH_HEADERS,
    });
    clearTimeout(timer);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

function htmlToText(html) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html) {
  const match = String(html ?? "").match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function pageHasPhone(html, phone) {
  if (PHONE_RE.test(String(html ?? ""))) return true;

  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length >= 7) {
    const tail = digits.slice(-7);
    return String(html ?? "").replace(/\D/g, "").includes(tail);
  }

  return false;
}

function hasObviousCta(html) {
  return CTA_PATTERNS.some((pattern) => pattern.test(String(html ?? "")));
}

function isTitleTooGeneric(title, businessName) {
  const normalizedTitle = String(title ?? "").trim();
  if (!normalizedTitle) return true;
  if (GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(normalizedTitle))) {
    return true;
  }

  const normalizedName = String(businessName ?? "").trim().toLowerCase();
  if (normalizedName && normalizedTitle.toLowerCase() === normalizedName) {
    return true;
  }

  return normalizedTitle.length < 4;
}

function isTextHeavy(html) {
  const words = htmlToText(html).split(/\s+/).filter(Boolean);
  return words.length > 800;
}

function hasMobileViewport(html) {
  return /<meta[^>]+name=["']viewport["'][^>]*>/i.test(String(html ?? ""));
}

function hasSocialLinks(html) {
  return SOCIAL_RE.test(String(html ?? ""));
}

function hasBookingForm(html) {
  return /\b(book|booking|schedule|appointment|request estimate|request service)\b/i.test(
    String(html ?? "")
  );
}

function hasGallery(html) {
  return /\b(gallery|portfolio|before\s*&?\s*after|our work|projects)\b/i.test(String(html ?? ""));
}

function hasTrustSignals(html) {
  return /\b(licensed|insured|certified|guarantee|warranty|locally owned|trusted|years? experience)\b/i.test(
    String(html ?? "")
  );
}

function hasReviewsOrTestimonials(html) {
  return /\b(review|reviews|testimonial|testimonials|stars?|google rating)\b/i.test(String(html ?? ""));
}

function hasServiceAreaPage(html) {
  return /\b(service areas?|areas we serve|locations?|serving)\b/i.test(String(html ?? ""));
}

export function analyzeWebsiteOpportunitySignals(html) {
  const source = String(html ?? "");
  const text = htmlToText(source);
  const hasHtml = Boolean(source.trim());
  return {
    missingCTA: !hasHtml || !hasObviousCta(source),
    noBookingForm: !hasHtml || !hasBookingForm(source),
    noMobileFriendlySignal: !hasHtml || !hasMobileViewport(source),
    lowTrustSignals: !hasHtml || !hasTrustSignals(source),
    weakHomepageCopy: !hasHtml || text.split(/\s+/).filter(Boolean).length < 180,
    noBeforeAfterGallery: !hasHtml || !hasGallery(source),
    noServiceAreaPage: !hasHtml || !hasServiceAreaPage(source),
    noReviewsTestimonialsShown: !hasHtml || !hasReviewsOrTestimonials(source),
    noGoogleBusinessProfileWebsiteLink: false,
  };
}

function assessWebsiteQuality(html, { businessName, phone }) {
  if (!html) return "unknown";

  const weakSignals = {
    noObviousCta: !hasObviousCta(html),
    titleTooGeneric: isTitleTooGeneric(extractTitle(html), businessName),
    noPhoneVisible: !pageHasPhone(html, phone),
    textHeavy: isTextHeavy(html),
    mobileViewportMissing: !hasMobileViewport(html),
  };

  const isWeak = Object.values(weakSignals).some(Boolean);
  return isWeak ? "weak" : "strong";
}

async function searchSocialByBusinessName(businessName, city) {
  const query = encodeURIComponent(
    `"${businessName}" ${city} site:facebook.com OR site:instagram.com`
  );
  const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${query}`, 10000);
  if (!html) return false;

  return SOCIAL_RE.test(html) || /facebook\.com|instagram\.com/i.test(html);
}

async function detectSocialEvidence(fields, websiteHtml) {
  if (websiteHtml && hasSocialLinks(websiteHtml)) {
    return true;
  }

  return searchSocialByBusinessName(fields.businessName, fields.city);
}

function detectStrongProof(fields) {
  const reviewCount = Number(fields.googleReviewCount) || 0;
  const rating = Number(fields.googleRating) || 0;
  return reviewCount >= 15 || rating >= 4.7;
}

/**
 * Enrich discovered lead fields with social, proof, and website quality signals.
 * Does not modify scoring rules — only sets fields consumed by existing scoreLead().
 */
export async function enrichLead(fields) {
  const enriched = {
    ...fields,
    socialEvidence: false,
    strongProof: detectStrongProof(fields),
    weakWebsite: false,
    websiteQuality: "unknown",
  };

  let completed = false;

  if (enriched.strongProof) {
    completed = true;
  }

  const websiteUrl = String(fields.websiteUrl ?? "").trim();
  let websiteHtml = null;

  if (hasRealWebsiteUrl(websiteUrl)) {
    websiteHtml = await fetchHtml(websiteUrl);
    enriched.websiteQuality = assessWebsiteQuality(websiteHtml, fields);
    enriched.weakWebsite = enriched.websiteQuality === "weak";
    enriched.opportunitySignals = analyzeWebsiteOpportunitySignals(websiteHtml);
    completed = true;
  } else if (websiteUrl === "[EXISTS]") {
    enriched.websiteQuality = "unknown";
    enriched.opportunitySignals = analyzeWebsiteOpportunitySignals("");
    completed = true;
  } else {
    enriched.opportunitySignals = analyzeWebsiteOpportunitySignals("");
    enriched.opportunitySignals.noGoogleBusinessProfileWebsiteLink = true;
  }

  try {
    enriched.socialEvidence = await detectSocialEvidence(fields, websiteHtml);
    completed = true;
  } catch {
    // keep socialEvidence false
  }

  return {
    fields: enriched,
    enriched: completed,
  };
}

export {
  assessWebsiteQuality,
  detectSocialEvidence,
  detectStrongProof,
  hasRealWebsiteUrl,
};
