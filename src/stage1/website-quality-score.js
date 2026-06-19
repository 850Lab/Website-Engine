import { analyzeWebsiteOpportunitySignals } from "../enrich.js";
import { hasRealWebsiteUrl } from "../enrich.js";
import { cleanText, isSocialOnlyWebsite } from "./shared.js";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

const PERFORMANCE_THRESHOLD = 50;

function normalizeUrl(url) {
  const trimmed = cleanText(url);
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
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

function hasContactForm(html) {
  const source = String(html ?? "");
  return (
    /<form[\s>]/i.test(source) &&
    /\b(contact|quote|estimate|email|message|phone)\b/i.test(source)
  );
}

function hasServicePages(html) {
  const source = String(html ?? "");
  return (
    /\b(services?|our work|what we do)\b/i.test(source) ||
    /href=["'][^"']*\/(services?|service-area|what-we-do)/i.test(source)
  );
}

function hasHttps(url) {
  return /^https:\/\//i.test(normalizeUrl(url));
}

function extractSocialUrls(html, websiteUrl) {
  const urls = new Set();
  const source = String(html ?? "");
  const matches = source.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  for (const match of matches) {
    if (/facebook\.com|instagram\.com|linktr\.ee|tiktok\.com/i.test(match)) {
      urls.add(match.split(/[)"'\s]/)[0]);
    }
  }
  if (isSocialOnlyWebsite(websiteUrl)) {
    urls.add(normalizeUrl(websiteUrl));
  }
  return [...urls];
}

async function fetchPageSpeedScore(url) {
  const apiKey = cleanText(process.env.GOOGLE_PAGESPEED_API_KEY);
  if (!apiKey) return null;
  const target = encodeURIComponent(normalizeUrl(url));
  try {
    const response = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${target}&strategy=mobile&category=performance&key=${apiKey}`,
      { signal: AbortSignal.timeout(25000) }
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const score = payload?.lighthouseResult?.categories?.performance?.score;
    if (typeof score !== "number") return null;
    return Math.round(score * 100);
  } catch {
    return null;
  }
}

function estimatedPerformancePenalty(signals) {
  let penalty = 0;
  if (signals.noMobileFriendlySignal) penalty += 10;
  if (signals.weakHomepageCopy) penalty += 5;
  if (signals.missingCTA) penalty += 5;
  return penalty;
}

/**
 * Score website 0-100 (100 = best). Returns status and qualification hints.
 */
export async function scoreWebsiteQuality({
  websiteUrl,
  businessName = "",
  phone = "",
} = {}) {
  const reasons = [];
  const url = cleanText(websiteUrl);

  if (!url || url === "[EXISTS]") {
    return {
      websiteStatus: url === "[EXISTS]" ? "unknown" : "no_website",
      websiteScore: null,
      websiteScoreReasons: [
        url === "[EXISTS]"
          ? "Google lists a website but the URL was not captured"
          : "No website listed on Google Maps",
      ],
      websiteScoreConfidence: "measured",
      performanceScore: null,
      html: null,
      socialUrls: [],
      signals: analyzeWebsiteOpportunitySignals(""),
    };
  }

  if (isSocialOnlyWebsite(url)) {
    return {
      websiteStatus: "poor_website",
      websiteScore: 30,
      websiteScoreReasons: ["Website is social-media-only (Facebook/Instagram/Linktree)"],
      websiteScoreConfidence: "measured",
      performanceScore: null,
      html: null,
      socialUrls: [normalizeUrl(url)],
      signals: analyzeWebsiteOpportunitySignals(""),
    };
  }

  const html = await fetchHtml(url);
  const signals = analyzeWebsiteOpportunitySignals(html ?? "");
  const socialUrls = extractSocialUrls(html, url);

  if (!html) {
    return {
      websiteStatus: "unknown",
      websiteScore: null,
      websiteScoreReasons: ["Website could not be fetched for scoring"],
      websiteScoreConfidence: "estimated",
      performanceScore: null,
      html: null,
      socialUrls,
      signals,
    };
  }

  let score = 100;
  let confidence = "measured";

  if (!hasHttps(url)) {
    score -= 20;
    reasons.push("No HTTPS");
  }

  if (signals.noMobileFriendlySignal) {
    score -= 20;
    reasons.push("Poor or missing mobile layout signal");
  }

  if (signals.missingCTA) {
    score -= 15;
    reasons.push("No clear call to action");
  }

  if (!hasContactForm(html)) {
    score -= 15;
    reasons.push("No contact form detected");
  }

  if (!hasServicePages(html)) {
    score -= 15;
    reasons.push("No dedicated service pages detected");
  }

  const pageSpeedScore = await fetchPageSpeedScore(url);
  if (pageSpeedScore != null) {
    if (pageSpeedScore < PERFORMANCE_THRESHOLD) {
      score -= 15;
      reasons.push(`Mobile PageSpeed below ${PERFORMANCE_THRESHOLD} (${pageSpeedScore})`);
    }
  } else {
    confidence = "estimated";
    const estimatedPenalty = estimatedPerformancePenalty(signals);
    if (estimatedPenalty > 0) {
      score -= Math.min(15, estimatedPenalty);
      reasons.push("Estimated poor mobile performance (PageSpeed API not configured)");
    }
  }

  score = Math.max(0, Math.min(100, score));

  let websiteStatus = "good_website";
  if (score < 70) websiteStatus = "poor_website";

  return {
    websiteStatus,
    websiteScore: score,
    websiteScoreReasons: reasons.length ? reasons : ["Website meets quality thresholds"],
    websiteScoreConfidence: confidence,
    performanceScore: pageSpeedScore,
    html,
    socialUrls,
    signals,
  };
}

export { fetchHtml, extractSocialUrls, hasContactForm, hasServicePages };
