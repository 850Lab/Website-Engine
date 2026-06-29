export const PROBLEM_CATEGORY_TO_PROBLEMS_SOLVED = {
  expansion_contractor_demand: [
    "labor_shortage",
    "schedule_delays",
    "surge_staffing",
    "skilled_trade_gaps",
    "deferred_maintenance",
    "facility_backlog",
    "hot_work_compliance",
  ],
  expansion_delay_risk: [],
  hiring_staffing_surge: [
    "labor_shortage",
    "surge_staffing",
    "skilled_trade_gaps",
    "schedule_delays",
  ],
  hiring_layoff_risk: [],
  funding_program_demand: [
    "labor_shortage",
    "skilled_trade_gaps",
    "deferred_maintenance",
    "facility_backlog",
  ],
  funding_cancelled_risk: [],
  turnaround_labor_surge: [
    "labor_shortage",
    "surge_staffing",
    "hot_work_compliance",
    "confined_space_compliance",
    "maintenance_safety_gaps",
    "shutdown_safety_coverage",
    "safety_staffing_gaps",
  ],
  maintenance_window_demand: [
    "deferred_maintenance",
    "downtime",
    "reliability_risk",
    "facility_backlog",
    "maintenance_safety_gaps",
  ],
  emergency_response_demand: [
    "grease_and_dirt_accumulation",
    "poor_first_impression",
    "neglected_entrance",
    "labor_shortage",
    "surge_staffing",
    "safety_staffing_gaps",
  ],
  infrastructure_restoration_demand: [
    "deferred_maintenance",
    "downtime",
    "reliability_risk",
    "facility_backlog",
  ],
  capital_project_services_demand: [
    "labor_shortage",
    "skilled_trade_gaps",
    "hot_work_compliance",
    "schedule_delays",
  ],
  general_services_demand: [
    "labor_shortage",
    "deferred_maintenance",
    "poor_first_impression",
    "low_conversion",
    "weak_credibility",
  ],
};

export const COMPOSITION_RULES = {
  turnaround_labor_surge: {
    parentCapabilityId: "ktm_labor",
    required: ["ktm_labor", "fire_watch", "hole_watch"],
    optional: ["safety_support"],
  },
  maintenance_window_demand: {
    parentCapabilityId: "maintenance_support",
    required: ["maintenance_support"],
    optional: ["ktm_labor", "safety_support"],
  },
  expansion_contractor_demand: {
    parentCapabilityId: "ktm_labor",
    required: ["ktm_labor"],
    optional: ["fire_watch", "maintenance_support", "safety_support"],
  },
  hiring_staffing_surge: {
    parentCapabilityId: "ktm_labor",
    required: ["ktm_labor"],
    optional: ["safety_support"],
  },
  emergency_response_demand: {
    parentCapabilityId: null,
    required: ["exterior_cleaning"],
    optional: ["ktm_labor", "safety_support"],
  },
  capital_project_services_demand: {
    parentCapabilityId: "ktm_labor",
    required: ["ktm_labor"],
    optional: ["fire_watch", "safety_support"],
  },
};

export const CATEGORY_WEIGHTS = {
  Digital: {
    problemTypeAlignment: 0.22,
    industryFit: 0.08,
    locationFit: 0.05,
    scaleFit: 0.08,
    timingFit: 0.12,
    equipmentMatch: 0.02,
    certificationMatch: 0.02,
    historicalSuccess: 0.12,
    capacity: 0.05,
    riskInverse: 0.02,
    urgencyAlignment: 0.02,
    confidencePropagation: 0.02,
  },
  default: {
    problemTypeAlignment: 0.2,
    industryFit: 0.1,
    locationFit: 0.15,
    scaleFit: 0.1,
    timingFit: 0.1,
    equipmentMatch: 0.05,
    certificationMatch: 0.1,
    historicalSuccess: 0.1,
    capacity: 0.05,
    riskInverse: 0.03,
    urgencyAlignment: 0.01,
    confidencePropagation: 0.01,
  },
};

export function getProblemsSolvedForCategory(category) {
  return PROBLEM_CATEGORY_TO_PROBLEMS_SOLVED[category] || PROBLEM_CATEGORY_TO_PROBLEMS_SOLVED.general_services_demand;
}

export function getCompositionRule(category) {
  return COMPOSITION_RULES[category] || null;
}

export function getCategoryWeights(capabilityCategory) {
  if (capabilityCategory === "Digital" || capabilityCategory === "Technology" || capabilityCategory === "Growth") {
    return CATEGORY_WEIGHTS.Digital;
  }
  return CATEGORY_WEIGHTS.default;
}
