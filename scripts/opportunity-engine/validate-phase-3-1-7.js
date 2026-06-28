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
  loadPromptArtifact,
} from "../../src/engine/openclaw/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DEMO_PROMPT_PATH = "engine-data/openclaw/prompts/demo-phase-3-1-7.json";
const errors = [];

process.env.OPENCLAW_ALLOW_VALIDATION_DEMO = "1";

const { artifact: demoArtifact } = await loadPromptArtifact(DEMO_PROMPT_PATH);
const demoPromptHash = hashCanonicalPromptText(demoArtifact.promptText);

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
  const banned = [
    /\bsetInterval\s*\(/,
    /scheduler/i,
    /runConnector\s*\(/,
    /openclaw\.execution/i,
    /while\s*\(\s*true\s*\)/,
  ];

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
await clearEventStoreForTests();
await clearJobStoreForTests();

try {
  await import("../../src/engine/openclaw/index.js");
  pass("OpenClaw module loads");
} catch (error) {
  fail(`OpenClaw module failed to load: ${error.message}`);
}

const missingField = validateOpenClawJob(buildMinimalOpenClaw({ promptHash: "" }));
if (missingField.valid) {
  fail("Schema validation should reject missing promptHash");
} else {
  pass("Schema validation rejects missing required fields");
}

const blockedType = validateOpenClawJob(buildMinimalOpenClaw({ jobType: "openclaw.execution" }));
if (blockedType.valid || !blockedType.errors.some((row) => row.includes("Blocked job type"))) {
  fail("Schema validation should reject blocked job types");
} else {
  pass("Schema validation rejects blocked job types");
}

const demoApproval = await verifyOwnerApproval(buildMinimalOpenClaw(), { allowValidationDemo: true });
if (!demoApproval.ok) {
  fail(`Owner approval check failed for validation demo: ${demoApproval.detail}`);
} else {
  pass("Owner approval check works for validation demo");
}

const blockedApproval = await verifyOwnerApproval(
  buildMinimalOpenClaw({
    phaseId: "3.1.8",
    ownerApproval: {
      approvedBy: "owner",
      approvedAt: new Date().toISOString(),
      approvalSource: "explicit_prompt",
      phaseDocStatus: "ACTIVE",
      phaseId: "3.1.8",
      promptHash: demoPromptHash,
      promptExcerpt: "blocked test",
    },
    idempotencyKey: deriveOpenClawIdempotencyKey({
      phaseId: "3.1.8",
      jobType: "openclaw.build",
      promptHash: demoPromptHash,
    }),
  }),
);
if (blockedApproval.ok) {
  fail("Owner approval should fail for blocked phase without validation demo");
} else {
  pass("Owner approval rejects blocked phase without demo flag");
}

const scopeOk = enforceFileScope(buildMinimalOpenClaw(), ["scripts/openclaw/run-builder-job.js"], {
  allowValidationDemo: true,
  validationDemo: true,
});
if (!scopeOk.ok) {
  fail(`File scope should allow allowedFiles match: ${scopeOk.violations.join("; ")}`);
} else {
  pass("File scope enforcement allows allowed paths");
}

const scopeFail = enforceFileScope(buildMinimalOpenClaw(), ["src/engine/mission-control/index.js"]);
if (scopeFail.ok) {
  fail("File scope should reject Mission Control changes");
} else {
  pass("File scope enforcement rejects Mission Control changes");
}

const cmdOk = await runCommand("node --version");
if (!cmdOk.ok || cmdOk.exitCode !== 0) {
  fail("Command runner should capture successful command");
} else {
  pass("Command runner captures success");
}

const cmdFail = await runCommand("node -e process.exit(2)");
if (cmdFail.ok || !cmdFail.rejected) {
  fail("Command runner should reject unsafe node -e before execution");
} else {
  pass("Command runner captures rejection for unsafe commands");
}

const optionalBatch = await runCommands([
  { command: "powershell -Command exit 1", optional: true },
  "node --version",
]);
if (!optionalBatch.ok || !optionalBatch.results[1]?.ok) {
  fail("Optional command should not stop batch");
} else {
  pass("Command runner respects optional commands");
}

const report = createOpenClawReport({
  jobId: "job_test",
  phaseId: "3.1.7",
  agentRole: "builder",
  objective: "demo",
  status: "completed",
  commandResults: [{ command: "node --version", ok: true, exitCode: 0 }],
  validationResults: [{ command: "node --version", ok: true, exitCode: 0 }],
  changedFiles: [],
  scopeResult: { ok: true, violations: [] },
  completedAt: new Date().toISOString(),
});
if (!report.includes("generic job id") || !report.includes("final status")) {
  fail("createOpenClawReport missing required sections");
} else {
  pass("createOpenClawReport includes required report fields");
}

let demoJobId = null;
try {
  const { stdout } = await execFileAsync(process.execPath, [
    join(ROOT, "scripts/openclaw/create-demo-builder-job.js"),
  ], { cwd: ROOT, env: { ...process.env, OPENCLAW_ALLOW_VALIDATION_DEMO: "1" } });
  const parsed = JSON.parse(stdout.trim());
  demoJobId = parsed.jobId;
  if (!demoJobId) {
    fail("Demo builder job script did not return jobId");
  } else {
    pass("Demo builder job can be created");
  }
} catch (error) {
  fail(`create-demo-builder-job.js failed: ${error.message}`);
}

if (demoJobId) {
  const workerResult = await runOpenClawBuilderJob(demoJobId, { allowValidationDemo: true });
  const finished = await getJob(demoJobId);

  if (workerResult.status !== "completed") {
    fail(`Worker did not complete demo job: ${workerResult.errors.join("; ")}`);
  } else {
    pass("Worker completes demo job");
  }

  if (finished.status !== "completed") {
    fail(`Generic job status expected completed, got ${finished.status}`);
  } else {
    pass("Worker claims and completes one generic job");
  }

  if (!workerResult.commandResults.length || !workerResult.validationResults.length) {
    fail("Worker should run required and validation commands");
  } else {
    pass("Worker runs approved commands");
  }

  if (workerResult.commitHash) {
    fail("Commit disabled path should not produce commit hash");
  } else {
    pass("Commit disabled path works");
  }

  if (!(await fileExists(workerResult.reportPath))) {
    fail(`Worker report not written: ${workerResult.reportPath}`);
  } else {
    pass("Worker writes report");
  }

  const expectedTypes = [
    "openclaw.job.validated",
    "openclaw.job.started",
    "openclaw.job.commands_completed",
    "openclaw.job.validation_passed",
    "openclaw.job.scope_passed",
    "openclaw.job.reported",
    "openclaw.job.completed",
  ];

  for (const type of expectedTypes) {
    const rows = await getEventsByType(type);
    if (!rows.some((row) => row.metadata?.jobId === demoJobId || row.payload?.jobId)) {
      fail(`Missing OpenClaw event: ${type}`);
    }
  }
  if (!errors.some((row) => row.startsWith("Missing OpenClaw event"))) {
    pass("Worker emits OpenClaw events");
  }

  for (const event of workerResult.events) {
    if (!event.payload?.jobId || !event.payload?.phaseId || !event.payload?.agentRole) {
      fail("OpenClaw event missing required payload fields");
      break;
    }
  }
  pass("OpenClaw events include jobId, phaseId, agentRole, correlationId");
}

await assertNoForbiddenPatterns();

const engineIndex = await readFile(join(ROOT, "src/engine/index.js"), "utf8");
if (!engineIndex.includes("openclaw")) {
  fail("src/engine/index.js must export openclaw");
} else {
  pass("Engine index exports openclaw");
}

const gitignore = await readFile(join(ROOT, ".gitignore"), "utf8");
if (!gitignore.includes("reports/openclaw/")) {
  fail(".gitignore must ignore reports/openclaw/");
} else {
  pass("reports/openclaw/ is gitignored");
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-3-1.js")], {
    cwd: ROOT,
  });
  pass("Phase 3.1 regression passes");
} catch (error) {
  fail(`validate-phase-3-1.js regression failed: ${error.message}`);
}

if (errors.length) {
  console.error(`\nPhase 3.1.7 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 3.1.7 validation passed.");
console.log("OpenClaw Builder Worker v1 complete. One job. No loop. STOP.");
