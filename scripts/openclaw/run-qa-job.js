#!/usr/bin/env node
import { runOpenClawQaJob } from "../../src/engine/openclaw/index.js";

function parseArgs(argv) {
  const args = { jobId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--job" && argv[index + 1]) {
      args.jobId = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--job=")) {
      args.jobId = arg.slice("--job=".length);
    }
  }
  return args;
}

const { jobId } = parseArgs(process.argv.slice(2));

if (!jobId) {
  console.error("Usage: node scripts/openclaw/run-qa-job.js --job <jobId>");
  process.exit(1);
}

const result = await runOpenClawQaJob(jobId);

console.log(
  JSON.stringify(
    {
      jobId: result.jobId,
      status: result.status,
      qaVerdict: result.qaVerdict,
      reportPath: result.reportPath,
      events: result.events.length,
      errors: result.errors,
    },
    null,
    2,
  ),
);

if (result.status !== "completed") {
  process.exit(1);
}
