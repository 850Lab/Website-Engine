import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapValidator, finalizeValidator } from "../../src/engine/validation/index.js";
import { assertEngineDataClean } from "./assert-engine-data-clean.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_JSON = join(ROOT, "reports/backlog-progress-dashboard.json");
const REPORT_MD = join(ROOT, "reports/backlog-progress-dashboard.md");
const FIXED_GENERATED_AT = "2026-06-30T12:00:00.000Z";
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

async function runDashboard() {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/backlog-progress-dashboard.js")], {
    cwd: ROOT,
    env: {
      ...process.env,
      OPPORTUNITY_PROGRESS_GENERATED_AT: FIXED_GENERATED_AT,
    },
  });
}

async function readDashboard() {
  const [jsonRaw, markdown] = await Promise.all([readFile(REPORT_JSON, "utf8"), readFile(REPORT_MD, "utf8")]);
  return { jsonRaw, dashboard: JSON.parse(jsonRaw), markdown };
}

await runDashboard();
const first = await readDashboard();
await runDashboard();
const second = await readDashboard();

if (first.dashboard.generatedAt !== FIXED_GENERATED_AT || second.dashboard.generatedAt !== FIXED_GENERATED_AT) {
  fail("Backlog progress dashboard does not honor deterministic generatedAt override");
} else {
  pass("Backlog progress dashboard honors deterministic generatedAt override");
}

if (first.jsonRaw !== second.jsonRaw || first.markdown !== second.markdown) {
  fail("Backlog progress dashboard output is not deterministic with fixed timestamp");
} else {
  pass("Backlog progress dashboard output is deterministic with fixed timestamp");
}

if (first.dashboard.schemaVersion !== "4.2.progress-dashboard") {
  fail("Backlog progress dashboard schemaVersion missing or incorrect");
} else {
  pass("Backlog progress dashboard includes schemaVersion");
}

if (!first.dashboard.overall?.total || !Number.isInteger(first.dashboard.overall.percent)) {
  fail("Backlog progress dashboard must include overall completion metrics");
} else {
  pass("Backlog progress dashboard includes overall completion metrics");
}

for (const label of ["Engineering", "Business Discovery", "Contact Discovery", "Campaign Engine", "CRM", "Learning"]) {
  if (!first.dashboard.categories?.some((category) => category.label === label)) {
    fail(`Backlog progress dashboard missing category: ${label}`);
  }
}
if (!errors.some((message) => message.includes("missing category"))) {
  pass("Backlog progress dashboard includes major revenue-operating categories");
}

if (!first.dashboard.currentTask?.id && first.dashboard.stopCondition?.type !== "no_unblocked_task") {
  fail("Backlog progress dashboard must include current task selection or explicit no-unblocked-task stop condition");
} else if (first.dashboard.currentTask?.id === "B1") {
  fail("Backlog progress dashboard must not select a task already marked complete");
} else if (!first.dashboard.currentTask?.id && !first.dashboard.blockedTaskIds?.length) {
  fail("Backlog progress dashboard stop condition must include blocked task evidence");
} else if (!first.dashboard.currentTask?.id) {
  pass("Backlog progress dashboard records explicit no-unblocked-task stop condition");
} else {
  pass(`Backlog progress dashboard includes current task ${first.dashboard.currentTask.id}`);
}

if (!first.dashboard.estimates?.tasks || !first.dashboard.estimates?.commits || !first.dashboard.estimates?.engineeringHours) {
  fail("Backlog progress dashboard must include remaining task, commit, and hour estimates");
} else {
  pass("Backlog progress dashboard includes remaining estimates");
}

if (!first.markdown.includes("## Overall Completion") || !first.markdown.includes("## Current Task")) {
  fail("Backlog progress Markdown must render overall completion and current task sections");
} else {
  pass("Backlog progress Markdown renders dashboard sections");
}

for (const reportPath of ["reports/backlog-progress-dashboard.md", "reports/backlog-progress-dashboard.json"]) {
  try {
    await execFileAsync("git", ["check-ignore", reportPath], { cwd: ROOT });
    pass(`${reportPath} is gitignored`);
  } catch {
    fail(`${reportPath} must be gitignored`);
  }
}

const source = await readFile(join(ROOT, "scripts/opportunity-engine/backlog-progress-dashboard.js"), "utf8");
for (const forbidden of ["setInterval", "createServer", "listen(", "runOpenClawBuilderJob", "createJob", "sendEmail"]) {
  if (source.includes(forbidden)) {
    fail(`Backlog progress dashboard contains forbidden service or execution pattern: ${forbidden}`);
  }
}
if (!errors.some((message) => message.includes("forbidden service or execution pattern"))) {
  pass("Backlog progress dashboard is generated reporting only");
}

try {
  await assertEngineDataClean();
  pass("engine-data/ unchanged by backlog progress dashboard validation");
} catch (error) {
  fail(error.message);
}

await finalizeValidator({ phase: "4.2", errors, startedAt: __validationStartedAt });

console.log("\nBacklog progress dashboard validation passed.");
