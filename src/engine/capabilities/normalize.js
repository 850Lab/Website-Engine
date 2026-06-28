const MATURITY_VALUES = ["experimental", "proven", "scaled", "legacy"];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function defaultGeographicConstraints(remoteEligible = false) {
  return {
    servedRegions: ["US"],
    excludedRegions: [],
    travelRadiusMiles: null,
    remoteEligible,
  };
}

function defaultHistoricalPerformance() {
  return {
    engagementsTotal: 0,
    winRate: null,
    onTimeRate: null,
    incidentRate: null,
    avgFitScoreAchieved: null,
    lastUpdated: null,
    source: "manual",
  };
}

export function normalizeCapability(raw = {}) {
  const maturity = MATURITY_VALUES.includes(raw.maturity) ? raw.maturity : "proven";
  const remoteEligible = raw.category === "Digital" || raw.category === "Technology" || raw.category === "Growth";

  return {
    id: String(raw.id || "").trim(),
    name: String(raw.name || "").trim(),
    description: String(raw.description || raw.notes || "").trim(),
    category: String(raw.category || "Unknown").trim(),
    parentCapability: raw.parentCapability || null,
    childCapabilities: asArray(raw.childCapabilities),
    problemsSolved: asArray(raw.problemsSolved),
    kpisImproved: asArray(raw.kpisImproved),
    typicalBuyers: asArray(raw.typicalBuyers),
    decisionMakers: asArray(raw.decisionMakers),
    deliveryRequirements: asArray(raw.deliveryRequirements),
    requiredCertifications: asArray(raw.requiredCertifications),
    requiredEquipment: asArray(raw.requiredEquipment),
    requiredSkills: asArray(raw.requiredSkills),
    geographicConstraints: {
      ...defaultGeographicConstraints(remoteEligible),
      ...(isObject(raw.geographicConstraints) ? raw.geographicConstraints : {}),
    },
    industryConstraints: {
      servedIndustries: asArray(raw.industryConstraints?.servedIndustries || raw.typicalBuyers),
      excludedIndustries: asArray(raw.industryConstraints?.excludedIndustries),
      requiresPriorSiteExperience: Boolean(raw.industryConstraints?.requiresPriorSiteExperience),
    },
    regulatoryConstraints: asArray(raw.regulatoryConstraints),
    maturity,
    scalability: isObject(raw.scalability)
      ? raw.scalability
      : {
          model: remoteEligible ? "digital_unlimited" : "elastic_pool",
          surgeMultiplier: remoteEligible ? null : 3,
          leadTimeDays: remoteEligible ? 7 : 3,
        },
    estimatedCapacity: isObject(raw.estimatedCapacity)
      ? raw.estimatedCapacity
      : {
          unit: remoteEligible ? "projects" : "crews",
          available: remoteEligible ? 10 : 5,
          committed: 0,
          asOf: null,
          confidence: 0.7,
        },
    historicalPerformance: {
      ...defaultHistoricalPerformance(),
      ...(isObject(raw.historicalPerformance) ? raw.historicalPerformance : {}),
    },
    marginProfile: isObject(raw.marginProfile) ? raw.marginProfile : {},
    executionDifficulty: typeof raw.executionDifficulty === "number" ? raw.executionDifficulty : 5,
    revenuePotential: isObject(raw.revenuePotential) ? raw.revenuePotential : {},
    associatedOffers: asArray(raw.associatedOffers),
    supportingProblems: asArray(raw.supportingProblems),
    notes: raw.notes || null,
    metadata: isObject(raw.metadata) ? raw.metadata : {},
  };
}
