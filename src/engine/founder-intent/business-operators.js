import { DEFAULT_APPROVAL_POLICY, normalizeMission } from "./mission-schema.js";
import { attachStrategyToMission } from "./mission-strategy.js";

export const PRESSURE_WASHING_TEMPLATE_ID = "pressure_washing_beaumont_500";

export function createPressureWashingMissionTemplate(overrides = {}) {
  return attachStrategyToMission(
    normalizeMission({
      missionId: "mission_pressure_washing_beaumont_500",
      name: "Commercial Pressure Washing - Beaumont 500 Mile Radius",
      goal: "Find and prioritize commercial pressure washing opportunities within 500 miles of Beaumont, Texas.",
      status: "draft",
      priority: "critical",
      businessMode: "cash_flow",
      revenueTarget: {
        amount: 20000,
        currency: "USD",
        period: "month",
      },
      deadline: "90 days",
      geography: [
        {
          label: "Beaumont, TX 500-mile radius",
          city: "Beaumont",
          state: "TX",
          country: "US",
          radiusMiles: 500,
        },
      ],
      industries: [
        "Commercial Property Services",
        "Restaurants",
        "Retail",
        "Office",
        "Medical",
        "Industrial",
      ],
      buyerTypes: [
        "Restaurant owners",
        "Retail property managers",
        "Office property managers",
        "Medical office managers",
        "Industrial facility managers",
        "Commercial property owners",
      ],
      offers: ["offer_pressure_washing"],
      capabilities: ["exterior_cleaning"],
      constraints: [
        "Commercial work only",
        "Prioritize entryways, sidewalks, storefronts, building exteriors, and high-visibility surfaces",
        "Avoid residential roofs and dumpster-pad-only jobs",
        "No outreach without Founder approval",
      ],
      requiredSignals: [
        "Commercial property management",
        "Business openings",
        "Store remodels",
        "Shopping centers",
        "Retail centers",
        "Restaurant openings",
        "Medical office buildings",
        "High foot-traffic storefronts",
      ],
      ignoredSignals: ["Residential", "Roofs", "Dumpster pads", "Low-value one-off cleaning"],
      preferredChannels: ["Email", "Cold Call", "Visit"],
      approvalPolicy: { ...DEFAULT_APPROVAL_POLICY },
      successMetrics: {
        qualifiedOpportunitiesPerWeek: 25,
        quotedJobsPerMonth: 20,
        revenuePerMonth: 20000,
      },
      notes:
        "Default cash-flow mission template for the Founder priority: commercial pressure washing within 500 miles of Beaumont, Texas.",
      ...overrides,
    }),
  );
}

export function listBusinessOperatorMissionTemplates() {
  return [
    {
      templateId: PRESSURE_WASHING_TEMPLATE_ID,
      title: "Commercial Pressure Washing - Beaumont 500 Mile Radius",
      priority: "P0",
      founderPriorityRank: 1,
      createMission: createPressureWashingMissionTemplate,
    },
  ];
}
