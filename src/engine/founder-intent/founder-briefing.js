import { listOpportunities } from "../opportunities/index.js";
import { getActiveMissions, listMissions } from "./mission-registry.js";
import { rankOpportunitiesForMission } from "./mission-alignment.js";
import { recommendEngineeringTasks } from "./engineering-director.js";

function money(value) {
  if (value == null || Number.isNaN(Number(value))) return "n/a";
  return `$${Number(value).toLocaleString()}`;
}

function missionRevenueTarget(mission) {
  if (!mission?.revenueTarget?.amount) return null;
  return {
    amount: mission.revenueTarget.amount,
    currency: mission.revenueTarget.currency || "USD",
    period: mission.revenueTarget.period || "month",
    label: `${money(mission.revenueTarget.amount)} / ${mission.revenueTarget.period || "month"}`,
  };
}

function summarizeAlignment(row) {
  return {
    opportunityId: row.opportunity.id || null,
    title: row.opportunity.title || row.opportunity.headline || "Untitled opportunity",
    offerId: row.opportunity.offerId || row.opportunity.offer?.offerId || row.opportunity.recommendedOfferId || null,
    missionMatch: row.alignment.missionMatch,
    opportunityConfidence: row.alignment.opportunityConfidence,
    commercialValue: row.alignment.commercialValue,
    revenuePotential: row.alignment.revenuePotential,
    urgency: row.alignment.urgency,
    executionDifficulty: row.alignment.executionDifficulty,
    recommendedNextAction: row.alignment.recommendedNextAction,
  };
}

function summarizeMission(mission, opportunities, maxOpportunities) {
  const ranked = rankOpportunitiesForMission(opportunities, mission)
    .slice(0, maxOpportunities)
    .map(summarizeAlignment);
  const engineeringTasks = recommendEngineeringTasks({ mission });

  return {
    missionId: mission.missionId,
    name: mission.name,
    goal: mission.goal,
    status: mission.status,
    priority: mission.priority,
    revenueTarget: missionRevenueTarget(mission),
    geography: mission.geography || [],
    offers: mission.offers || [],
    buyerTypes: mission.buyerTypes || [],
    strategy: mission.strategy || null,
    topOpportunities: ranked,
    engineeringTasks,
    approvalPolicy: mission.approvalPolicy || {},
  };
}

export async function buildFounderBriefing(options = {}) {
  const allMissions = options.missions || (await listMissions());
  const activeMissions = allMissions.filter((mission) => mission.status === "active");
  const opportunities = Array.isArray(options.opportunities) ? options.opportunities : await listOpportunities();
  const maxOpportunities = options.maxOpportunities ?? 5;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalMissions: allMissions.length,
      activeMissions: activeMissions.length,
      totalOpportunities: opportunities.length,
      outreachBlocked: true,
      approvalRequired: true,
    },
    activeMissions: activeMissions.map((mission) => summarizeMission(mission, opportunities, maxOpportunities)),
    pausedMissions: allMissions.filter((mission) => mission.status === "paused").length,
    archivedMissions: allMissions.filter((mission) => mission.status === "archived").length,
  };
}

function renderList(items) {
  if (!items?.length) return "- None";
  return items.map((item) => `- ${item}`).join("\n");
}

function renderOpportunity(row) {
  return [
    `- **${row.title}**`,
    `  - Mission match: ${Math.round(row.missionMatch * 100)}%`,
    `  - Confidence: ${Math.round(row.opportunityConfidence * 100)}%`,
    `  - Revenue potential: ${money(row.revenuePotential)}`,
    `  - Urgency: ${row.urgency}`,
    `  - Difficulty: ${row.executionDifficulty}`,
    `  - Next action: ${row.recommendedNextAction}`,
  ].join("\n");
}

function renderEngineeringTask(task) {
  return [
    `- **${task.title}** (${task.phase})`,
    `  - Owner module: \`${task.ownerModule}\``,
    `  - Approval required: ${task.approvalRequired ? "yes" : "no"}`,
    `  - OpenClaw eligible: ${task.openClawEligible ? "yes" : "no"}`,
  ].join("\n");
}

export function renderFounderBriefingMarkdown(briefing) {
  const lines = [
    "# AI Chief of Staff Briefing",
    "",
    `Generated: ${briefing.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Active missions: ${briefing.summary.activeMissions}`,
    `- Total opportunities: ${briefing.summary.totalOpportunities}`,
    `- Outreach blocked: ${briefing.summary.outreachBlocked ? "yes" : "no"}`,
    `- Founder approval required: ${briefing.summary.approvalRequired ? "yes" : "no"}`,
    "",
  ];

  if (!briefing.activeMissions.length) {
    lines.push("## Active Missions", "", "No active missions. Create or activate a mission before ranking opportunities.", "");
  }

  for (const mission of briefing.activeMissions) {
    lines.push(`## ${mission.name}`, "");
    lines.push(`- Mission ID: \`${mission.missionId}\``);
    lines.push(`- Goal: ${mission.goal}`);
    lines.push(`- Priority: ${mission.priority}`);
    lines.push(`- Revenue target: ${mission.revenueTarget?.label || "not set"}`);
    lines.push(`- Offers: ${mission.offers.join(", ") || "none"}`);
    lines.push("");
    lines.push("### Buyer Focus", "");
    lines.push(renderList(mission.buyerTypes));
    lines.push("");
    lines.push("### Strategy Signals", "");
    lines.push(renderList(mission.strategy?.recommendedSearchSignals || []));
    lines.push("");
    lines.push("### Top Mission-Aligned Opportunities", "");
    lines.push(mission.topOpportunities.length ? mission.topOpportunities.map(renderOpportunity).join("\n") : "- None yet");
    lines.push("");
    lines.push("### Recommended Engineering Work", "");
    lines.push(mission.engineeringTasks.length ? mission.engineeringTasks.map(renderEngineeringTask).join("\n") : "- None");
    lines.push("");
  }

  lines.push("## Operating Rule", "");
  lines.push("This briefing is read-only. It does not launch outreach, execute jobs, call OpenClaw, or bypass Founder approval.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}
