import { DEFAULT_APPROVAL_POLICY, normalizeMission } from "./mission-schema.js";
import { attachStrategyToMission } from "./mission-strategy.js";

export const PRESSURE_WASHING_TEMPLATE_ID = "pressure_washing_beaumont_500";
export const KTM_TEMPLATE_ID = "ktm_industrial_beaumont_500";

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

export function createKtmMissionTemplate(overrides = {}) {
  return attachStrategyToMission(
    normalizeMission({
      missionId: "mission_ktm_industrial_beaumont_500",
      name: "KTM Industrial Maintenance - Beaumont 500 Mile Radius",
      goal:
        "Find and prioritize industrial maintenance, turnaround, staffing, and safety support opportunities for KTM within 500 miles of Beaumont, Texas.",
      status: "draft",
      priority: "critical",
      businessMode: "contract_growth",
      revenueTarget: {
        amount: 50000,
        currency: "USD",
        period: "month",
      },
      deadline: "120 days",
      geography: [
        {
          label: "Beaumont, TX 500-mile industrial radius",
          city: "Beaumont",
          state: "TX",
          country: "US",
          radiusMiles: 500,
        },
      ],
      industries: [
        "Industrial",
        "Energy",
        "Petrochemical",
        "Refining",
        "Industrial Construction",
        "Maintenance Contractors",
      ],
      buyerTypes: [
        "Refinery maintenance managers",
        "Petrochemical plant operations managers",
        "Industrial contractors",
        "Maintenance contractors",
        "Turnaround planners",
        "Safety managers",
        "Shutdown coordinators",
      ],
      offers: ["offer_ktm_manpower"],
      capabilities: ["ktm_labor", "fire_watch", "hole_watch", "safety_support", "maintenance_support"],
      constraints: [
        "Industrial work only",
        "Prioritize shutdowns, turnarounds, maintenance windows, staffing shortages, and safety coverage gaps",
        "Require clear industrial buyer or facility context before ranking as high priority",
        "No outreach without Founder approval",
      ],
      requiredSignals: [
        "Turnarounds",
        "Shutdowns",
        "Refinery expansion",
        "Maintenance windows",
        "Staffing shortages",
        "Safety coverage gaps",
        "Contractor demand",
        "Industrial permits",
        "RFPs and bid notices",
      ],
      ignoredSignals: ["Residential", "Retail storefronts", "Small local service requests"],
      preferredChannels: ["Email", "Phone", "Visit"],
      approvalPolicy: { ...DEFAULT_APPROVAL_POLICY },
      successMetrics: {
        qualifiedOpportunitiesPerWeek: 10,
        buyerConversationsPerMonth: 20,
        revenuePerMonth: 50000,
      },
      notes:
        "Default high-upside mission template for KTM industrial maintenance, safety, staffing, shutdown, and turnaround opportunities.",
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
    {
      templateId: KTM_TEMPLATE_ID,
      title: "KTM Industrial Maintenance - Beaumont 500 Mile Radius",
      priority: "P0",
      founderPriorityRank: 2,
      createMission: createKtmMissionTemplate,
    },
  ];
}
