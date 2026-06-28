import { getSituation } from "../situations/index.js";

export const CATEGORY_HYPOTHESIS_TEMPLATES = {
  Expansion: [
    {
      key: "expansion_contractor_demand",
      title: "Industrial contractor demand is increasing",
      description:
        "Expansion activity in {location} indicates rising demand for industrial contractor services.",
      problemCategory: "expansion_contractor_demand",
      assumptions: ["Expansion signals reflect active capital investment"],
      polarity: "positive",
    },
    {
      key: "expansion_delay_risk",
      title: "Expansion may be delayed or cancelled",
      description:
        "Conflicting signals may indicate the expansion in {location} is not proceeding as announced.",
      problemCategory: "expansion_delay_risk",
      assumptions: ["Competing negative signals may emerge"],
      polarity: "negative",
    },
  ],
  Hiring: [
    {
      key: "hiring_staffing_surge",
      title: "Temporary staffing demand is increasing",
      description: "Hiring activity in {location} suggests a staffing surge need.",
      problemCategory: "hiring_staffing_surge",
      assumptions: ["Hiring signals reflect near-term labor demand"],
      polarity: "positive",
    },
    {
      key: "hiring_layoff_risk",
      title: "Workforce reduction may reduce staffing demand",
      description: "Layoff or hiring freeze signals may contradict staffing surge needs.",
      problemCategory: "hiring_layoff_risk",
      assumptions: ["Competing workforce reduction signals may appear"],
      polarity: "negative",
    },
  ],
  "Government Funding": [
    {
      key: "funding_program_demand",
      title: "Public funding will drive contractor demand",
      description: "Approved funding in {location} indicates upcoming program delivery needs.",
      problemCategory: "funding_program_demand",
      assumptions: ["Funding signals reflect approved budgets"],
      polarity: "positive",
    },
    {
      key: "funding_cancelled_risk",
      title: "Funding may be cancelled or delayed",
      description: "Funding cancellation signals may reduce expected program demand.",
      problemCategory: "funding_cancelled_risk",
      assumptions: ["Funding status may change"],
      polarity: "negative",
    },
  ],
  Turnaround: [
    {
      key: "turnaround_labor_surge",
      title: "Turnaround labor and safety coverage demand is increasing",
      description: "Turnaround activity in {location} requires temporary labor and safety services.",
      problemCategory: "turnaround_labor_surge",
      assumptions: ["Turnaround window is active or scheduled"],
      polarity: "positive",
    },
  ],
  Emergency: [
    {
      key: "emergency_response_demand",
      title: "Emergency response services demand is increasing",
      description: "Emergency conditions in {location} create urgent service needs.",
      problemCategory: "emergency_response_demand",
      assumptions: ["Emergency signals reflect active event conditions"],
      polarity: "positive",
    },
  ],
  Infrastructure: [
    {
      key: "infrastructure_restoration_demand",
      title: "Infrastructure restoration demand is increasing",
      description: "Infrastructure activity in {location} requires site and restoration services.",
      problemCategory: "infrastructure_restoration_demand",
      assumptions: ["Infrastructure program is active"],
      polarity: "positive",
    },
  ],
  "Capital Project": [
    {
      key: "capital_project_services_demand",
      title: "Capital project services demand is increasing",
      description: "Capital project activity in {location} indicates multi-trade service needs.",
      problemCategory: "capital_project_services_demand",
      assumptions: ["Project is funded and progressing"],
      polarity: "positive",
    },
  ],
  Unknown: [
    {
      key: "general_services_demand",
      title: "Regional services demand may be changing",
      description: "Observed activity in {location} may indicate changing service demand.",
      problemCategory: "general_services_demand",
      assumptions: ["Situation evidence is limited"],
      polarity: "neutral",
    },
  ],
};

const DEFAULT_TEMPLATES = CATEGORY_HYPOTHESIS_TEMPLATES.Unknown;

function formatTemplate(text, situation) {
  const location =
    situation.summary?.primaryLocation ||
    [situation.location?.city, situation.location?.state].filter(Boolean).join(", ") ||
    "the region";
  return text.replace(/\{location\}/g, location);
}

export async function generateHypothesesFromSituation(situationId) {
  const situation = await getSituation(situationId);
  if (!situation) {
    throw new Error(`Situation not found: ${situationId}`);
  }

  const category = situation.category || situation.situationType || "Unknown";
  const templates = CATEGORY_HYPOTHESIS_TEMPLATES[category] || DEFAULT_TEMPLATES;

  return templates.map((template) => ({
    title: formatTemplate(template.title, situation),
    description: formatTemplate(template.description, situation),
    status: "generated",
    originatingSituationIds: [situation.id],
    supportingSignalIds: [...(situation.signalIds || [])],
    supportingFactIds: [...(situation.factIds || [])],
    supportingRelationshipIds: [...(situation.relationshipIds || [])],
    assumptions: [...template.assumptions],
    missingEvidence: [],
    confidence: 0,
    confidenceBreakdown: {},
    evidenceWeight: 0,
    contradictionIds: [],
    metadata: {
      generator: "hypothesis_generator_v0",
      situationCategory: category,
      templateKey: template.key,
      problemCategoryCandidate: template.problemCategory,
      polarity: template.polarity,
      situationConfidence: situation.confidence,
      affectedMarkets: situation.summary?.affectedMarkets || situation.marketIds || [],
      affectedCapabilities:
        situation.summary?.affectedCapabilities || situation.capabilityIds || [],
    },
    competingHypothesisIds: [],
    contradictionIds: [],
  }));
}

export { CATEGORY_HYPOTHESIS_TEMPLATES as HYPOTHESIS_TEMPLATES };
