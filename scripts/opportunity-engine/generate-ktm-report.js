import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpportunityRadar } from "../../src/engine/intelligence/index.js";
import { rankMarkets } from "../../src/engine/markets/index.js";
import { analyzeMarketFromDatabase } from "../../src/engine/market-analysis/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT = join(ROOT, "reports", "ktm-opportunity-report.md");

function money(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function formatOpportunity(row, index) {
  return [
    `### ${index + 1}. ${row.offer} - ${row.industry || row.market}`,
    `- Buyer: ${row.buyer}`,
    `- Opportunity score: ${row.opportunityScore}/100`,
    `- Estimated revenue potential: ${money(row.estimatedRevenuePotential)} (directional)`,
    `- Contract value estimate: ${money(row.estimatedContractValue)}`,
    `- Businesses found: ${row.businessesFound}`,
    `- Reachable businesses: ${row.reachableBusinesses}`,
    `- Reachable by phone: ${row.reachableByPhone ?? 0}`,
    `- Reachable by email: ${row.reachableByEmail ?? 0}`,
    `- Contact coverage: ${row.contactCoverage}%`,
    `- Database confidence: ${row.databaseConfidence}`,
    `- Recommended next action: ${row.recommendedNextAction}`,
    "",
  ].join("\n");
}

async function buildCommercialConstructionSection() {
  const markets = await rankMarkets();
  const market = markets.find((row) => row.id === "commercial-construction");
  if (!market) return "Commercial Construction market definition was not found in engine data.";

  const analysis = await analyzeMarketFromDatabase(market);

  return [
    "Commercial Construction ranks strongly because the live database already contains contractor trades",
    "and contactable businesses, while institutional buyers still need relationship and procurement work.",
    "",
    `- Database businesses matched: ${analysis.businessesFound}`,
    `- Reachable by phone: ${analysis.reachableByPhone}`,
    `- Reachable by email: ${analysis.reachableByEmail}`,
    `- Contact coverage: ${analysis.contactCoverage}%`,
    `- Database confidence: ${analysis.databaseConfidence}`,
    `- Market rationale: ${(market.rationale || []).join(" ")}`,
  ].join("\n");
}

const allOpportunities = await buildOpportunityRadar();
const ktmOpportunities = allOpportunities.filter((o) => o.offerId === "offer_ktm_manpower");
const topTen = ktmOpportunities.slice(0, 10);
const topKtm = topTen[0] ?? null;
const commercialSection = await buildCommercialConstructionSection();

const summaryLines = topKtm
  ? [
      `Top KTM opportunity: **${topKtm.offer}** in **${topKtm.industry || topKtm.market}**`,
      `(score ${topKtm.opportunityScore}/100, ${money(topKtm.estimatedRevenuePotential)} directional revenue).`,
    ]
  : ["No KTM opportunities were generated from the current database and offer library."];

const markdown = [
  "# KTM Opportunity Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "## Executive Summary",
  "",
  ...summaryLines,
  "",
  "> Revenue and contract estimates in this report are directional unless validated through live sales conversations and signed work.",
  "",
  "## Top 10 Opportunities",
  "",
  topTen.length ? topTen.map(formatOpportunity).join("\n") : "_No KTM opportunities available._",
  "",
  "## Broader OS Radar Note",
  "",
  "The Opportunity OS also ranks Website Growth and Exterior Cleaning opportunities across the same database.",
  "This meeting report is filtered to KTM Manpower and Safety Support (`offer_ktm_manpower`) only.",
  `Full radar size: ${allOpportunities.length} opportunities across all configured offers.`,
  "",
  "## Why Commercial Construction Is Strongest Right Now",
  "",
  commercialSection,
  "",
  "## Database Evidence (Top KTM Opportunity)",
  "",
  topKtm
    ? bulletList([
        `Businesses found: ${topKtm.businessesFound}`,
        `Reachable by phone: ${topKtm.reachableByPhone ?? 0}`,
        `Reachable by email: ${topKtm.reachableByEmail ?? 0}`,
        `Reachable businesses (phone or email): ${topKtm.reachableBusinesses}`,
        `Contact coverage: ${topKtm.contactCoverage}%`,
        `Database confidence: ${topKtm.databaseConfidence}`,
      ])
    : "_No database evidence available._",
  "",
  "## Top Recommended Next Action",
  "",
  topKtm?.recommendedNextAction ||
    "Generate more industry coverage and validate KTM offer fit before outreach.",
  "",
  "## Validation Note",
  "",
  "Use this report to prioritize outreach sequence and conversation targets.",
  "Do not treat revenue potential as closed-won pipeline until opportunities are validated in the field.",
  "",
].join("\n");

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, markdown, "utf8");

console.log(`Wrote ${OUTPUT}`);
console.log(`All opportunities ranked: ${allOpportunities.length}`);
console.log(`KTM opportunities: ${ktmOpportunities.length}`);
console.log(
  `Top KTM opportunity: ${topKtm ? `${topKtm.offer} - ${topKtm.industry || topKtm.market}` : "none"}`,
);
