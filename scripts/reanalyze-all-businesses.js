import { startReanalyzeBatch } from "../src/angle-analysis/reanalyze-batch.js";

const awaitCompletion = process.argv.includes("--wait");
const fetchLive = process.argv.includes("--live");

console.log("Starting batch reanalysis of all businesses...");
console.log(fetchLive ? "Live website fetch: ON (slower)" : "Live website fetch: OFF (uses stored signals)");

try {
  await startReanalyzeBatch({ fetchLive, awaitCompletion: true });
  const { getBatchState } = await import("../src/angle-analysis/reanalyze-batch.js");
  const state = getBatchState();
  const summary = state.summary;

  if (summary) {
    console.log("\n=== Batch Complete ===");
    console.log("Total analyzed:", summary.totalAnalyzed);
    console.log("Assigned to folders:", summary.totalAssigned);
    console.log("Manual review:", summary.totalManualReview);
    console.log("Errors:", summary.totalErrors);
    if (summary.topFolderByCount) {
      console.log("Top folder:", summary.topFolderByCount.label, "(" + summary.topFolderByCount.count + ")");
    }
    console.log("\nTop 10 hottest:");
    for (const row of summary.topHotBusinesses ?? []) {
      console.log(`  - ${row.business_name} (${row.city}) [${row.priority_label}] ${row.primary_angle}`);
    }
  }

  if (state.errors.length) {
    console.log("\nErrors:");
    for (const err of state.errors.slice(0, 10)) {
      console.log(`  - ${err.businessName || err.businessId}: ${err.error}`);
    }
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
