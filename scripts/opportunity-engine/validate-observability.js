import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapValidator, finalizeValidator } from "../../src/engine/validation/index.js";
import { assertEngineDataClean } from "./assert-engine-data-clean.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_JSON = join(ROOT, "reports/runtime-health.json");
const REPORT_MD = join(ROOT, "reports/runtime-health.md");
const FIXED_GENERATED_AT = "2026-06-30T00:00:00.000Z";
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("4.2");

function fail(message) {
  errors.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function runRuntimeHealth() {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/runtime-health.js")], {
    cwd: ROOT,
    env: {
      ...process.env,
      OPPORTUNITY_HEALTH_GENERATED_AT: FIXED_GENERATED_AT,
    },
  });
}

async function readRuntimeHealthReport() {
  const [jsonRaw, markdown] = await Promise.all([readFile(REPORT_JSON, "utf8"), readFile(REPORT_MD, "utf8")]);
  return { jsonRaw, report: JSON.parse(jsonRaw), markdown };
}

await runRuntimeHealth();
const first = await readRuntimeHealthReport();
await runRuntimeHealth();
const second = await readRuntimeHealthReport();

if (first.report.generatedAt !== FIXED_GENERATED_AT || second.report.generatedAt !== FIXED_GENERATED_AT) {
  fail("Runtime health report does not honor deterministic generatedAt override");
} else {
  pass("Runtime health report honors deterministic generatedAt override");
}

if (first.jsonRaw !== second.jsonRaw || first.markdown !== second.markdown) {
  fail("Runtime health reports are not deterministic across repeated runs with fixed timestamp");
} else {
  pass("Runtime health JSON and Markdown are deterministic with fixed timestamp");
}

if (first.report.schemaVersion !== "4.2.s1") {
  fail("Runtime health report schemaVersion missing or incorrect");
} else {
  pass("Runtime health report includes S1 schemaVersion");
}

if (!Array.isArray(first.report.runtimeStores) || first.report.runtimeStores.length < 10) {
  fail("Runtime health report must include runtime store rows");
} else {
  pass("Runtime health report includes runtime store rows");
}

for (const storeName of ["signals", "jobs", "events", "missions", "engineeringTasks"]) {
  if (!first.report.runtimeStores.some((row) => row.name === storeName && Number.isInteger(row.count))) {
    fail(`Runtime health report missing count for ${storeName}`);
  }
}
if (!errors.some((message) => message.includes("Runtime health report missing count"))) {
  pass("Runtime health report includes key store counts");
}

if (first.report.reportPolicy?.gitignored !== true) {
  fail("Runtime health report policy must confirm generated reports are gitignored");
} else {
  pass("Runtime health report policy confirms generated reports are gitignored");
}

for (const reportPath of ["reports/runtime-health.md", "reports/runtime-health.json"]) {
  try {
    await execFileAsync("git", ["check-ignore", reportPath], { cwd: ROOT });
    pass(`${reportPath} is gitignored`);
  } catch {
    fail(`${reportPath} must be gitignored`);
  }
}

if (!first.markdown.includes("## Runtime Stores") || !first.markdown.includes("## Generated Report Policy")) {
  fail("Runtime health Markdown must render store and report policy sections");
} else {
  pass("Runtime health Markdown renders store and report policy sections");
}

const source = await readFile(join(ROOT, "scripts/opportunity-engine/runtime-health.js"), "utf8");
for (const forbidden of ["setInterval", "createServer", "listen(", "runOpenClawBuilderJob", "sendEmail"]) {
  if (source.includes(forbidden)) {
    fail(`Runtime health observability contains forbidden live-service or execution pattern: ${forbidden}`);
  }
}
if (!errors.some((message) => message.includes("forbidden live-service or execution pattern"))) {
  pass("Runtime health observability does not add daemon, service, OpenClaw, or outreach behavior");
}

try {
  await assertEngineDataClean();
  pass("engine-data/ unchanged by observability validation");
} catch (error) {
  fail(error.message);
}

await finalizeValidator({ phase: "4.2", errors, startedAt: __validationStartedAt });

console.log("\nObservability validation passed.");
