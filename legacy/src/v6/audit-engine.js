import { cleanText, nowIso } from "./shared.js";

const AUDIT_RULES = [
  {
    signal: "missingCTA",
    category: "missing_cta",
    title: "Missing obvious call-to-action",
    severity: "high",
    revenueImpact:
      "Mobile visitors may leave without calling or requesting a quote, directly reducing booked jobs.",
    recommendedFix:
      "Add a sticky click-to-call button and a primary hero CTA above the fold on every key page.",
  },
  {
    signal: "noBookingForm",
    category: "missing_form",
    title: "No quote or booking form",
    severity: "high",
    revenueImpact:
      "After-hours and research-stage prospects cannot self-qualify, so leads leak to competitors.",
    recommendedFix:
      "Add a short quote form with name, phone, service needed, and preferred callback time.",
  },
  {
    signal: "noMobileFriendlySignal",
    category: "missing_mobile",
    title: "Mobile viewport signal missing",
    severity: "high",
    revenueImpact:
      "Most local service searches happen on phones; poor mobile UX suppresses call volume.",
    recommendedFix:
      "Ship a responsive layout with large tap targets and click-to-call in the header.",
  },
  {
    signal: "lowTrustSignals",
    category: "missing_trust",
    title: "Low trust signal density",
    severity: "medium",
    revenueImpact:
      "Prospects hesitate to call when licensing, insurance, and guarantees are not visible.",
    recommendedFix:
      "Add a trust bar with licensed/insured badges, years in business, and guarantee language.",
  },
  {
    signal: "noReviewsTestimonialsShown",
    category: "missing_social_proof",
    title: "Reviews not showcased on site",
    severity: "medium",
    revenueImpact:
      "Strong Google reputation is wasted if the website does not surface social proof.",
    recommendedFix:
      "Embed a reviews strip with star rating, count, and 2–3 recent testimonial snippets.",
  },
  {
    signal: "noServiceAreaPage",
    category: "missing_local_seo",
    title: "No service-area content",
    severity: "medium",
    revenueImpact:
      "Local SEO coverage is weaker, so map and 'near me' searches go to better-optimized competitors.",
    recommendedFix:
      "Publish service-area pages or a coverage section naming the primary cities and neighborhoods served.",
  },
  {
    signal: "noBeforeAfterGallery",
    category: "missing_service_pages",
    title: "No project gallery or proof of work",
    severity: "medium",
    revenueImpact:
      "Visual proof increases quote requests for trades and exterior services.",
    recommendedFix:
      "Add a gallery or before/after section tied to core services.",
  },
  {
    signal: "weakHomepageCopy",
    category: "missing_service_pages",
    title: "Thin homepage copy",
    severity: "low",
    revenueImpact:
      "Visitors may not understand the full service range, reducing cross-sell and quote quality.",
    recommendedFix:
      "Expand homepage copy with service cards, process steps, and local keywords.",
  },
  {
    signal: "noGoogleBusinessProfileWebsiteLink",
    category: "missing_local_seo",
    title: "No website linked from Google Business Profile",
    severity: "high",
    revenueImpact:
      "Map pack traffic has nowhere credible to land, so calls and form fills are lost.",
    recommendedFix:
      "Launch a conversion-focused site and link it from the Google Business Profile.",
  },
];

const SEVERITY_WEIGHT = { high: 3, medium: 2, low: 1 };

function severityScore(findings) {
  const raw = findings.reduce((sum, finding) => sum + (SEVERITY_WEIGHT[finding.severity] ?? 1), 0);
  return Math.min(100, Math.round((raw / 18) * 100));
}

/**
 * Turn enrichment signals into a revenue leak audit report.
 */
export function buildRevenueLeakAudit(research) {
  const signals = research.onlinePresence?.opportunitySignals ?? {};
  const findings = [];

  for (const rule of AUDIT_RULES) {
    if (!signals[rule.signal]) continue;
    findings.push({
      id: rule.category,
      category: rule.category,
      title: rule.title,
      severity: rule.severity,
      revenueImpact: rule.revenueImpact,
      recommendedFix: rule.recommendedFix,
      signal: rule.signal,
    });
  }

  if (!findings.length && !research.onlinePresence?.hasWebsite) {
    findings.push({
      id: "no_website",
      category: "missing_trust",
      title: "No business website detected",
      severity: "high",
      revenueImpact:
        "Searchers who compare options online may choose a competitor with a credible web presence.",
      recommendedFix:
        "Launch a mobile-first website with services, reviews, contact, and quote form.",
      signal: "noWebsite",
    });
  }

  const score = severityScore(findings);
  const businessName = cleanText(research.business.name);

  return {
    version: 1,
    generatedAt: nowIso(),
    businessName,
    severityScore: score,
    severityLabel: score >= 70 ? "critical" : score >= 40 ? "moderate" : "low",
    findings,
    executiveSummary: findings.length
      ? `${businessName} has ${findings.length} revenue leak${findings.length === 1 ? "" : "s"} affecting calls, trust, and local visibility.`
      : `${businessName} shows a relatively strong baseline with smaller optimization opportunities.`,
    topPriorities: findings
      .slice()
      .sort((a, b) => (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0))
      .slice(0, 3)
      .map((finding) => finding.recommendedFix),
  };
}
