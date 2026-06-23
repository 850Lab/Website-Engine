import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MIGRATION_DIR } from "./paths.js";

export async function writeMigrationReport(ctx, validation, options = {}) {
  await mkdir(MIGRATION_DIR, { recursive: true });

  const report = {
    mode: options.write ? "write" : "dry-run",
    generatedAt: new Date().toISOString(),
    summary: {
      offers: ctx.offers.length,
      campaigns: ctx.campaigns.length,
      businesses: ctx.businesses.length,
      contacts: ctx.contacts.length,
      opportunities: ctx.opportunities.length,
      opportunitiesByCampaign: ctx.stats.opportunitiesByCampaign,
      queueItems: ctx.queueItems.length,
      openQueueItems: ctx.stats.openQueueItems,
      attempts: ctx.attempts.length,
      crossStoreMerges: ctx.stats.crossStoreMerges,
      skippedQueueNoOpportunity: ctx.stats.skippedQueueNoOpportunity,
      angleAnalysesApplied: ctx.stats.angleAnalysesApplied,
      angleOrphans: ctx.stats.angleOrphans,
      wqsJoinRate:
        ctx.stats.wqsRows === 0
          ? 1
          : Number((ctx.stats.wqsMatched / ctx.stats.wqsRows).toFixed(4)),
      validationPassed: validation.summary.readyToWrite,
      validationScore: validation.summary.passed,
    },
    validation,
    warnings: ctx.warnings,
  };

  const reportPath = join(MIGRATION_DIR, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const idMapPath = join(
    MIGRATION_DIR,
    options.write ? "id-map.json" : "id-map.preview.json",
  );
  await writeFile(
    idMapPath,
    `${JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        entries: ctx.idMap,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return { reportPath, idMapPath, report };
}

export function printReportSummary(report) {
  console.log(`\nMigration ${report.mode} summary`);
  console.log("────────────────────────────");
  for (const [key, value] of Object.entries(report.summary)) {
    console.log(`${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
  }

  const validation = report.validation;
  const criticalFailures = validation.checks.filter((c) => c.critical && !c.pass).length;
  console.log(
    `\nValidation: ${validation.summary.readyToWrite ? "PASSED" : "FAILED"} (${validation.summary.passed}, ${criticalFailures} critical failures)`,
  );

  for (const check of validation.checks) {
    const mark = check.pass ? "✓" : check.critical ? "✗" : "!";
    console.log(`  ${mark} ${check.id}: expected ${check.expected}, actual ${check.actual}`);
  }

  const validationErrors = validation.validationErrors ?? {};
  const errorCount = Object.values(validationErrors).reduce((n, arr) => n + arr.length, 0);
  if (errorCount) {
    console.log(`\nSchema validation errors: ${errorCount}`);
    for (const [collection, errors] of Object.entries(validationErrors)) {
      if (!errors.length) continue;
      console.log(`  ${collection}: ${errors.length}`);
      for (const err of errors.slice(0, 3)) {
        console.log(`    - ${err.id}: ${err.error}`);
      }
    }
  }

  if (report.warnings?.length) {
    console.log(`\nWarnings (${report.warnings.length}):`);
    for (const warning of report.warnings.slice(0, 20)) {
      console.log(`  - ${typeof warning === "string" ? warning : JSON.stringify(warning)}`);
    }
    if (report.warnings.length > 20) {
      console.log(`  ... and ${report.warnings.length - 20} more`);
    }
  }
}
