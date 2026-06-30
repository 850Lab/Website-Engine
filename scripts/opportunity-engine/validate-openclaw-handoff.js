import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapValidator, finalizeValidator } from "../../src/engine/validation/index.js";
import {
  createEngineeringTask,
  createOpenClawHandoffPackage,
  validateOpenClawHandoffPackage,
} from "../../src/engine/founder-intent/index.js";
import { clearJobStoreForTests, listJobs } from "../../src/engine/jobs/index.js";
import { validateOpenClawJob, verifyOpenClawIdempotency } from "../../src/engine/openclaw/index.js";
import { assertEngineDataClean } from "./assert-engine-data-clean.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
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

await clearJobStoreForTests();

const approvedTask = createEngineeringTask({
  taskId: "engtask_openclaw_handoff_validation",
  title: "Build validation-only bounded task",
  phase: "4.2",
  problem: "Create a bounded validation fixture for OpenClaw handoff package generation.",
  scope: {
    allowedPaths: ["src/engine/founder-intent/", "scripts/opportunity-engine/", "docs/opportunity-os/"],
    forbiddenPaths: ["src/engine/openclaw/", "src/engine/processor/"],
  },
  acceptanceCriteria: ["Handoff package validates", "No jobs are dispatched", "No OpenClaw worker is run"],
  openClawEligible: true,
  status: "approved",
  metadata: {
    approvedBy: "owner",
    approvedAt: "2026-06-30T00:00:00.000Z",
  },
});
approvedTask.validationCommands = [
  "node scripts/opportunity-engine/validate-openclaw-handoff.js",
  "node scripts/opportunity-engine/validate-phase-4-2.js",
];
approvedTask.expectedOutputs = ["src/engine/founder-intent/openclaw-handoff.js"];

const beforeJobs = await listJobs();
const handoff = createOpenClawHandoffPackage(approvedTask, {
  createdAt: "2026-06-30T00:00:01.000Z",
});

const handoffValidation = validateOpenClawHandoffPackage(handoff);
if (!handoffValidation.valid) {
  fail(`OpenClaw handoff package failed validation: ${handoffValidation.errors.join("; ")}`);
} else {
  pass("OpenClaw handoff package validates");
}

const schemaValidation = validateOpenClawJob(handoff.openclawJob);
if (!schemaValidation.valid) {
  fail(`Generated OpenClaw job schema is invalid: ${schemaValidation.errors.join("; ")}`);
} else {
  pass("Generated OpenClaw job validates against OpenClaw schema");
}

const idempotency = verifyOpenClawIdempotency(handoff.openclawJob);
if (!idempotency.ok) {
  fail(`OpenClaw handoff idempotency failed: ${idempotency.detail}`);
} else {
  pass("OpenClaw handoff uses canonical idempotency key");
}

if (handoff.dispatchAllowed !== false || handoff.runAllowed !== false) {
  fail("OpenClaw handoff package must explicitly disable dispatch and run");
} else {
  pass("OpenClaw handoff package disables dispatch and run");
}

if (handoff.genericJobDraft?.metadata?.handoffOnly !== true || !handoff.genericJobDraft?.metadata?.openclaw) {
  fail("OpenClaw handoff must produce a handoff-only generic job draft");
} else {
  pass("OpenClaw handoff produces a handoff-only generic job draft");
}

if (handoff.openclawJob.allowedFiles.some((path) => path.includes("src/engine/openclaw"))) {
  fail("OpenClaw handoff must not expand OpenClaw source permissions");
} else {
  pass("OpenClaw handoff does not expand OpenClaw source permissions");
}

if (!handoff.openclawJob.forbiddenFiles.includes("runtime/**")) {
  fail("OpenClaw handoff must forbid runtime commits");
} else {
  pass("OpenClaw handoff forbids runtime commits");
}

const afterJobs = await listJobs();
if (afterJobs.length !== beforeJobs.length) {
  fail("OpenClaw handoff package must not create or dispatch generic jobs");
} else {
  pass("OpenClaw handoff does not create or dispatch jobs");
}

let unapprovedRejected = false;
try {
  createOpenClawHandoffPackage({ ...approvedTask, status: "proposed" });
} catch {
  unapprovedRejected = true;
}
if (!unapprovedRejected) {
  fail("OpenClaw handoff should reject unapproved engineering tasks");
} else {
  pass("OpenClaw handoff rejects unapproved engineering tasks");
}

let noneligibleRejected = false;
try {
  createOpenClawHandoffPackage({ ...approvedTask, openClawEligible: false });
} catch {
  noneligibleRejected = true;
}
if (!noneligibleRejected) {
  fail("OpenClaw handoff should reject noneligible engineering tasks");
} else {
  pass("OpenClaw handoff rejects noneligible engineering tasks");
}

const source = await readFile(join(ROOT, "src/engine/founder-intent/openclaw-handoff.js"), "utf8");
for (const forbidden of ["createJob", "runOpenClawBuilderJob", "claimJob", "processNextJob", "dispatchNextJob", "sendEmail"]) {
  if (source.includes(forbidden)) {
    fail(`OpenClaw handoff generator contains forbidden execution pattern: ${forbidden}`);
  }
}
if (!errors.some((message) => message.includes("forbidden execution pattern"))) {
  pass("OpenClaw handoff generator does not run, dispatch, or execute jobs");
}

try {
  await assertEngineDataClean();
  pass("engine-data/ unchanged by OpenClaw handoff validation");
} catch (error) {
  fail(error.message);
}

await finalizeValidator({ phase: "4.2", errors, startedAt: __validationStartedAt });

console.log("\nOpenClaw handoff validation passed.");
