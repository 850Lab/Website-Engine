const INDUSTRIAL_PROBLEM_CATEGORIES = new Set([
  "expansion_contractor_demand",
  "turnaround_labor_surge",
  "maintenance_window_demand",
  "capital_project_services_demand",
  "hiring_staffing_surge",
  "funding_program_demand",
  "infrastructure_restoration_demand",
]);

const SEMANTIC_FIT_ADJUSTMENTS = {
  expansion_contractor_demand: {
    ktm_labor: 0.15,
    fire_watch: 0.04,
    hole_watch: 0.03,
    safety_support: 0.03,
    maintenance_support: -0.1,
    website_growth: -0.25,
    exterior_cleaning: -0.2,
  },
  turnaround_labor_surge: {
    fire_watch: 0.14,
    hole_watch: 0.14,
    safety_support: 0.1,
    ktm_labor: 0.08,
    maintenance_support: -0.08,
    website_growth: -0.25,
    exterior_cleaning: -0.2,
  },
  maintenance_window_demand: {
    maintenance_support: 0.18,
    ktm_labor: 0.04,
    safety_support: 0.03,
    fire_watch: -0.04,
    website_growth: -0.25,
    exterior_cleaning: -0.2,
  },
  capital_project_services_demand: {
    ktm_labor: 0.1,
    fire_watch: 0.04,
    maintenance_support: -0.06,
    website_growth: -0.2,
  },
  general_services_demand: {
    website_growth: -0.25,
    exterior_cleaning: -0.15,
  },
};

const NON_INDUSTRIAL_CAPABILITY_CATEGORIES = new Set(["Digital", "Technology", "Growth", "Cleaning"]);

export function getSemanticFitAdjustment(problemCategory, capabilityId) {
  const table = SEMANTIC_FIT_ADJUSTMENTS[problemCategory];
  if (!table) return 0;
  return table[capabilityId] ?? 0;
}

export function isCommerciallyIrrelevant(problemCategory, capability = {}) {
  if (!INDUSTRIAL_PROBLEM_CATEGORIES.has(problemCategory)) {
    return false;
  }
  return NON_INDUSTRIAL_CAPABILITY_CATEGORIES.has(capability.category);
}

export function applySemanticCalibration(problemCategory, capabilityId, fitScore) {
  const adjustment = getSemanticFitAdjustment(problemCategory, capabilityId);
  return Math.min(1, Math.max(0, fitScore + adjustment));
}
