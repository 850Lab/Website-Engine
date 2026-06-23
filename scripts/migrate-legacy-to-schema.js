#!/usr/bin/env node
import { runMigration, printReportSummary } from "./migration/index.js";

function parseArgs(argv) {
  const write = argv.includes("--write");
  const backup = argv.includes("--backup");
  const help = argv.includes("--help") || argv.includes("-h");

  return { write, backup, help };
}

function printHelp() {
  console.log(`Usage: node scripts/migrate-legacy-to-schema.js [options]

Options:
  --dry-run   Validate and write data/migration/report.json only (default)
  --write     Write schema JSON files under data/*.json
  --backup    Backup existing schema files before --write
  --help      Show this help

Dry-run never modifies production schema files.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.write) {
    console.log("Running migration in WRITE mode...");
  } else {
    console.log("Running migration in DRY-RUN mode (report only)...");
  }

  const result = await runMigration({
    write: args.write,
    backup: args.backup,
  });

  printReportSummary(result.report);

  console.log(`\nReport: ${result.reportPath}`);
  console.log(`ID map: ${result.idMapPath}`);

  if (!args.write) {
    console.log("\nDry-run complete. Re-run with --write to persist schema files.");
  }

  process.exit(result.readyToWrite ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
