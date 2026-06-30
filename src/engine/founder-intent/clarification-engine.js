import { createEmptyMission } from "./mission-schema.js";

const CLARIFICATION_TEMPLATES = Object.freeze({
  revenueTarget: {
    field: "revenueTarget",
    question: "What revenue goal should this mission optimize for (amount and period)?",
    required: true,
  },
  geography: {
    field: "geography",
    question: "What geography should this mission focus on (city, state, and radius in miles)?",
    required: true,
  },
  buyerTypes: {
    field: "buyerTypes",
    question: "Who are the priority buyer types or decision makers?",
    required: false,
  },
  offers: {
    field: "offers",
    question: "Which offer or service line should this mission prioritize?",
    required: true,
  },
  deadline: {
    field: "deadline",
    question: "What deadline or timeframe should this mission target?",
    required: false,
  },
  constraints: {
    field: "constraints",
    question: "What constraints should the system respect (equipment, team size, budget, channels to avoid)?",
    required: false,
  },
  preferredChannels: {
    field: "preferredChannels",
    question: "Which outreach channels are preferred (email, phone, visit, text)?",
    required: false,
  },
});

function hasGeography(draft) {
  return Array.isArray(draft.geography) && draft.geography.length > 0 && draft.geography[0]?.label;
}

function hasRevenueTarget(draft) {
  return draft.revenueTarget?.amount > 0 && isNonEmptyString(draft.revenueTarget?.period);
}

function hasOffers(draft) {
  return Array.isArray(draft.offers) && draft.offers.length > 0;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function analyzeMissionCompleteness(draft = {}) {
  const missingFields = [];
  const questions = [];

  if (!hasGeography(draft)) {
    missingFields.push("geography");
    questions.push(CLARIFICATION_TEMPLATES.geography);
  }
  if (!hasOffers(draft)) {
    missingFields.push("offers");
    questions.push(CLARIFICATION_TEMPLATES.offers);
  }
  if (!hasRevenueTarget(draft)) {
    missingFields.push("revenueTarget");
    questions.push(CLARIFICATION_TEMPLATES.revenueTarget);
  }
  if (!Array.isArray(draft.buyerTypes) || draft.buyerTypes.length === 0) {
    missingFields.push("buyerTypes");
    questions.push(CLARIFICATION_TEMPLATES.buyerTypes);
  }
  if (!draft.deadline) {
    missingFields.push("deadline");
    questions.push(CLARIFICATION_TEMPLATES.deadline);
  }
  if (!Array.isArray(draft.constraints) || draft.constraints.length === 0) {
    missingFields.push("constraints");
    questions.push(CLARIFICATION_TEMPLATES.constraints);
  }
  if (!Array.isArray(draft.preferredChannels) || draft.preferredChannels.length === 0) {
    missingFields.push("preferredChannels");
    questions.push(CLARIFICATION_TEMPLATES.preferredChannels);
  }

  const requiredMissing = questions.filter((row) => row.required);
  return {
    complete: requiredMissing.length === 0,
    missingFields,
    questions,
  };
}

function parseMoney(text) {
  const match = String(text).match(/\$?\s*([\d,]+(?:\.\d+)?)\s*(?:\/\s*(month|mo|monthly|week|year))?/i);
  if (!match) return null;
  return {
    amount: Number(match[1].replace(/,/g, "")),
    period: (match[2] || "month").toLowerCase().replace("mo", "month"),
    currency: "USD",
  };
}

function parseRadiusMiles(text) {
  const match = String(text).match(/(\d+)\s*(?:mile|miles|mi)\b/i);
  return match ? Number(match[1]) : null;
}

function parseCityState(text) {
  const beaumont = /beaumont/i.test(text);
  const houston = /houston/i.test(text);
  const texas = /\b(texas|tx)\b/i.test(text);
  if (beaumont) {
    return { label: "Beaumont, TX", city: "Beaumont", state: "TX", country: "US" };
  }
  if (houston) {
    return { label: "Houston, TX", city: "Houston", state: "TX", country: "US" };
  }
  if (texas) {
    return { label: "Texas", state: "TX", country: "US" };
  }
  return null;
}

export function applyClarificationAnswers(draft, answers = {}) {
  const next = createEmptyMission({ ...draft });
  const answerText = Object.values(answers).join("\n");

  if (answers.geography || answers.radius || answers.location) {
    const geoText = [answers.geography, answers.location, answers.radius, answerText].filter(Boolean).join(" ");
    const parsed = parseCityState(geoText) || { label: String(answers.geography || answers.location || "Founder specified geography") };
    const radiusMiles = parseRadiusMiles(geoText) || parseRadiusMiles(answers.radius) || null;
    next.geography = [{ ...parsed, ...(radiusMiles ? { radiusMiles } : {}) }];
  }

  if (answers.revenueTarget || answers.revenue) {
    next.revenueTarget = parseMoney(answers.revenueTarget || answers.revenue || answerText) || next.revenueTarget;
  }

  if (answers.deadline || answers.timeframe) {
    next.deadline = answers.deadline || answers.timeframe;
  }

  if (answers.buyerTypes) {
    next.buyerTypes = Array.isArray(answers.buyerTypes)
      ? answers.buyerTypes
      : String(answers.buyerTypes)
          .split(/[,;]+/)
          .map((row) => row.trim())
          .filter(Boolean);
  }

  if (answers.offers) {
    next.offers = Array.isArray(answers.offers) ? answers.offers : [answers.offers];
  }

  if (answers.constraints) {
    next.constraints = Array.isArray(answers.constraints)
      ? answers.constraints
      : String(answers.constraints)
          .split(/[,;]+/)
          .map((row) => row.trim())
          .filter(Boolean);
  }

  if (answers.preferredChannels || answers.channels) {
    const raw = answers.preferredChannels || answers.channels;
    next.preferredChannels = Array.isArray(raw)
      ? raw
      : String(raw)
          .split(/[,;]+/)
          .map((row) => row.trim())
          .filter(Boolean);
  }

  if (answers.residentialCommercial) {
    next.constraints = [...(next.constraints || []), `Buyer scope: ${answers.residentialCommercial}`];
  }

  if (answers.equipment) {
    next.constraints = [...(next.constraints || []), `Equipment: ${answers.equipment}`];
  }

  next.clarificationHistory = [
    ...(next.clarificationHistory || []),
    { answeredAt: new Date().toISOString(), answers },
  ];

  return next;
}

export function buildClarificationPrompt(draft, analysis = null) {
  const result = analysis || analyzeMissionCompleteness(draft);
  return {
    status: result.complete ? "ready" : "clarify",
    intro: "I can help with that. A few questions before I create the mission:",
    questions: result.questions.map((row) => row.question),
    missingFields: result.missingFields,
  };
}
