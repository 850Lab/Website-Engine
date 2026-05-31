const PHONE_RE =
  /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const URL_RE = /https?:\/\/\S+|www\.\S+/i;
const REVIEWS_RE = /(\d+)\s+reviews?\b/i;
const RATING_RE = /(\d+(?:\.\d+)?)\s*(?:stars?|★)\b/i;
const RATING_ONLY_RE = /^(\d(?:\.\d)?|5(?:\.0)?)$/;
const NO_WEBSITE_RE = /\bno\s+website\b/i;
const WEBSITE_EXISTS_RE = /\bwebsite\s*[:\-]?\s*exists\b/i;
const WEAK_WEBSITE_RE = /\bweak\s+website\b/i;
const CITY_COMMA_STATE_RE = /^(.+?),\s*([A-Z]{2})\b\s*$/;
const CITY_SPACE_STATE_RE = /^(.+?)\s+([A-Z]{2})$/;

function isStructuredLine(line) {
  return (
    PHONE_RE.test(line) ||
    URL_RE.test(line) ||
    REVIEWS_RE.test(line) ||
    RATING_RE.test(line) ||
    NO_WEBSITE_RE.test(line) ||
    WEBSITE_EXISTS_RE.test(line) ||
    WEAK_WEBSITE_RE.test(line) ||
    RATING_ONLY_RE.test(line)
  );
}

function extractFromLine(line, result) {
  if (NO_WEBSITE_RE.test(line)) {
    // Treat as no website for scoring/outreach.
    result.websiteUrl = null;
    result.weakWebsite = false;
    result.websiteExistsOnly = false;
    return true;
  }
  if (WEBSITE_EXISTS_RE.test(line)) {
    // We only know there is *some* website, not whether it converts.
    result.websiteUrl = "[EXISTS]";
    result.weakWebsite = false;
    result.websiteExistsOnly = true;
    return true;
  }
  if (WEAK_WEBSITE_RE.test(line)) {
    // "Weak website" implies there is a website, so avoid applying "No website" scoring.
    result.websiteUrl = "[EXISTS]";
    result.weakWebsite = true;
    result.websiteExistsOnly = false;
    return true;
  }

  const urlMatch = line.match(URL_RE);
  if (urlMatch) {
    result.websiteUrl = urlMatch[0];
    result.websiteExistsOnly = false;
    return true;
  }

  const phoneMatch = line.match(PHONE_RE);
  if (phoneMatch && line.replace(/\s/g, "").length <= 20) {
    result.phone = phoneMatch[0];
    return true;
  }

  const reviewsMatch = line.match(REVIEWS_RE);
  if (reviewsMatch) {
    result.googleReviewCount = Number(reviewsMatch[1]);
    return true;
  }

  const ratingMatch = line.match(RATING_RE);
  if (ratingMatch) {
    result.googleRating = Number(ratingMatch[1]);
    return true;
  }

  if (RATING_ONLY_RE.test(line)) {
    result.googleRating = Number(line);
    return true;
  }

  return false;
}

function normalizeCity(line) {
  const comma = line.match(CITY_COMMA_STATE_RE);
  if (comma) return `${comma[1].trim()}, ${comma[2]}`;
  const space = line.match(CITY_SPACE_STATE_RE);
  if (space) return `${space[1].trim()}, ${space[2]}`;
  return line;
}

function looksLikeCity(line) {
  return CITY_COMMA_STATE_RE.test(line) || CITY_SPACE_STATE_RE.test(line);
}

/**
 * Parse pasted raw business text into lead fields.
 * Expects loosely ordered blocks: name, category, city, then optional phone/website/reviews/rating lines.
 */
export function parseBusinessText(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("No text to parse.");
  }

  const result = {
    businessName: "",
    category: "",
    city: "",
    phone: "",
    websiteUrl: "",
    googleReviewCount: 0,
    googleRating: 0,
    weakWebsite: false,
    websiteExistsOnly: false,
    notes: "",
  };

  const unstructured = [];

  for (const line of lines) {
    const scratch = { ...result };
    if (extractFromLine(line, scratch)) {
      Object.assign(result, scratch);
    } else {
      unstructured.push(line);
    }
  }

  // Re-run extraction on unstructured in case phone was embedded (rare)
  const leftover = [];
  for (const line of unstructured) {
    const scratch = { ...result };
    if (extractFromLine(line, scratch)) {
      Object.assign(result, scratch);
    } else {
      leftover.push(line);
    }
  }

  if (leftover[0]) result.businessName = leftover[0];
  if (leftover[1]) result.category = leftover[1];

  const cityCandidate = leftover[2];
  if (cityCandidate) {
    result.city = normalizeCity(cityCandidate);
  } else if (leftover.length === 2 && looksLikeCity(leftover[1])) {
    result.city = normalizeCity(leftover[1]);
    result.category = leftover[0];
    result.businessName = "";
  }

  if (!result.businessName) {
    throw new Error("Could not parse business name.");
  }
  if (!result.category) {
    throw new Error("Could not parse category.");
  }
  if (!result.city) {
    throw new Error("Could not parse city.");
  }

  const unconsumed = leftover.slice(3);
  if (unconsumed.length) {
    result.notes = unconsumed.join("; ");
  }

  return result;
}
