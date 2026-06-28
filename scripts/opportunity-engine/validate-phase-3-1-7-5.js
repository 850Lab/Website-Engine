import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  clearEventStoreForTests,
  getEventsByType,
  initializeEventStore,
} from "../../src/engine/events/index.js";
import {
  clearJobStoreForTests,
  createJob,
  getJob,
  initializeJobStore,
} from "../../src/engine/jobs/index.js";
import {
  validateOpenClawJob,
  verifyOwnerApproval,
  enforceFileScope,
  runCommand,
  runCommands,
  runOpenClawBuilderJob,
  createOpenClawReport,
  hashCanonicalPromptText,
  deriveOpenClawIdempotencyKey,
  verifyOpenClawIdempotency,
  resolveAndVerifyPromptHash,
  validateCommandAllowlist,
  isValidationDemoAllowed,
  loadPromptArtifact,
} from "../../src/engine/openclaw/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DEMO_PROMPT_PATH = "engine-data/openclaw/prompts/demo-phase-3-1-7.json";
const errors = [];

process.env.OPENCLAW_ALLOW_VALIDATION_DEMO = "1";

function fail(message) {
  errors.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const { artifact: demoArtifact } = await loadPromptArtifact(DEMO_PROMPT_PATH);
const demoPromptHash = hashCanonicalPromptText(demoArtifact.promptText);
const demoIdempotencyKey = deriveOpenClawIdempotencyKey({
  phaseId: demoArtifact.phaseId,
  jobType: "openclaw.build",
  promptHash: demoPromptHash,
});

function buildMinimalOpenClaw(overrides = {}) {
  const promptHash = overrides.promptHash ?? demoPromptHash;
  const phaseId = overrides.phaseId ?? demoArtifact.phaseId;
  const jobType = overrides.jobType ?? "openclaw.build";
  const idempotencyKey =
    overrides.idempotencyKey ??
    deriveOpenClawIdempotencyKey({ phaseId, jobType, promptHash });

  return {
    id: `openclaw_test_${randomUUID().slice(0, 8)}`,
    jobType,
    phaseId,
    title: "Test Job",
    objective: "Test objective",
    promptArtifactPath: DEMO_PROMPT_PATH,
    ownerApproval: {
      approvedBy: "owner",
      approvedAt: new Date().toISOString(),
      approvalSource: "validation_demo",
      phaseDocStatus: "VALIDATION_DEMO",
      phaseId,
      promptHash,
      promptExcerpt: "validation",
      ...(overrides.ownerApproval || {}),
    },
    agentRole: "builder",
    scope: { phaseId, summary: "test" },
    constraints: { noMissionControlChanges: true, noScoreCouncilChanges: true },
    requiredReading: ["docs/opportunity-os/30-openclaw-job-schema.md"],
    allowedFiles: ["scripts/openclaw/**"],
    forbiddenFiles: ["runtime/**"],
    requiredCommands: [],
    validationCommands: ["node --version"],
    expectedOutputs: [],
    commitPolicy: { enabled: false, maxCommits: 0 },
    reportPolicy: { required: true, pathPattern: "reports/openclaw/openclaw-{phaseId}-{jobId}.md" },
    stopConditions: ["validation_failure"],
    idempotencyKey,
    promptHash,
    ...overrides,
  };
}

async function assertNoForbiddenPatterns() {
  const files = [
    "src/engine/openclaw/worker.js",
    "src/engine/openclaw/command-runner.js",
    "scripts/openclaw/run-builder-job.js",
  ];
  const banned = [/\bsetInterval\s*\(/, /scheduler/i, /runConnector\s*\(/, /openclaw\.execution/i, /while\s*\(\s*true\s*\)/];

  for (const rel of files) {
    const source = await readFile(join(ROOT, rel), "utf8");
    for (const pattern of banned) {
      if (pattern.test(source)) {
        fail(`${rel} contains forbidden pattern ${pattern}`);
      }
    }
  }
  pass("OpenClaw worker has no scheduler, loop, or live connectors");
}

await initializeEventStore();
await initializeJobStore();
if (process.env.OPENCLAW_WORKER_RUN !== "1") {
  await clearEventStoreForTests();
  await clearJobStoreForTests();
}

if (hashCanonicalPromptText(demoArtifact.promptText) !== demoPromptHash) {
  fail("Prompt hash helper failed");
} else {
  pass("Prompt hash helper works");
}

const promptMismatch = await resolveAndVerifyPromptHash(
  buildMinimalOpenClaw({ promptHash: "sha256:deadbeef" }),
  { allowValidationDemo: true, promptArtifactPath: DEMO_PROMPT_PATH },
);
if (promptMismatch.ok) {
  fail("Prompt hash mismatch should hard-stop");
} else {
  pass("Prompt hash mismatch hard-stops");
}

const promptOk = await resolveAndVerifyPromptHash(buildMinimalOpenClaw(), {
  allowValidationDemo: true,
  promptArtifactPath: DEMO_PROMPT_PATH,
});
if (!promptOk.ok) {
  fail(`Valid prompt hash should pass: ${promptOk.detail}`);
} else {
  pass("Valid prompt hash passes");
}

delete process.env.OPENCLAW_ALLOW_VALIDATION_DEMO;
const demoRejected = await verifyOwnerApproval(buildMinimalOpenClaw());
process.env.OPENCLAW_ALLOW_VALIDATION_DEMO = "1";
if (demoRejected.ok) {
  fail("VALIDATION_DEMO should be rejected by default");
} else {
  pass("VALIDATION_DEMO rejected by default");
}

const demoAllowed = await verifyOwnerApproval(buildMinimalOpenClaw(), { allowValidationDemo: true });
if (!demoAllowed.ok) {
  fail(`VALIDATION_DEMO should pass with explicit validation mode: ${demoAllowed.detail}`);
} else {
  pass("VALIDATION_DEMO allowed only in explicit validation mode");
}

const approvalPhaseMismatch = await verifyOwnerApproval(
  buildMinimalOpenClaw({
    ownerApproval: {
      phaseId: "9.9.9",
      promptHash: demoPromptHash,
    },
  }),
  { allowValidationDemo: true },
);
if (approvalPhaseMismatch.ok) {
  fail("Approval should require matching phaseId");
} else {
  pass("Approval requires phaseId match");
}

const idempotencyBad = verifyOpenClawIdempotency(buildMinimalOpenClaw({ idempotencyKey: "wrong" }));
if (idempotencyBad.ok) {
  fail("Idempotency formula should be enforced");
} else {
  pass("Idempotency formula enforced");
}

const unsafe = validateCommandAllowlist("node -e process.exit(1)");
if (unsafe.allowed) {
  fail("Unsafe node -e command should be rejected");
} else {
  pass("Unsafe commands rejected before execution");
}

const unsafeChain = validateCommandAllowlist("node --version && node --version");
if (unsafeChain.allowed) {
  fail("Chained commands should be rejected");
} else {
  pass("Chained commands rejected before execution");
}

const allowed = validateCommandAllowlist("node --version");
if (!allowed.allowed) {
  fail("Allowed node command should pass allowlist");
} else {
  pass("Allowed commands still pass allowlist");
}

const cmdOk = await runCommand("node --version");
if (!cmdOk.ok || cmdOk.rejected) {
  fail("Command runner should run allowed commands");
} else {
  pass("Allowed commands still run");
}

const cmdRejected = await runCommand("node -e process.exit(1)");
if (!cmdRejected.rejected) {
  fail("Command runner should reject unsafe commands before execution");
} else {
  pass("Command runner rejects unsafe commands before execution");
}

const report = createOpenClawReport({
  genericJobId: "job_generic",
  openclawJobId: "openclaw_test",
  jobId: "job_generic",
  phaseId: "3.1.7",
  agentRole: "builder",
  objective: "demo",
  status: "completed",
  promptHash: demoPromptHash,
  idempotencyKey: demoIdempotencyKey,
  correlationId: "corr_test",
  approvalVerification: "prompt_hash_verified",
  promptArtifactPath: DEMO_PROMPT_PATH,
  commandResults: [{ command: "node --version", ok: true, exitCode: 0 }],
  validationResults: [{ command: "node --version", ok: false, exitCode: 1, stderr: "fail output" }],
  changedFiles: [],
  scopeResult: { ok: true, violations: [] },
  eventIds: ["evt_1", "evt_2"],
  gitStatusSummary: "clean",
  stopReason: "completed",
  completedAt: new Date().toISOString(),
  openclawJob: buildMinimalOpenClaw(),
});
for (const field of [
  "generic job id",
  "OpenClaw job id",
  "promptHash",
  "idempotencyKey",
  "correlationId",
  "Owner Approval",
  "Events Emitted",
  "stop reason",
  "stderr",
]) {
  if (!report.includes(field) && field !== "stderr" && !report.includes("stderr:")) {
    if (field === "stderr" && !report.includes("stderr:")) {
      fail(`Report missing forensic field: ${field}`);
    } else if (field !== "stderr") {
      fail(`Report missing forensic field: ${field}`);
    }
  }
}
if (!report.includes("stderr:")) {
  fail("Report missing stderr on failure");
} else {
  pass("Reports contain forensic fields");
}

if (process.env.OPENCLAW_WORKER_RUN === "1") {
  if (errors.length) {
    console.error(`\nPhase 3.1.7.5 validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }
  console.log("\nPhase 3.1.7.5 quick validation passed (worker context).");
  process.exit(0);
}

const notFound = await runOpenClawBuilderJob("job_missing_" + randomUUID());
if (!(await getEventsByType("openclaw.job.not_found")).length) {
  fail("job-not-found should emit event");
} else {
  pass("job-not-found emits event");
}
if (!(await getEventsByType("openclaw.job.failed")).some((row) => row.payload?.reason === "job_not_found")) {
  fail("job-not-found should emit openclaw.job.failed");
} else {
  pass("Terminal failures emit openclaw.job.failed");
}
if (!(await getEventsByType("openclaw.job.stopped")).some((row) => row.payload?.reason === "job_not_found")) {
  fail("job-not-found should emit openclaw.job.stopped");
} else {
  pass("Terminal failures emit openclaw.job.stopped");
}

let demoJobId = null;
try {
  const { stdout } = await execFileAsync(process.execPath, [join(ROOT, "scripts/openclaw/create-demo-builder-job.js")], {
    cwd: ROOT,
    env: { ...process.env, OPENCLAW_ALLOW_VALIDATION_DEMO: "1" },
  });
  demoJobId = JSON.parse(stdout.trim()).jobId;
  pass("Demo builder job can be created");
} catch (error) {
  fail(`create-demo-builder-job.js failed: ${error.message}`);
}

if (demoJobId) {
  const workerResult = await runOpenClawBuilderJob(demoJobId, { allowValidationDemo: true });
  if (workerResult.status !== "completed") {
    fail(`Worker did not complete demo job: ${workerResult.errors.join("; ")}`);
  } else {
    pass("Worker completes hardened demo job");
  }
}

await assertNoForbiddenPatterns();

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-3-1-7.js")], {
    cwd: ROOT,
    env: { ...process.env, OPENCLAW_ALLOW_VALIDATION_DEMO: "1", OPENCLAW_WORKER_RUN: process.env.OPENCLAW_WORKER_RUN || "" },
  });
  pass("Phase 3.1.7 regression passes");
} catch (error) {
  fail(`validate-phase-3-1-7.js regression failed: ${error.message}`);
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-3-1.js")], {
    cwd: ROOT,
    env: { ...process.env, OPENCLAW_WORKER_RUN: process.env.OPENCLAW_WORKER_RUN || "" },
  });
  pass("Phase 3.1 regression passes");
} catch (error) {
  fail(`validate-phase-3-1.js regression failed: ${error.message}`);
}

if (errors.length) {
  console.error(`\nPhase 3.1.7.5 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 3.1.7.5 validation passed.");
console.log("OpenClaw security hardening complete. STOP.");
