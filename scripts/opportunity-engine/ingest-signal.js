#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { ingestManualObservation } from "../../src/engine/signals/ingest-manual.js";
import { getSignalRegistrySummary } from "../../src/engine/signals/index.js";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function printUsage() {
  console.log(`Usage:
  node scripts/opportunity-engine/ingest-signal.js \\
    --source manual \\
    --type company_news \\
    --headline "ABC Manufacturing announces new facility." \\
    --summary "Company investing $40M in Beaumont." \\
    --location "Beaumont, TX"

Options:
  --file         Path to observation text file (stored immutably in engine-data/signals/raw/)
  --source       Source identifier (default: manual)
  --type         Signal type hint (canonical types or unknown)
  --headline     Required unless --file contains content and headline inferred
  --summary      Optional summary
  --url          Optional source URL
  --location     Location string, e.g. "Beaumont, TX"
  --latitude     Optional latitude
  --longitude    Optional longitude
`);
}

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printUsage();
  process.exit(0);
}

if (!args.headline && !args.file) {
  printUsage();
  console.error("Error: --headline or --file is required.");
  process.exit(1);
}

const input = {
  source: args.source || "manual",
  signalType: args.type || "unknown",
  headline: args.headline || `Manual observation ${randomUUID()}`,
  summary: args.summary || args.headline || "",
  url: args.url || null,
  location: args.location || null,
  latitude: args.latitude ? Number(args.latitude) : null,
  longitude: args.longitude ? Number(args.longitude) : null,
  filePath: args.file ? join(process.cwd(), args.file) : null,
};

try {
  const result = await ingestManualObservation(input);
  const summary = await getSignalRegistrySummary();

  console.log("Observation archived.");
  console.log(`Raw: ${result.rawTextRef}`);
  console.log(`Signal: ${result.signal.id}`);
  console.log(`Type: ${result.signal.signalType}`);
  console.log(`State: ${result.signal.processingState}`);
  console.log(`Classification: ${result.classification.method} (${result.classification.confidence})`);
  console.log("");
  console.log("Registry summary:");
  console.log(`  Total signals: ${summary.totalSignals}`);
  console.log(`  Signals today: ${summary.signalsToday}`);
  console.log(`  Classification rate: ${summary.classificationRate}`);
  console.log(`  Normalization rate: ${summary.normalizationRate}`);
} catch (error) {
  console.error(`Ingest failed: ${error.message}`);
  process.exit(1);
}
