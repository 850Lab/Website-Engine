import { DEFAULT_APPROVAL_POLICY, normalizeMission } from "./mission-schema.js";
import { attachStrategyToMission } from "./mission-strategy.js";

export const PRESSURE_WASHING_TEMPLATE_ID = "pressure_washing_beaumont_500";
export const KTM_TEMPLATE_ID = "ktm_industrial_beaumont_500";
export const APARTMENT_WORKSHOP_TEMPLATE_ID = "apartment_workshop_beaumont_500";
export const WEBSITE_AGENCY_TEMPLATE_ID = "website_agency_local_services";

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

export function createApartmentWorkshopMissionTemplate(overrides = {}) {
  return attachStrategyToMission(
    normalizeMission({
      missionId: "mission_apartment_workshop_beaumont_500",
      name: "Apartment Financial Workshop Sponsor Mission - Beaumont 500 Mile Radius",
      goal:
        "Find apartment communities that can host financial workshops and support local sponsor acquisition within 500 miles of Beaumont, Texas.",
      status: "draft",
      priority: "high",
      businessMode: "sponsor_acquisition",
      revenueTarget: {
        amount: 10000,
        currency: "USD",
        period: "month",
      },
      deadline: "6 months",
      geography: [
        {
          label: "Beaumont, TX 500-mile apartment workshop radius",
          city: "Beaumont",
          state: "TX",
          country: "US",
          radiusMiles: 500,
        },
      ],
      industries: ["Multi-family Housing", "Apartment Communities", "Resident Services", "Local Sponsorships"],
      buyerTypes: [
        "Property managers",
        "Regional managers",
        "Apartment owners",
        "Community managers",
        "Resident services coordinators",
        "Local sponsor decision makers",
      ],
      offers: ["offer_website_growth"],
      capabilities: ["website_growth", "lead_generation"],
      constraints: [
        "No outreach without Founder approval",
        "Workshop and sponsor messaging must be reviewed before use",
        "Prioritize apartment communities with resident engagement signals",
        "Do not imply financial advice automation or regulated recommendations",
      ],
      requiredSignals: [
        "Apartment community events",
        "Resident enrichment programs",
        "Property management groups",
        "Multi-family ownership changes",
        "Community partnerships",
        "Local sponsor categories",
        "Resident retention initiatives",
      ],
      ignoredSignals: ["Single-family residential", "No on-site community programming"],
      preferredChannels: ["Email", "Phone", "Visit"],
      approvalPolicy: { ...DEFAULT_APPROVAL_POLICY },
      successMetrics: {
        qualifiedApartmentCommunitiesPerWeek: 15,
        workshopConversationsPerMonth: 20,
        sponsorRevenuePerMonth: 10000,
      },
      notes:
        "Default apartment workshop mission template using existing website growth and lead-generation capabilities until a dedicated workshop offer is approved.",
      ...overrides,
    }),
  );
}

export function createWebsiteAgencyMissionTemplate(overrides = {}) {
  return attachStrategyToMission(
    normalizeMission({
      missionId: "mission_website_agency_local_services",
      name: "Website Agency Growth - Local Service Businesses",
      goal:
        "Find local service businesses with weak websites, low conversion, or poor digital credibility that may need website growth support.",
      status: "draft",
      priority: "medium",
      businessMode: "service_growth",
      revenueTarget: {
        amount: 15000,
        currency: "USD",
        period: "month",
      },
      deadline: "6 months",
      geography: [
        {
          label: "Beaumont, TX 500-mile local service radius",
          city: "Beaumont",
          state: "TX",
          country: "US",
          radiusMiles: 500,
        },
      ],
      industries: ["Local Services", "Home Services", "Trade Contractors", "B2C Services"],
      buyerTypes: ["Owners", "General managers", "Marketing managers", "Operations managers"],
      offers: ["offer_website_growth"],
      capabilities: ["website_growth", "lead_generation"],
      constraints: [
        "No outreach without Founder approval",
        "Prioritize businesses where website weakness is observable from source evidence",
        "No unsupported claims about traffic, revenue, or conversion performance",
      ],
      requiredSignals: [
        "Weak website",
        "Low conversion",
        "Poor credibility",
        "New business launch",
        "Rebrand",
        "Website redesign need",
        "Estimate request friction",
      ],
      ignoredSignals: ["Industrial turnarounds", "Apartment community events", "Residential-only cleaning jobs"],
      preferredChannels: ["Email", "Phone"],
      approvalPolicy: { ...DEFAULT_APPROVAL_POLICY },
      successMetrics: {
        qualifiedWebsiteOpportunitiesPerWeek: 20,
        consultationsPerMonth: 10,
        revenuePerMonth: 15000,
      },
      notes:
        "Default website agency mission template for local service businesses using existing website growth and lead-generation capabilities.",
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
    {
      templateId: APARTMENT_WORKSHOP_TEMPLATE_ID,
      title: "Apartment Financial Workshop Sponsor Mission - Beaumont 500 Mile Radius",
      priority: "P1",
      founderPriorityRank: 3,
      createMission: createApartmentWorkshopMissionTemplate,
    },
    {
      templateId: WEBSITE_AGENCY_TEMPLATE_ID,
      title: "Website Agency Growth - Local Service Businesses",
      priority: "P2",
      founderPriorityRank: 4,
      createMission: createWebsiteAgencyMissionTemplate,
    },
  ];
}
