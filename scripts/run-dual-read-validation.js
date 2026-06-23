#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runDualReadValidation } from "../src/services/dual-read/index.js";
import { useSchemaQueueReads } from "../src/services/feature-flags.js";
import { WEBSITE_QUEUE_SORT_KEYS, PW_QUEUE_SORT_KEYS } from "../src/services/queue-sort.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = join(ROOT, "data", "migration", "dual-read");

async function writeReport(filename, payload) {
  await writeFile(join(OUTPUT_DIR, filename), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function runMode(label) {
  const { validationReport, queueParityReport, mismatchReport } = await runDualReadValidation();
  return {
    label,
    useSchemaQueueReads: useSchemaQueueReads(),
    dualReadValidation: process.env.DUAL_READ_VALIDATION === "1",
    sortKeys: {
      website: WEBSITE_QUEUE_SORT_KEYS,
      pressureWashing: PW_QUEUE_SORT_KEYS,
    },
    validationReport,
    queueParityReport,
    mismatchReport,
  };
}

async function main() {
  const schemaReadsEnabled = process.env.USE_SCHEMA_QUEUE_READS === "1";
  console.log(
    `Running dual-read validation (USE_SCHEMA_QUEUE_READS=${schemaReadsEnabled ? "1" : "0"})...`,
  );

  const result = await runMode(schemaReadsEnabled ? "schema-queue-reads" : "legacy-queue-reads");

  await mkdir(OUTPUT_DIR, { recursive: true });

  const suffix = schemaReadsEnabled ? "schema-reads" : "legacy-reads";
  await Promise.all([
    writeReport(`validation-report.${suffix}.json`, result.validationReport),
    writeReport(`queue-parity-report.${suffix}.json`, result.queueParityReport),
    writeReport(`mismatch-report.${suffix}.json`, result.mismatchReport),
    writeReport("validation-report.json", result.validationReport),
    writeReport("queue-parity-report.json", result.queueParityReport),
    writeReport("mismatch-report.json", result.mismatchReport),
    writeReport("latest-run.json", {
      generatedAt: new Date().toISOString(),
      mode: result.label,
      useSchemaQueueReads: result.useSchemaQueueReads,
      sortKeys: result.sortKeys,
      summary: result.validationReport.summary,
    }),
  ]);

  const website = result.validationReport.queues[0];
  const pw = result.validationReport.queues[1];

  console.log("\nDual-read validation summary");
  console.log("────────────────────────────");
  console.log(`Mode: ${result.label}`);
  console.log(`Website queue: legacy=${website.counts.legacy} schema=${website.counts.schema}`);
  console.log(`  parity: count=${website.parity.countMatch} ids=${website.parity.idSetMatch} order=${website.parity.orderingMatch} state=${website.parity.stateMatch}`);
  console.log(`PW queue: legacy=${pw.counts.legacy} schema=${pw.counts.schema}`);
  console.log(`  parity: count=${pw.parity.countMatch} ids=${pw.parity.idSetMatch} order=${pw.parity.orderingMatch} state=${pw.parity.stateMatch}`);
  console.log(`Total mismatch groups: ${result.mismatchReport.total}`);
  console.log(`\nReports written to ${OUTPUT_DIR}`);
  console.log("\nSort keys:");
  console.log("  Website:", WEBSITE_QUEUE_SORT_KEYS.join(" → "));
  console.log("  PW:", PW_QUEUE_SORT_KEYS.join(" → "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
