import { createEmptyMission, createMissionId, normalizeMission } from "./mission-schema.js";
import {
  analyzeMissionCompleteness,
  applyClarificationAnswers,
  buildClarificationPrompt,
} from "./clarification-engine.js";
import { attachStrategyToMission } from "./mission-strategy.js";
import { validateMission } from "./mission-validator.js";
import { isLlmInterpreterEnabled, requestStructuredMissionDraft } from "./llm-client.js";

function normalizeIntent(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectIntentProfile(text) {
  const lower = normalizeIntent(text).toLowerCase();
  const hints = {
    pressureWashing: /pressure\s*wash|pressure washing|exterior clean|sidewalk|entryway/i.test(lower),
    ktmIndustrial: /ktm|industrial maintenance|turnaround|shutdown|refinery|fire watch|hole watch|safety support/i.test(lower),
    apartmentWorkshop: /apartment|financial workshop|property manager|sponsor|multi-?family/i.test(lower),
    websiteAgency: /website|web design|digital growth|agency/i.test(lower),
  };

  const matchedFamilies = Object.values(hints).filter(Boolean).length;
  if (
    matchedFamilies >= 2 ||
    /cash flow|replace my job|90 days|multiple missions/i.test(lower)
  ) {
    return "multi_mission_brief";
  }

  if (hints.pressureWashing) {
    return "pressure_washing";
  }
  if (hints.ktmIndustrial) {
    return "ktm_industrial";
  }
  if (hints.apartmentWorkshop) {
    return "apartment_workshop";
  }
  if (hints.websiteAgency) {
    return "website_agency";
  }
  if (/government contract|public sector|rfp/i.test(lower)) {
    return "government_contracts";
  }
  if (/saas|software product/i.test(lower)) {
    return "future_saas";
  }
  return "generic";
}

function buildDraftFromProfile(profile, founderText) {
  const base = createEmptyMission({
    sourceIntent: founderText,
    approvalPolicy: {
      requireFounderApprovalBeforeOutreach: true,
      maxAutonomousActionsPerDay: 0,
      allowDraftAssetGeneration: false,
    },
  });

  switch (profile) {
    case "pressure_washing":
      return normalizeMission({
        ...base,
        missionId: createMissionId("mission_pw"),
        name: "Commercial Pressure Washing Revenue Mission",
        goal: "Generate recurring commercial pressure washing revenue",
        offers: ["offer_pressure_washing"],
        capabilities: ["exterior_cleaning"],
        industries: ["Commercial Property Services"],
        buyerTypes: ["Restaurants", "Retail", "Office", "Medical", "Industrial"],
        preferredChannels: ["Email", "Cold Call", "Visit"],
        requiredSignals: ["Property management", "Commercial permits", "Business openings", "Store remodels"],
        ignoredSignals: ["Residential", "Roofs", "Dumpster pads"],
        priority: "high",
      });

    case "ktm_industrial":
      return normalizeMission({
        ...base,
        missionId: createMissionId("mission_ktm"),
        name: "KTM Industrial Maintenance Opportunities",
        goal: "Win industrial maintenance, turnaround, and safety staffing opportunities for KTM",
        offers: ["offer_ktm_manpower"],
        capabilities: ["ktm_labor", "maintenance_support", "fire_watch", "hole_watch", "safety_support"],
        industries: ["Industrial", "Energy", "Petrochemical"],
        buyerTypes: [
          "Refineries",
          "Petrochemical plants",
          "Industrial contractors",
          "Maintenance contractors",
          "Turnaround planners",
        ],
        preferredChannels: ["Email", "Phone", "Visit"],
        requiredSignals: [
          "Turnarounds",
          "Shutdowns",
          "Refinery expansion",
          "Maintenance windows",
          "Staffing shortages",
          "Contractor demand",
        ],
        priority: "high",
      });

    case "apartment_workshop":
      return normalizeMission({
        ...base,
        missionId: createMissionId("mission_apartment_workshop"),
        name: "Apartment Financial Workshop Campaign",
        goal: "Secure apartment communities for financial workshops and local sponsor revenue",
        offers: ["offer_website_growth"],
        industries: ["Multi-family Housing"],
        buyerTypes: ["Property managers", "Regional managers", "Apartment owners", "Community managers"],
        preferredChannels: ["Email", "Phone", "Visit"],
        requiredSignals: ["Apartment community events", "Resident enrichment programs", "Multi-family ownership changes"],
        notes: "Revenue model combines workshop sponsorships and apartment acquisition pipeline.",
        priority: "medium",
      });

    case "website_agency":
      return normalizeMission({
        ...base,
        missionId: createMissionId("mission_website_agency"),
        name: "Website Agency Growth Mission",
        goal: "Generate website growth and lead-generation opportunities for trade contractors",
        offers: ["offer_website_growth"],
        capabilities: ["website_growth", "lead_generation"],
        buyerTypes: ["Trade contractors", "Local service businesses"],
        preferredChannels: ["Email", "Phone"],
        priority: "medium",
      });

    case "government_contracts":
      return normalizeMission({
        ...base,
        missionId: createMissionId("mission_government"),
        name: "Government Contract Pursuit Mission",
        goal: "Identify qualified government contract opportunities aligned to owned capabilities",
        offers: ["offer_ktm_manpower"],
        buyerTypes: ["Public agencies", "Municipal buyers", "Prime contractors"],
        requiredSignals: ["RFP", "Public bid", "Government contract"],
        priority: "medium",
      });

    case "future_saas":
      return normalizeMission({
        ...base,
        missionId: createMissionId("mission_saas"),
        name: "Future SaaS Opportunity Exploration",
        goal: "Track signals that may support a future SaaS offer without committing outreach",
        offers: ["offer_website_growth"],
        buyerTypes: ["Software buyers", "Operations leaders"],
        priority: "low",
        notes: "Exploratory mission only — no outreach implied.",
      });

    case "multi_mission_brief":
      return normalizeMission({
        ...base,
        missionId: createMissionId("mission_multi"),
        name: "90-Day Cash Flow Portfolio",
        goal: "Replace job income within 90 days using pressure washing, KTM industrial contracts, and apartment workshops",
        offers: ["offer_pressure_washing", "offer_ktm_manpower", "offer_website_growth"],
        buyerTypes: [
          "Commercial property owners",
          "Industrial contractors",
          "Apartment property managers",
        ],
        geography: [{ label: "Beaumont, TX", city: "Beaumont", state: "TX", country: "US", radiusMiles: 500 }],
        revenueTarget: { amount: 20000, period: "month", currency: "USD" },
        deadline: "90 days",
        constraints: [
          "Prioritize opportunities within 500 miles of Beaumont, Texas",
          "Prepare for up to 10,000 personalized emails per month per offer",
          "Do not launch outreach without founder approval",
        ],
        preferredChannels: ["Email", "Phone", "Visit"],
        priority: "critical",
        notes: "Multi-mission brief — split into separate active missions after clarification.",
      });

    default:
      return normalizeMission({
        ...base,
        missionId: createMissionId("mission"),
        name: "Founder Mission",
        goal: founderText,
        offers: [],
        priority: "medium",
      });
  }
}

export async function interpretFounderIntent(founderText, options = {}) {
  const text = normalizeIntent(founderText);
  if (!text) {
    return {
      status: "error",
      error: "Founder intent text is required",
    };
  }

  const mode = options.mode || (isLlmInterpreterEnabled() ? "llm" : "rules");
  let draft = null;
  let interpreterMode = mode;

  if (mode === "llm") {
    try {
      const llmDraft = await requestStructuredMissionDraft(text, options.context || {});
      if (llmDraft) {
        draft = normalizeMission({
          ...createEmptyMission({ sourceIntent: text }),
          ...llmDraft,
          metadata: { interpreterMode: "llm" },
        });
        if (llmDraft.clarificationNeeded) {
          return {
            status: "clarify",
            interpreterMode: "llm",
            draft,
            ...buildClarificationPrompt(draft),
            questions: llmDraft.clarificationQuestions || buildClarificationPrompt(draft).questions,
          };
        }
      }
    } catch (error) {
      if (options.strictLlm) {
        return { status: "error", error: error.message, interpreterMode: "llm" };
      }
      interpreterMode = "rules";
    }
  }

  if (!draft) {
    const profile = detectIntentProfile(text);
    draft = buildDraftFromProfile(profile, text);
    draft.metadata = { ...(draft.metadata || {}), interpreterMode: "rules", intentProfile: profile };
  }

  const completeness = analyzeMissionCompleteness(draft);
  if (!completeness.complete) {
    return {
      status: "clarify",
      interpreterMode,
      draft,
      intentProfile: draft.metadata?.intentProfile || detectIntentProfile(text),
      ...buildClarificationPrompt(draft, completeness),
    };
  }

  const validated = await validateMission(draft);
  const mission = attachStrategyToMission(normalizeMission(draft));
  return {
    status: validated.valid ? "ready" : "invalid",
    interpreterMode,
    draft: mission,
    mission: validated.valid ? { ...mission, status: "draft" } : null,
    validation: validated,
    ...buildClarificationPrompt(mission, completeness),
  };
}

export async function completeMissionFromClarification(draft, answers = {}, options = {}) {
  const merged = applyClarificationAnswers(draft, answers);
  merged.metadata = {
    ...(merged.metadata || {}),
    interpreterMode: options.mode || merged.metadata?.interpreterMode || "rules",
  };

  const completeness = analyzeMissionCompleteness(merged);
  if (!completeness.complete) {
    return {
      status: "clarify",
      draft: merged,
      ...buildClarificationPrompt(merged, completeness),
    };
  }

  const mission = attachStrategyToMission(normalizeMission(merged));
  const validation = await validateMission(mission);
  return {
    status: validation.valid ? "ready" : "invalid",
    draft: mission,
    mission: validation.valid ? mission : null,
    validation,
  };
}

export async function interpretAndPrepareMission(founderText, answers = {}, options = {}) {
  const firstPass = await interpretFounderIntent(founderText, options);
  if (firstPass.status === "clarify" && Object.keys(answers).length) {
    return completeMissionFromClarification(firstPass.draft, answers, options);
  }
  return firstPass;
}

export function splitMultiMissionBrief(mission) {
  if (!mission?.offers || mission.offers.length <= 1) {
    return [mission];
  }

  const profiles = {
    offer_pressure_washing: buildDraftFromProfile("pressure_washing", mission.sourceIntent),
    offer_ktm_manpower: buildDraftFromProfile("ktm_industrial", mission.sourceIntent),
    offer_website_growth: buildDraftFromProfile("apartment_workshop", mission.sourceIntent),
  };

  return mission.offers
    .map((offerId) => profiles[offerId])
    .filter(Boolean)
    .map((draft) =>
      attachStrategyToMission(
        normalizeMission({
          ...draft,
          geography: mission.geography,
          revenueTarget: mission.revenueTarget,
          deadline: mission.deadline,
          constraints: mission.constraints,
          approvalPolicy: mission.approvalPolicy,
          status: "draft",
          sourceIntent: mission.sourceIntent,
        }),
      ),
    );
}
