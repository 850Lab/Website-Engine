export const PROBLEM_CATEGORY_BUYER_AFFINITY = {
  expansion_contractor_demand: [
    "Commercial Construction",
    "Chemical Plants",
    "Industrial",
    "Ports",
    "School Districts",
  ],
  hiring_staffing_surge: ["Commercial Construction", "Chemical Plants", "Hospitals"],
  turnaround_labor_surge: ["Chemical Plants", "Commercial Construction", "Industrial"],
  emergency_response_demand: ["Restaurants", "Gas stations", "Commercial Construction"],
  funding_program_demand: ["School Districts", "Commercial Construction"],
  infrastructure_restoration_demand: ["Commercial Construction", "School Districts"],
  capital_project_services_demand: ["Commercial Construction", "Chemical Plants"],
  general_services_demand: ["Restaurants", "Gas stations", "Fence Companies", "Roofing"],
};

export const MIN_CAPABILITY_FIT_FOR_OFFER = 0.25;

export const OFFER_FIT_WEIGHTS = {
  capabilityCoverage: 0.3,
  compositionCoverage: 0.25,
  buyerPersonaAlignment: 0.15,
  urgencyAlignment: 0.1,
  commercialBandFit: 0.1,
  bundleCoherence: 0.1,
};

export function getBuyerAffinity(problemCategory) {
  return (
    PROBLEM_CATEGORY_BUYER_AFFINITY[problemCategory] ||
    PROBLEM_CATEGORY_BUYER_AFFINITY.general_services_demand
  );
}
