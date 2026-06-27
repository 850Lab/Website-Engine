import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMissionControl } from "../../src/engine/mission-control/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT = join(ROOT, "reports", "mission-control.md");

function money(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function bulletList(items) {
  if (!items?.length) return "- None";
  return items.map((item) => `- ${item}`).join("\n");
}

function formatOpportunity(row, index) {
  if (!row) return "_None_";
  return [
    `### ${index}. ${row.offer} - ${row.industry || row.market}`,
    `- Score: ${row.opportunityScore}/100`,
    `- Offer ID: ${row.offerId}`,
    `- Est. revenue: ${money(row.estimatedRevenuePotential)} (directional)`,
    `- Reachable businesses: ${row.reachableBusinesses ?? 0}`,
    `- Contact coverage: ${row.contactCoverage ?? 0}%`,
    `- Database confidence: ${row.databaseConfidence}`,
    `- Next action: ${row.recommendedNextAction}`,
    "",
  ].join("\n");
}

const mc = await buildMissionControl();
const top = mc.topOpportunity;
const metrics = mc.metrics;
const evidence = mc.evidence || {};
const scoreSummary = mc.scoreCouncilSummary;

const markdown = [
  "# Mission Control Report",
  "",
  `Generated: ${mc.generatedAt}`,
  "",
  "## Executive Summary",
  "",
  mc.executiveSummary,
  "",
  "## Top Opportunities",
  "",
  formatOpportunity(top, 1),
  ...(mc.radar?.topTen?.slice(1, 10).map((row, index) => formatOpportunity(row, index + 2)) || []),
  "",
  "## Evidence",
  "",
  evidence.summary || "No evidence available.",
  "",
  "### Strengths",
  bulletList(evidence.strengths),
  "",
  "### Weaknesses",
  bulletList(evidence.weaknesses),
  "",
  "### Why Now",
  bulletList(evidence.whyNow),
  "",
  "### Why Not Others",
  bulletList(evidence.whyNotOthers),
  "",
  "### Supporting Evidence",
  bulletList(evidence.evidence),
  "",
  "## Score Breakdown",
  "",
  scoreSummary
    ? [
        `- CEO mode: ${scoreSummary.modeLabel}`,
        `- Composite score: ${scoreSummary.compositeScore}/100`,
        "",
        "### Top Engines",
        bulletList(
          (scoreSummary.topEngines || []).map((row) => `${row.engine}: ${row.score}/100`),
        ),
      ].join("\n")
    : "No score council summary available.",
  "",
  "## Recommended Actions",
  "",
  bulletList((mc.recommendations || []).map((row) => `#${row.priority} ${row.action}`)),
  "",
  "## Revenue Outlook",
  "",
  `- Total estimated revenue potential: ${money(metrics.estimatedRevenuePotential)} (directional)`,
  `- Total estimated contract potential: ${money(metrics.estimatedContractPotential)} (directional)`,
  `- Reachable buyers: ${metrics.reachableBuyers}`,
  `- Average contact coverage: ${metrics.averageContactCoverage}%`,
  "",
  "## Capability Summary",
  "",
  bulletList(
    (mc.catalogs?.capabilities || []).map(
      (row) => `${row.name} (${row.id}) — ${(row.problemsSolved || []).slice(0, 2).join("; ")}`,
    ),
  ),
  "",
  "## Market Summary",
  "",
  bulletList(
    (mc.catalogs?.markets || []).slice(0, 10).map(
      (row) => `${row.name} — priority ${row.priority}/100`,
    ),
  ),
  "",
  "## Open Risks",
  "",
  bulletList((mc.alerts || []).map((row) => `[${row.level}] ${row.message}`)),
  "",
  "## Missing Data",
  "",
  bulletList(evidence.missingData),
  "",
  "## Next Recommended Execution",
  "",
  mc.executionPlan
    ? [
        `- Immediate action: ${mc.executionPlan.immediateAction}`,
        `- Channels: ${(mc.executionPlan.channels || []).join(", ") || "Not specified"}`,
        `- After execution: ${mc.executionPlan.afterExecution?.summary || "Not specified"}`,
      ].join("\n")
    : "No execution plan available.",
  "",
  "---",
  "",
  `Timestamp: ${mc.generatedAt}`,
  "",
].join("\n");

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, markdown, "utf8");
console.log(`Wrote ${OUTPUT}`);
