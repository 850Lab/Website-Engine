import { randomUUID } from "node:crypto";

const BUSINESS_LINE_PATTERNS = Object.freeze([
  {
    id: "pressure_washing",
    patterns: [/pressure\s*wash/i, /exterior clean/i, /sidewalk/i, /entryway/i, /building wash/i],
  },
  {
    id: "ktm_industrial",
    patterns: [/ktm/i, /industrial/i, /maintenance/i, /turnaround/i, /shutdown/i, /refinery/i, /staffing/i],
  },
  {
    id: "apartment_workshops",
    patterns: [/apartment/i, /financial workshop/i, /sponsor/i, /property manager/i, /multi-?family/i],
  },
  {
    id: "website_agency",
    patterns: [/website/i, /web design/i, /lead generation/i, /agency/i],
  },
  {
    id: "government_contracts",
    patterns: [/government/i, /rfp/i, /bid/i, /public sector/i],
  },
  {
    id: "future_saas",
    patterns: [/saas/i, /software/i],
  },
]);

const GOAL_PATTERNS = Object.freeze([
  { id: "replace_job_income", patterns: [/replace my job/i, /quit my job/i, /job income/i] },
  { id: "cash_flow", patterns: [/cash flow/i, /make money/i, /revenue/i, /\$\s*\d/i] },
  { id: "scale_outreach", patterns: [/10,?000 emails/i, /emails?\/month/i, /per offer/i] },
  { id: "prioritize_offer", patterns: [/priority/i, /prioritize/i, /biggest upside/i] },
  { id: "find_opportunities", patterns: [/find/i, /opportunit/i, /win/i, /contracts?/i] },
]);

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function detectGoals(text) {
  return GOAL_PATTERNS.filter((row) => matchesAny(text, row.patterns)).map((row) => row.id);
}

function detectBusinessLines(text) {
  return BUSINESS_LINE_PATTERNS.filter((row) => matchesAny(text, row.patterns)).map((row) => row.id);
}

function detectGeographyConstraints(text) {
  const constraints = [];
  const radius = text.match(/(\d+)\s*(?:mile|miles|mi)\b/i);
  const beaumont = /beaumont/i.test(text);
  const texas = /\b(texas|tx)\b/i.test(text);

  if (radius || beaumont || texas) {
    constraints.push({
      type: "geography_radius",
      value: radius ? Number(radius[1]) : null,
      unit: radius ? "miles" : null,
      anchor: beaumont ? "Beaumont, TX" : texas ? "Texas" : null,
    });
  }

  return constraints;
}

function detectScaleTargets(text) {
  const targets = [];
  const emailMatch = text.match(/([\d,]+)\s*(?:personalized\s*)?emails?\s*\/?\s*(month|mo|monthly)?(?:\s*per\s*offer)?/i);
  if (emailMatch) {
    targets.push({
      type: "email_volume",
      value: Number(emailMatch[1].replace(/,/g, "")),
      period: (emailMatch[2] || "month").replace(/^mo$/i, "month").toLowerCase(),
      scope: /per\s*offer/i.test(text) ? "per_offer" : "global",
    });
  }
  return targets;
}

function detectRevenueTarget(text) {
  const money = text.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*(?:\/\s*(month|mo|monthly|week|year))?/i);
  if (!money) return null;
  return {
    amount: Number(money[1].replace(/,/g, "")),
    currency: "USD",
    period: (money[2] || "month").replace(/^mo$/i, "month").toLowerCase(),
  };
}

function missingFieldsForIntent(intent) {
  const missing = [];
  if (!intent.revenueTarget && intent.detectedGoals.includes("replace_job_income")) {
    missing.push("monthly_income_target");
  }
  if (!intent.constraintsMentioned.some((row) => row.type === "geography_radius")) {
    missing.push("geography");
  }
  if (!intent.businessLinesMentioned.length) {
    missing.push("offer_or_business_line");
  }
  if (intent.scaleTargets.some((row) => row.type === "email_volume")) {
    missing.push("compliance_policy");
    missing.push("approval_policy");
  }
  return [...new Set(missing)];
}

export function createIntentId() {
  return `intent_${randomUUID()}`;
}

export function analyzeFounderIntent(rawText, options = {}) {
  const text = collapseWhitespace(rawText);
  const detectedGoals = detectGoals(text);
  const businessLinesMentioned = detectBusinessLines(text);
  const constraintsMentioned = detectGeographyConstraints(text);
  const scaleTargets = detectScaleTargets(text);
  const revenueTarget = detectRevenueTarget(text);

  const intent = {
    intentId: options.intentId || createIntentId(),
    source: options.source || "founder_chat",
    rawText: text,
    detectedGoals,
    businessLinesMentioned,
    constraintsMentioned,
    scaleTargets,
    revenueTarget,
    missingFields: [],
    confidence: Number(
      Math.min(
        0.95,
        0.35 +
          detectedGoals.length * 0.12 +
          businessLinesMentioned.length * 0.12 +
          constraintsMentioned.length * 0.08 +
          scaleTargets.length * 0.08,
      ).toFixed(2),
    ),
    requiresClarification: false,
    createdAt: new Date().toISOString(),
  };

  intent.missingFields = missingFieldsForIntent(intent);
  intent.requiresClarification = intent.missingFields.length > 0;

  return intent;
}

export function isIntentObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.intentId === "string" &&
      typeof value.rawText === "string" &&
      Array.isArray(value.detectedGoals) &&
      Array.isArray(value.businessLinesMentioned) &&
      Array.isArray(value.missingFields),
  );
}
