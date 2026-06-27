import { getActiveMission } from "../campaigns/index.js";
import { buildExecutionPlan } from "../execution/index.js";
import { assembleEvidence } from "../evidence/index.js";
import { listCapabilities } from "../capabilities/index.js";
import { getOfferWithCapabilities, listOffers } from "../offers/index.js";
import { rankMarkets } from "../markets/index.js";
import { buildOpportunityRadar } from "../intelligence/index.js";
import { CEO_MODES, scoreOpportunity } from "../score-council/index.js";

const CEO_MODE_LABELS = {
  cash_flow: "Cash Flow",
  enterprise: "Enterprise",
  recurring: "Recurring",
  fastest_win: "Fastest Win",
  five_million_plus: "$5M+",
};

function money(value) {
  return Number(value || 0);
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

async function buildRadarByMode() {
  const modes = Object.keys(CEO_MODES);
  const entries = await Promise.all(
    modes.map(async (mode) => {
      const radar = await buildOpportunityRadar({ mode });
      return { mode, label: CEO_MODE_LABELS[mode] || mode, radar, top: radar[0] || null };
    }),
  );
  return Object.fromEntries(entries.map((entry) => [entry.mode, entry]));
}

function pickPrimaryMode(radarByMode) {
  let bestMode = "cash_flow";
  let bestScore = -1;
  for (const [mode, entry] of Object.entries(radarByMode)) {
    const score = entry.top?.opportunityScore || 0;
    if (score > bestScore) {
      bestScore = score;
      bestMode = mode;
    }
  }
  return bestMode;
}

function buildExecutiveMetrics({ primaryRadar, radarByMode, capabilities, offers, markets }) {
  const highConfidence = primaryRadar.filter(
    (row) => row.databaseConfidence === "High" || row.databaseConfidence === "Medium",
  );

  return {
    totalOpportunities: primaryRadar.length,
    highConfidenceOpportunities: highConfidence.length,
    estimatedRevenuePotential: sum(primaryRadar.map((row) => money(row.estimatedRevenuePotential))),
    estimatedContractPotential: sum(primaryRadar.map((row) => money(row.estimatedContractValue))),
    reachableBuyers: sum(primaryRadar.map((row) => row.reachableBusinesses || 0)),
    reachableDecisionMakers: sum(primaryRadar.map((row) => row.contactsFound || 0)),
    averageContactCoverage: average(primaryRadar.map((row) => row.contactCoverage || 0)),
    capabilitiesAvailable: capabilities.length,
    offersAvailable: offers.length,
    marketsAvailable: markets.length,
    topCeoMode: CEO_MODE_LABELS[pickPrimaryMode(radarByMode)] || "Cash Flow",
    cashFlowOpportunity: radarByMode.cash_flow?.top || null,
    enterpriseOpportunity: radarByMode.enterprise?.top || null,
    fastestWinOpportunity: radarByMode.fastest_win?.top || null,
    recurringOpportunity: radarByMode.recurring?.top || null,
    fiveMillionPlusOpportunity: radarByMode.five_million_plus?.top || null,
  };
}

function buildExecutiveSummary({ topOpportunity, evidence, metrics, primaryMode }) {
  if (!topOpportunity) {
    return "No opportunities were generated from the current database and offer library.";
  }

  return [
    `Top opportunity: ${topOpportunity.offer} in ${topOpportunity.industry || topOpportunity.market}.`,
    `Ranked first under ${CEO_MODE_LABELS[primaryMode] || primaryMode} mode with composite score ${topOpportunity.opportunityScore}/100.`,
    `${metrics.reachableBuyers} reachable buyers across ${metrics.totalOpportunities} opportunities; ${metrics.highConfidenceOpportunities} are medium/high database confidence.`,
    evidence.summary,
  ].join(" ");
}

function buildAlerts({ topOpportunity, evidence, metrics }) {
  const alerts = [];
  if (!topOpportunity) {
    alerts.push({ level: "warning", message: "No ranked opportunities available." });
    return alerts;
  }
  for (const item of evidence.missingData || []) {
    alerts.push({ level: "info", message: item });
  }
  if (metrics.averageContactCoverage < 50) {
    alerts.push({
      level: "warning",
      message: `Average contact coverage is ${metrics.averageContactCoverage}% across radar.`,
    });
  }
  if (topOpportunity.databaseConfidence === "Low" || topOpportunity.databaseConfidence === "None") {
    alerts.push({
      level: "warning",
      message: `Top opportunity database confidence is ${topOpportunity.databaseConfidence}.`,
    });
  }
  return alerts;
}

function buildRecommendations({ topOpportunity, evidence, executionPlan, metrics }) {
  if (!topOpportunity) {
    return [{ priority: 1, action: "Enrich database and capabilities before executive outreach." }];
  }

  const items = [
    {
      priority: 1,
      action: topOpportunity.recommendedNextAction,
      why: evidence.explainability?.why,
    },
    {
      priority: 2,
      action: `Review score council breakdown (${metrics.topCeoMode} mode).`,
      why: evidence.strengths.slice(0, 2).join("; "),
    },
  ];

  if (executionPlan?.missionExecution?.buyer) {
    items.push({
      priority: 3,
      action: `Align mission buyer ${executionPlan.missionExecution.buyer.name} with ranked opportunity outreach.`,
      why: "Mission execution plan found a buyer in active campaign scope.",
    });
  }

  if (evidence.missingData?.length) {
    items.push({
      priority: 4,
      action: "Close missing data gaps before scaling outreach.",
      why: evidence.missingData.join(" "),
    });
  }

  return items;
}

function buildExecutionPlanProjection(opportunity, mission, missionExecution) {
  if (!opportunity) return null;

  const primaryChannel = opportunity.channels?.[0] || "Phone";

  return {
    opportunityId: opportunity.id,
    offerId: opportunity.offerId,
    offer: opportunity.offer,
    buyer: opportunity.buyer,
    industry: opportunity.industry || opportunity.market,
    immediateAction: opportunity.recommendedNextAction,
    channels: opportunity.channels || [],
    autonomyLevel: "human_approval_required",
    steps: [
      {
        order: 1,
        action: "Review evidence bundle and score council subscores",
        channel: "internal",
      },
      {
        order: 2,
        action: opportunity.recommendedNextAction,
        channel: primaryChannel,
      },
      {
        order: 3,
        action: "Record outcome (win, loss, follow-up) for learning loop",
        channel: "internal",
      },
    ],
    afterExecution: {
      summary:
        "Outcomes update Attempt/Outcome projections today and will calibrate Score Council weights in Phase 5.",
      expectedSignals: [
        "Contact attempt logged",
        "Conversation or meeting scheduled",
        "Proposal or estimate sent",
        "Win/loss recorded with revenue",
      ],
      learningHooks: ["Probability engine", "Channel efficacy", "Timing engine", "Revenue calibration"],
      nextReview: "Re-rank radar after outcome capture or major signal ingestion.",
    },
    missionContext: mission
      ? {
          id: mission.id,
          name: mission.name,
          goal: mission.goal,
          strategy: mission.strategy,
        }
      : null,
    missionExecution,
  };
}

function buildScoreCouncilSummary(topOpportunity) {
  if (!topOpportunity?.scoreCouncil) return null;
  const { mode, compositeScore, scoreVector, scores } = topOpportunity.scoreCouncil;
  const topEngines = Object.entries(scoreVector || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([engine, score]) => ({ engine, score }));

  return {
    mode,
    modeLabel: CEO_MODE_LABELS[mode] || mode,
    compositeScore,
    topEngines,
    engines: scores,
  };
}

export async function buildMissionControl({ mode } = {}) {
  const [mission, capabilities, offers, markets, radarByMode] = await Promise.all([
    getActiveMission(),
    listCapabilities(),
    listOffers(),
    rankMarkets(),
    buildRadarByMode(),
  ]);

  const primaryMode = mode || pickPrimaryMode(radarByMode);
  const primaryRadar = radarByMode[primaryMode]?.radar || [];
  const topOpportunity = primaryRadar[0] || null;
  const runnerUp = primaryRadar[1] || null;

  const offerRecord = topOpportunity?.offerId
    ? await getOfferWithCapabilities(topOpportunity.offerId)
    : null;
  const market = topOpportunity?.marketId
    ? markets.find((row) => row.id === topOpportunity.marketId) || null
    : null;

  const missionExecution = mission ? await buildExecutionPlan(mission) : null;

  const evidence = topOpportunity
    ? assembleEvidence(topOpportunity, {
        offerRecord,
        market,
        runnerUp,
        rank: 1,
        totalCount: primaryRadar.length,
      })
    : {
        summary: "No evidence available.",
        strengths: [],
        weaknesses: [],
        assumptions: [],
        evidence: [],
        confidence: { database: "None", scoreCouncilAverage: 0, compositeScore: 0 },
        whyNow: [],
        whyNotOthers: [],
        explainability: {
          why: "",
          whyNow: [],
          whyNotOthers: [],
          assumptions: [],
          evidence: [],
          missingData: ["No opportunities generated."],
        },
        missingData: ["No opportunities generated."],
      };

  const metrics = buildExecutiveMetrics({
    primaryRadar,
    radarByMode,
    capabilities,
    offers,
    markets,
  });

  const executionPlan = buildExecutionPlanProjection(topOpportunity, mission, missionExecution);

  return {
    generatedAt: new Date().toISOString(),
    mission,
    primaryMode,
    executiveSummary: buildExecutiveSummary({
      topOpportunity,
      evidence,
      metrics,
      primaryMode,
    }),
    topOpportunity: topOpportunity
      ? {
          ...topOpportunity,
          offerRecord,
          capabilities: offerRecord?.capabilities || [],
        }
      : null,
    scoreCouncil: topOpportunity?.scoreCouncil || null,
    scoreCouncilSummary: buildScoreCouncilSummary(topOpportunity),
    evidence,
    executionPlan,
    metrics,
    alerts: buildAlerts({ topOpportunity, evidence, metrics }),
    recommendations: buildRecommendations({ topOpportunity, evidence, executionPlan, metrics }),
    radar: {
      primaryMode,
      primaryCount: primaryRadar.length,
      topTen: primaryRadar.slice(0, 10),
      byMode: Object.fromEntries(
        Object.entries(radarByMode).map(([key, value]) => [
          key,
          {
            label: value.label,
            top: value.top,
            count: value.radar.length,
          },
        ]),
      ),
    },
    catalogs: {
      capabilities,
      offers,
      markets,
    },
  };
}

export { CEO_MODE_LABELS, scoreOpportunity };
