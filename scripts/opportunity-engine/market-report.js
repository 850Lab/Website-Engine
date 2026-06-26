import { rankMarkets } from "../../src/engine/markets/index.js";

function money(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

const markets = await rankMarkets();

console.log("\nKTM MARKET OPPORTUNITY REPORT");
console.log("Status: Directional estimates — needs validation\n");

for (const market of markets) {
  console.log(`${market.name}`);
  console.log(`  Revenue potential: ${money(market.estimatedAnnualRevenue)} (${market.confidence || "Assumption"})`);
  console.log(`  Likely contract value: ${money(market.estimatedContractValue)}`);
  console.log(`  Recurring: ${market.recurring ? "Yes" : "No"}`);
  console.log(`  Difficulty: ${market.difficulty}/10`);
  console.log(`  Priority: ${market.priority}/100`);
  console.log(`  Why it matters: ${(market.rationale || []).join(" ") || "Needs market validation."}`);
  console.log(`  Search keywords: ${market.keywords.join(", ")}`);
  console.log("");
}
