import { join } from "node:path";
import { access, readFile } from "node:fs/promises";
import { DATA_DIR } from "../storage.js";
import { cleanText, isSocialOnlyWebsite } from "../stage1/shared.js";
import { hasRealWebsiteUrl } from "../enrich.js";
import { resolveIndustryRules, fillTemplate } from "../sales-brief/industry-rules.js";
import {
  EMERGENCY_QUESTION,
  FIRST_DEFLECTION_RESPONSES,
  OPENING_LINES,
} from "../sales-brief/outreach-copy.js";
import {
  CONFIDENCE_MANUAL_REVIEW_THRESHOLD,
  FOLDER_BY_KEY,
  folderLabel,
  PRIORITY_LABELS,
} from "./categories.js";

const RESTAURANT_INDUSTRIES = /restaurant|food|cafe|coffee|pizza|bbq|bar|grill|bakery|diner|taco|sushi/i;
const APPOINTMENT_INDUSTRIES = /hvac|plumb|electric|dental|salon|spa|medical|clinic|chiro|law|account|insurance|roof|pool|landscap|tree|pest|clean/i;
const EMERGENCY_INDUSTRIES = /hvac|plumb|electric|tree|lock|tow|garage door|pest|roof/i;
const SEASONAL_INDUSTRIES = /pool|landscap|roof|tree|pressure wash|christmas|holiday|lawn|snow|hvac/i;

const OFFER_BY_FOLDER = {
  no_website: "Build a simple owned website that turns Google searches into calls — not just a listing.",
  weak_conversion:
    "Fix the conversion path so visitors instantly understand what you do and how to call or request service.",
  google_traffic_poor_capture:
    "Turn existing Google visibility into captured calls and form leads instead of lost visitors.",
  ranking_opportunity:
    "Add service and location pages so you rank for the jobs you actually want to win.",
  menu_ordering:
    "Give customers a clear menu and ordering path you control — not only third-party apps.",
  booking_appointment:
    "Make booking or requesting service obvious on mobile in under 10 seconds.",
  trust_review:
    "Show reviews, licenses, and proof on your site so new customers trust you before they call.",
  service_page:
    "Break services into clear pages so customers know exactly what you offer and why to choose you.",
  local_landing:
    "Create local landing pages for each city or service area you want to grow.",
  emergency_service:
    "Make emergency service impossible to miss — phone, hours, and response promise above the fold.",
  seasonal_campaign:
    "Launch a seasonal campaign page that captures demand before peak season hits.",
  outdated_design:
    "Refresh credibility online so the site matches the quality of your real-world work.",
  social_media_only:
    "Move from rented social traffic to an owned site you control for trust and lead capture.",
  unknown: "Review manually and lead with discovery: how are you getting new business today?",
};

function slugify(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function loadScreenshotFlags(businessName) {
  const slug = slugify(businessName);
  const folder = join(DATA_DIR, "website-screenshots", slug);
  const businessPath = join(folder, "business.json");
  if (!(await fileExists(businessPath))) return null;
  try {
    const business = JSON.parse(await readFile(businessPath, "utf8"));
    return business.screenshotsCaptured ?? null;
  } catch {
    return null;
  }
}

function inferSignalsFromReasons(reasons, websiteScore) {
  const text = (reasons ?? []).join(" ").toLowerCase();
  return {
    missingCTA: /call to action|cta|no clear call/.test(text),
    noBookingForm: /contact form|booking|schedule|appointment/.test(text),
    noMobileFriendlySignal: /mobile/.test(text),
    weakHomepageCopy: /copy|homepage|thin/.test(text),
    lowTrustSignals: /trust|review|testimonial|license/.test(text),
    noBeforeAfterGallery: /gallery|photo|proof/.test(text),
    noServiceAreaPage: /service pages|service-area|location page/.test(text),
    noReviewsTestimonialsShown: /review|testimonial|trust/.test(text),
    noGoogleBusinessProfileWebsiteLink: false,
  };
}

function buildSignals(record, qualityEntry, screenshots) {
  const websiteUrl = cleanText(record.websiteUrl);
  const hasWebsite = hasRealWebsiteUrl(websiteUrl);
  const socialOnly = hasWebsite && isSocialOnlyWebsite(websiteUrl);
  const reasons = record.websiteScoreReasons ?? qualityEntry?.reasons ?? [];
  const storedSignals = qualityEntry?.signals ?? inferSignalsFromReasons(reasons, record.websiteScore);
  const score = record.websiteScore ?? qualityEntry?.websiteScore ?? null;
  const industry = cleanText(record.industry || record.category);
  const enrichment = record.enrichment ?? {};

  const missingPages = [];
  if (screenshots) {
    if (!screenshots.about) missingPages.push("about");
    if (!screenshots.services) missingPages.push("services");
    if (!screenshots.contact) missingPages.push("contact");
    if (!screenshots.gallery) missingPages.push("gallery");
  }

  return {
    hasWebsite,
    socialOnly,
    websiteUrl,
    websiteStatus: record.websiteStatus,
    websiteScore: score,
    reasons,
    signals: storedSignals,
    opportunitySignals: storedSignals,
    city: cleanText(record.city),
    missingPages,
    industry,
    googleRating: Number(record.googleRating) || 0,
    googleReviewCount: Number(record.googleReviewCount) || 0,
    googleMapsUrl: cleanText(record.googleMapsUrl),
    hasPhone: Boolean(record.phone || record.normalizedPhone),
    hasEmail: Boolean(record.email),
    facebookUrl: cleanText(record.facebookUrl || enrichment.facebookUrl),
    instagramUrl: cleanText(record.instagramUrl || enrichment.instagramUrl),
    isRestaurant: RESTAURANT_INDUSTRIES.test(industry),
    isAppointmentBased: APPOINTMENT_INDUSTRIES.test(industry),
    isEmergencyService: EMERGENCY_INDUSTRIES.test(industry),
    isSeasonal: SEASONAL_INDUSTRIES.test(industry),
    qualificationStatus: record.qualificationStatus,
    outreachStatus: record.outreachStatus ?? "not_contacted",
    previewUrl: cleanText(record.previewUrl),
    opportunityProjectId: cleanText(record.opportunityProjectId),
  };
}

function scoreCategory(key, ctx) {
  const opp = ctx.opportunitySignals ?? {};
  const reasons = ctx.reasons ?? [];
  let score = 0;
  let problem = "";
  let angle = "";
  let reason = "";

  switch (key) {
    case "no_website":
      if (!ctx.hasWebsite) {
        score = 95;
        problem = "No owned website on Google profile";
        angle = "Get found and trusted when customers search for you";
        reason = "Business has no website URL — searches may dead-end on Google or social.";
      } else if (ctx.websiteUrl === "[EXISTS]") {
        score = 80;
        problem = "Website listed but URL unknown";
        angle = "Clarify online presence and capture leads";
        reason = "Google shows a website exists but no URL is available to evaluate.";
      }
      break;

    case "social_media_only":
      if (ctx.socialOnly) {
        score = 92;
        problem = "No owned website — social or link-in-bio only";
        angle = "Own your customer journey instead of renting attention on social";
        reason = "Website URL points to Facebook, Instagram, Linktree, or similar.";
      } else if (!ctx.hasWebsite && (ctx.facebookUrl || ctx.instagramUrl)) {
        score = 85;
        problem = "Social presence without owned website";
        angle = "Turn social followers into captured leads on a site you control";
        reason = "Social profiles exist but there is no owned website.";
      }
      break;

    case "weak_conversion":
      if (ctx.hasWebsite && !ctx.socialOnly) {
        const weakCta = opp.missingCTA || reasons.some((r) => /call to action|cta/i.test(r));
        const weakCopy = opp.weakHomepageCopy;
        const noForm = reasons.some((r) => /contact form/i.test(r)) || opp.noBookingForm;
        const lowScore = ctx.websiteScore != null && ctx.websiteScore < 70;
        if (weakCta || weakCopy || noForm || lowScore) {
          score = 60 + (weakCta ? 15 : 0) + (noForm ? 10 : 0) + (lowScore ? 10 : 0);
          problem = "Website exists but conversion path is weak";
          angle = "Turn site visitors into calls and quote requests";
          reason = [
            weakCta && "No clear call-to-action",
            noForm && "No contact or lead form detected",
            weakCopy && "Homepage copy is thin or unclear",
            lowScore && `Website quality score is ${ctx.websiteScore}/100`,
          ]
            .filter(Boolean)
            .join("; ");
        }
      }
      break;

    case "google_traffic_poor_capture":
      if (
        ctx.hasWebsite &&
        (ctx.googleReviewCount >= 10 || ctx.googleRating >= 4) &&
        ctx.websiteScore != null &&
        ctx.websiteScore < 75
      ) {
        score = 70 + Math.min(20, Math.floor(ctx.googleReviewCount / 5));
        problem = "Strong Google presence but website may not capture leads";
        angle = "Convert existing search visibility into booked jobs";
        reason = `${ctx.googleReviewCount} Google reviews at ${ctx.googleRating} stars, but site score is ${ctx.websiteScore}/100.`;
      }
      break;

    case "ranking_opportunity":
      if (ctx.hasWebsite && (opp.noServiceAreaPage || ctx.missingPages.includes("services"))) {
        score = 65 + (ctx.googleMapsUrl ? 10 : 0);
        problem = "Local visibility without dedicated service/location pages";
        angle = "Rank for the services and cities you want to win";
        reason = "Missing service pages or service-area content for local SEO.";
      }
      break;

    case "local_landing":
      if (ctx.hasWebsite && opp.noServiceAreaPage && cleanText(ctx.city)) {
        score = 58;
        problem = "No local landing page for service area";
        angle = "Win nearby searches with city-specific pages";
        reason = `No clear service-area page detected for ${cleanText(ctx.city)}.`;
      }
      break;

    case "menu_ordering":
      if (ctx.isRestaurant && (!ctx.hasWebsite || ctx.websiteScore < 65 || ctx.missingPages.length >= 2)) {
        score = 75;
        problem = "Restaurant without strong menu or ordering flow";
        angle = "Make menu and ordering easy on mobile";
        reason = ctx.hasWebsite
          ? "Restaurant site lacks clear menu/ordering structure."
          : "Restaurant has no owned website for menu and orders.";
      }
      break;

    case "booking_appointment":
      if (ctx.isAppointmentBased && ctx.hasWebsite && opp.noBookingForm) {
        score = 68;
        problem = "Appointment-based business without clear booking path";
        angle = "Let customers book or request service in seconds";
        reason = "No booking, scheduling, or appointment request flow detected.";
      }
      break;

    case "trust_review":
      if (
        ctx.hasWebsite &&
        (opp.lowTrustSignals || opp.noReviewsTestimonialsShown) &&
        ctx.googleReviewCount >= 5
      ) {
        score = 62 + Math.min(15, Math.floor(ctx.googleReviewCount / 3));
        problem = "Reviews on Google but weak trust proof on website";
        angle = "Show why customers trust you before they call";
        reason = `${ctx.googleReviewCount} Google reviews not leveraged with on-site trust proof.`;
      }
      break;

    case "service_page":
      if (
        ctx.hasWebsite &&
        (ctx.missingPages.includes("services") || reasons.some((r) => /service pages/i.test(r)))
      ) {
        score = 64;
        problem = "Services not explained on dedicated pages";
        angle = "Help customers understand exactly what you offer";
        reason = "Missing or generic service pages.";
      }
      break;

    case "emergency_service":
      if (ctx.isEmergencyService && ctx.hasWebsite && opp.missingCTA) {
        score = 66;
        problem = "Emergency service not clearly captured online";
        angle = "Make urgent callers choose you first";
        reason = "Emergency-capable trade but no obvious urgent call path on site.";
      }
      break;

    case "seasonal_campaign":
      if (
        ctx.isSeasonal &&
        ctx.hasWebsite &&
        ctx.websiteScore != null &&
        ctx.websiteScore >= 50 &&
        ctx.websiteScore < 80
      ) {
        score = 55;
        problem = "Seasonal demand not captured with a focused campaign";
        angle = "Capture peak-season searches before competitors do";
        reason = `Seasonal ${ctx.industry} business could use a timely campaign page.`;
      }
      break;

    case "outdated_design":
      if (ctx.hasWebsite && ctx.websiteScore != null && ctx.websiteScore < 55) {
        score = 50 + (70 - ctx.websiteScore);
        problem = "Outdated or low-credibility website design";
        angle = "Look as professional online as you do on the job";
        reason = reasons.join("; ") || `Low website quality score (${ctx.websiteScore}/100).`;
      }
      if (/sites\.google\.com|wix\.com|weebly|godaddy\.com\/websites/i.test(ctx.websiteUrl)) {
        score = Math.max(score, 58);
        problem = problem || "Template/builder site hurting credibility";
        angle = angle || "Upgrade from generic builder look to local trust";
        reason = reason || "Site appears to use a dated template or free builder.";
      }
      break;

    default:
      break;
  }

  return { key, score, problem, angle, reason };
}

function computeConfidence(best, second, ctx) {
  let confidence = Math.min(100, Math.max(35, best.score));
  if (second && best.score - second.score < 8) confidence -= 12;
  else if (second && best.score - second.score < 15) confidence -= 6;
  if (!ctx.hasPhone && !ctx.hasEmail) confidence -= 10;
  if (ctx.websiteStatus === "unknown") confidence -= 12;
  if (!best.reason) confidence -= 20;
  if (best.score >= 80 && best.reason) confidence = Math.max(confidence, 72);
  return Math.max(1, Math.min(100, Math.round(confidence)));
}

function computePriorityScore(confidence, ctx, folderKey) {
  let score = 0;
  if (ctx.hasPhone) score += 18;
  if (ctx.hasEmail) score += 8;
  if (ctx.qualificationStatus === "qualified") score += 12;
  if (ctx.googleReviewCount >= 10) score += 8;
  score += Math.round(confidence * 0.35);
  if (["no_website", "weak_conversion", "google_traffic_poor_capture", "social_media_only"].includes(folderKey)) {
    score += 12;
  }
  if (folderKey === "unknown") score = Math.min(score, 40);
  return Math.max(0, Math.min(100, score));
}

function priorityLabel(priorityScore, confidence, folderKey) {
  if (folderKey === "unknown" || confidence < CONFIDENCE_MANUAL_REVIEW_THRESHOLD) {
    return PRIORITY_LABELS[3];
  }
  if (priorityScore >= 75) return PRIORITY_LABELS[0];
  if (priorityScore >= 55) return PRIORITY_LABELS[1];
  return PRIORITY_LABELS[2];
}

function nextAction(folderKey, ctx) {
  if (folderKey === "unknown") return "Manual review — open full analysis and confirm problem before calling.";
  if (!ctx.hasPhone) return "Find phone number, then call with discovery opener.";
  if (ctx.previewUrl || ctx.opportunityProjectId) return "Call using opening line, then send preview after discovery.";
  return "Call using suggested opening — ask how they get customers before mentioning website.";
}

export function analyzeBusinessAngle(record, options = {}) {
  const qualityEntry = options.qualityEntry ?? null;
  const screenshots = options.screenshots ?? null;
  const ctx = buildSignals(record, qualityEntry, screenshots);

  const categoryKeys = Object.keys(FOLDER_BY_KEY).filter((k) => k !== "unknown");
  const ranked = categoryKeys
    .map((key) => scoreCategory(key, ctx))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  let best = ranked[0] ?? {
    key: "unknown",
    score: 30,
    problem: "Insufficient data to classify automatically",
    angle: "Lead with discovery about customer acquisition",
    reason: "Not enough website or profile signals to assign a strong angle.",
  };
  const second = ranked[1] ?? null;

  let confidence = computeConfidence(best, second, ctx);
  let folderKey = best.key;

  if (confidence < CONFIDENCE_MANUAL_REVIEW_THRESHOLD) {
    folderKey = "unknown";
  }

  const rules = resolveIndustryRules(ctx.industry);
  const templateCtx = {
    city: record.city || "",
    businessName: record.businessName || "",
    industry: ctx.industry,
  };

  const recommendedOffer = OFFER_BY_FOLDER[folderKey] ?? OFFER_BY_FOLDER.unknown;
  const priorityScore = computePriorityScore(confidence, ctx, folderKey);

  return {
    businessId: record.id,
    business_name: record.businessName,
    industry: ctx.industry,
    city: record.city,
    phone: record.phone || record.normalizedPhone || "",
    website_url: ctx.websiteUrl || "",
    google_profile_url: ctx.googleMapsUrl,
    current_status: ctx.outreachStatus,
    detected_problem: best.problem,
    primary_angle: best.angle,
    recommended_offer: recommendedOffer,
    reason_for_angle: best.reason,
    confidence_score: confidence,
    folder: folderKey,
    folder_label: folderLabel(folderKey),
    suggested_opening_line: OPENING_LINES.preferred,
    suggested_offer_line: fillTemplate(recommendedOffer, templateCtx),
    suggested_follow_up: FIRST_DEFLECTION_RESPONSES[0],
    suggested_deflection_response: FIRST_DEFLECTION_RESPONSES[0],
    emergency_question: EMERGENCY_QUESTION,
    next_action: nextAction(folderKey, ctx),
    priority_score: priorityScore,
    priority_label: priorityLabel(priorityScore, confidence, folderKey),
    business_growth_angle: fillTemplate(rules.businessGrowthAngle, templateCtx),
    golden_question: fillTemplate(rules.goldenQuestion, templateCtx),
    alternate_folders: ranked.slice(1, 4).map((r) => ({
      folder: r.key,
      label: folderLabel(r.key),
      score: r.score,
    })),
    signal_summary: {
      websiteStatus: ctx.websiteStatus,
      websiteScore: ctx.websiteScore,
      googleReviewCount: ctx.googleReviewCount,
      googleRating: ctx.googleRating,
      missingPages: ctx.missingPages,
      hasPhone: ctx.hasPhone,
      hasEmail: ctx.hasEmail,
    },
    analyzedAt: new Date().toISOString(),
  };
}

export async function analyzeBusinessRecord(record, options = {}) {
  const screenshots =
    options.screenshots ?? (options.loadScreenshots !== false ? await loadScreenshotFlags(record.businessName) : null);

  let qualityEntry = options.qualityEntry ?? null;
  if (!qualityEntry && options.qualityScoresMap) {
    qualityEntry = options.qualityScoresMap.get(record.id) ?? null;
  }

  if (!qualityEntry?.signals && hasRealWebsiteUrl(record.websiteUrl) && options.fetchLive) {
    const { scoreWebsiteQuality } = await import("../stage1/website-quality-score.js");
    const scored = await scoreWebsiteQuality({
      websiteUrl: record.websiteUrl,
      businessName: record.businessName,
      phone: record.phone,
    });
    qualityEntry = {
      websiteScore: scored.websiteScore,
      reasons: scored.websiteScoreReasons,
      signals: scored.signals,
    };
  }

  if (!qualityEntry?.signals && record.websiteScoreReasons?.length) {
    qualityEntry = {
      websiteScore: record.websiteScore,
      reasons: record.websiteScoreReasons,
      signals: inferSignalsFromReasons(record.websiteScoreReasons, record.websiteScore),
    };
  }

  return analyzeBusinessAngle(record, { qualityEntry, screenshots });
}
