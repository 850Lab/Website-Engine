export function summarizeMission(mission, strategy = mission?.strategy) {
  const lines = [
    `# Mission: ${mission.name || mission.missionId}`,
    "",
    `- **Goal:** ${mission.goal || "Not specified"}`,
    `- **Priority:** ${mission.priority}`,
    `- **Status:** ${mission.status}`,
  ];

  if (mission.revenueTarget?.amount) {
    lines.push(
      `- **Revenue target:** $${Number(mission.revenueTarget.amount).toLocaleString()} / ${mission.revenueTarget.period || "month"}`,
    );
  }
  if (mission.deadline) {
    lines.push(`- **Deadline:** ${mission.deadline}`);
  }
  if (mission.geography?.length) {
    lines.push(
      `- **Geography:** ${mission.geography
        .map((row) => `${row.label || row.city || "Region"}${row.radiusMiles ? ` (${row.radiusMiles} mi)` : ""}`)
        .join("; ")}`,
    );
  }
  if (mission.offers?.length) {
    lines.push(`- **Offers:** ${mission.offers.join(", ")}`);
  }
  if (mission.buyerTypes?.length) {
    lines.push(`- **Buyer types:** ${mission.buyerTypes.join(", ")}`);
  }
  if (mission.constraints?.length) {
    lines.push(`- **Constraints:** ${mission.constraints.join("; ")}`);
  }

  lines.push("", "## Approval", "");
  lines.push(
    `- Founder approval required before outreach: **${mission.approvalPolicy?.requireFounderApprovalBeforeOutreach ? "yes" : "no"}**`,
  );

  if (strategy) {
    lines.push("", "## Strategy", "");
    if (strategy.priorityBuyers?.length) {
      lines.push(`- **Priority buyers:** ${strategy.priorityBuyers.join(", ")}`);
    }
    if (strategy.ignore?.length) {
      lines.push(`- **Ignore:** ${strategy.ignore.join(", ")}`);
    }
    if (strategy.recommendedChannels?.length) {
      lines.push(`- **Channels:** ${strategy.recommendedChannels.join(", ")}`);
    }
    if (strategy.recommendedSearchSignals?.length) {
      lines.push(`- **Search signals:** ${strategy.recommendedSearchSignals.join(", ")}`);
    }
  }

  if (mission.notes) {
    lines.push("", "## Notes", "", mission.notes);
  }

  return `${lines.join("\n")}\n`;
}

export function summarizeMissionRegistry(missions = []) {
  const active = missions.filter((row) => row.status === "active");
  const lines = [
    "# Mission Registry Summary",
    "",
    `- **Total missions:** ${missions.length}`,
    `- **Active missions:** ${active.length}`,
    "",
  ];

  for (const mission of missions) {
    lines.push(`## ${mission.name || mission.missionId} (${mission.status})`);
    lines.push(`- Goal: ${mission.goal}`);
    lines.push(`- Offers: ${(mission.offers || []).join(", ") || "none"}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
