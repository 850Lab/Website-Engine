const STRATEGY_TEMPLATES = Object.freeze({
  offer_pressure_washing: {
    priorityBuyers: ["Restaurants", "Retail", "Office", "Medical", "Industrial"],
    ignore: ["Residential", "Roofs", "Dumpster pads"],
    recommendedChannels: ["Email", "Cold Call", "Visit"],
    recommendedSearchSignals: [
      "Property management",
      "Commercial permits",
      "Business openings",
      "Store remodels",
      "Shopping centers",
    ],
  },
  offer_ktm_manpower: {
    priorityBuyers: [
      "Refineries",
      "Petrochemical plants",
      "Industrial contractors",
      "Maintenance contractors",
      "Turnaround planners",
    ],
    ignore: ["Residential", "Retail storefronts"],
    recommendedChannels: ["Email", "Phone", "Visit"],
    recommendedSearchSignals: [
      "Turnarounds",
      "Shutdowns",
      "Refinery expansion",
      "Maintenance windows",
      "Staffing shortages",
      "Safety coverage gaps",
      "Contractor demand",
    ],
  },
  offer_website_growth: {
    priorityBuyers: ["Trade contractors", "Local service businesses", "B2C service providers"],
    ignore: ["Industrial turnarounds"],
    recommendedChannels: ["Email", "Phone"],
    recommendedSearchSignals: ["Website redesign", "Low conversion", "New business launch", "Rebrand"],
  },
  apartment_workshop: {
    priorityBuyers: ["Apartment complexes", "Property managers", "Regional managers", "Owners"],
    ignore: ["Single-family residential"],
    recommendedChannels: ["Email", "Phone", "Visit"],
    recommendedSearchSignals: [
      "Apartment community events",
      "Resident enrichment programs",
      "Property management conferences",
      "Multi-family ownership changes",
    ],
  },
});

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function generateMissionStrategy(mission) {
  const primaryOffer = mission.offers?.[0];
  const template = STRATEGY_TEMPLATES[primaryOffer] || STRATEGY_TEMPLATES[mission.missionId] || null;
  const custom = mission.missionId?.includes("apartment") ? STRATEGY_TEMPLATES.apartment_workshop : null;
  const base = custom || template || {
    priorityBuyers: mission.buyerTypes || [],
    ignore: mission.ignoredSignals || [],
    recommendedChannels: mission.preferredChannels || ["Email"],
    recommendedSearchSignals: mission.requiredSignals || [],
  };

  return {
    missionId: mission.missionId,
    generatedAt: new Date().toISOString(),
    summary: `Strategy for ${mission.name || mission.missionId}`,
    priorityBuyers: unique([...(base.priorityBuyers || []), ...(mission.buyerTypes || [])]),
    ignore: unique([...(base.ignore || []), ...(mission.ignoredSignals || [])]),
    recommendedChannels: unique([...(base.recommendedChannels || []), ...(mission.preferredChannels || [])]),
    recommendedSearchSignals: unique([
      ...(base.recommendedSearchSignals || []),
      ...(mission.requiredSignals || []),
    ]),
    focusGeography: mission.geography || [],
    revenueTarget: mission.revenueTarget || null,
    notes: mission.notes || "",
  };
}

export function attachStrategyToMission(mission) {
  const strategy = generateMissionStrategy(mission);
  return {
    ...mission,
    strategy,
  };
}
