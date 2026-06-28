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
  validateQaJob,
  validateQaCommandAllowlist,
  runCommand,
  runOpenClawQaJob,
  evaluateExpectedOutputs,
  createOpenClawQaReport,
  hashCanonicalPromptText,
  deriveOpenClawIdempotencyKey,
  loadPromptArtifact,
} from "../../src/engine/openclaw/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DEMO_PROMPT_PATH = "engine-data/openclaw/prompts/demo-phase-3-1-8.json";
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

function buildMinimalQaJob(overrides = {}) {
  const promptHash = overrides.promptHash ?? demoPromptHash;
  const phaseId = overrides.phaseId ?? demoArtifact.phaseId;
  const idempotencyKey = deriveOpenClawIdempotencyKey({
    phaseId,
    jobType: "openclaw.qa",
    promptHash,
  });

  return {
    id: `openclaw_qa_${randomUUID().slice(0, 8)}`,
    jobType: "openclaw.qa",
    phaseId,
    title: "QA Test Job",
    objective: "QA test objective",
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
    agentRole: "qa",
    requiredReading: ["docs/opportunity-os/30-openclaw-job-schema.md"],
    validationCommands: ["node --version"],
    expectedOutputs: [{ type: "commandExitCodeZero" }],
    commitPolicy: { enabled: false, maxCommits: 0 },
    reportPolicy: {
      required: true,
      pathPattern: "reports/openclaw/openclaw-qa-{phaseId}-{jobId}.md",
    },
    stopConditions: ["validation_failure"],
    idempotencyKey,
    promptHash,
    ...overrides,
  };
}

async function assertNoForbiddenPatterns() {
  const files = ["src/engine/openclaw/qa-worker.js", "scripts/openclaw/run-qa-job.js"];
  const banned = [/\bsetInterval\s*\(/, /scheduler/i, /runConnector\s*\(/, /openclaw\.execution/i, /while\s*\(\s*true\s*\)/];

  for (const rel of files) {
    const source = await readFile(join(ROOT, rel), "utf8");
    for (const pattern of banned) {
      if (pattern.test(source)) {
        fail(`${rel} contains forbidden pattern ${pattern}`);
      }
    }
  }
  pass("No scheduler, loop, connectors, or OpenClaw Execution");
}

await initializeEventStore();
await initializeJobStore();
if (process.env.OPENCLAW_WORKER_RUN !== "1") {
  await clearEventStoreForTests();
  await clearJobStoreForTests();
}

try {
  await import("../../src/engine/openclaw/index.js");
  pass("QA worker module loads");
} catch (error) {
  fail(`QA module failed to load: ${error.message}`);
}

const builderRejected = validateQaJob(buildMinimalQaJob({ jobType: "openclaw.build", agentRole: "builder" }));
if (builderRejected.valid) {
  fail("QA schema should reject builder jobs");
} else {
  pass("QA job schema rejects builder jobs");
}

const commitRejected = validateQaJob(buildMinimalQaJob({ commitPolicy: { enabled: true, maxCommits: 1 } }));
if (commitRejected.valid) {
  fail("QA schema should reject commitPolicy.enabled");
} else {
  pass("QA job schema rejects commitPolicy.enabled");
}

const gitAddRejected = validateQaCommandAllowlist("git add .");
if (gitAddRejected.allowed) {
  fail("QA allowlist should block git add");
} else {
  pass("QA command allowlist blocks git add/commit/write commands");
}

const gitCommitRejected = validateQaCommandAllowlist('git commit -m "test"');
if (gitCommitRejected.allowed) {
  fail("QA allowlist should block git commit");
} else {
  pass("QA allowlist blocks git commit");
}

const nodeEvalRejected = validateQaCommandAllowlist("node -e process.exit(0)");
if (nodeEvalRejected.allowed) {
  fail("QA allowlist should block node -e");
} else {
  pass("QA allowlist blocks node -e");
}

const safeCheck = validateQaCommandAllowlist("node --check scripts/openclaw/run-qa-job.js");
if (!safeCheck.allowed) {
  fail("QA allowlist should allow node --check");
} else {
  pass("Safe QA commands pass allowlist");
}

const cmdOk = await runCommand("node --check scripts/openclaw/run-qa-job.js", { qaMode: true });
if (!cmdOk.ok || cmdOk.rejected) {
  fail("Safe QA commands should run");
} else {
  pass("Safe QA commands run");
}

const evalOk = await evaluateExpectedOutputs(
  {
    validationResults: [{ command: "node --version", ok: true, exitCode: 0 }],
    events: [{ id: "evt_1" }],
    reportPath: join(ROOT, "package.json"),
  },
  [{ type: "commandExitCodeZero" }, { type: "eventsEmitted" }, { type: "reportWritten" }],
);
if (!evalOk.ok) {
  fail(`Expected output evaluation failed: ${evalOk.checks.map((row) => row.detail).join("; ")}`);
} else {
  pass("Expected output evaluation works");
}

const evalFail = await evaluateExpectedOutputs(
  { validationResults: [{ command: "bad", ok: false, exitCode: 1 }], events: [] },
  [{ type: "commandExitCodeZero" }],
);
if (evalFail.ok) {
  fail("Expected output evaluation should fail on bad commands");
} else {
  pass("Expected output evaluation detects failures");
}

const report = createOpenClawQaReport({
  genericJobId: "job_qa",
  openclawJobId: "openclaw_qa_test",
  phaseId: "3.1.8",
  agentRole: "qa",
  objective: "test",
  promptHash: demoPromptHash,
  idempotencyKey: deriveOpenClawIdempotencyKey({ phaseId: "3.1.8", jobType: "openclaw.qa", promptHash: demoPromptHash }),
  status: "completed",
  qaVerdict: "passed",
  validationResults: [{ command: "node --version", ok: true, exitCode: 0 }],
  expectedOutputResults: { checks: [{ type: "commandExitCodeZero", ok: true, detail: "ok" }] },
  sourceChangeResult: { ok: true, violations: [] },
  gitStatusSummary: "clean",
  stopReason: "completed",
  eventIds: ["evt_1"],
  openclawJob: buildMinimalQaJob(),
});
for (const field of ["final QA verdict", "promptHash", "Expected Output Results", "source change check", "Events Emitted"]) {
  if (!report.includes(field)) {
    fail(`QA report missing field: ${field}`);
  }
}
if (!errors.some((row) => row.startsWith("QA report missing"))) {
  pass("QA report includes required forensic fields");
}

let demoJobId = null;
try {
  const { stdout } = await execFileAsync(process.execPath, [join(ROOT, "scripts/openclaw/create-demo-qa-job.js")], {
    cwd: ROOT,
    env: { ...process.env, OPENCLAW_ALLOW_VALIDATION_DEMO: "1" },
  });
  demoJobId = JSON.parse(stdout.trim()).jobId;
  pass("Demo QA job can be created");
} catch (error) {
  fail(`create-demo-qa-job.js failed: ${error.message}`);
}

if (demoJobId) {
  const workerResult = await runOpenClawQaJob(demoJobId, { allowValidationDemo: true });
  const finished = await getJob(demoJobId);

  if (workerResult.status !== "completed") {
    fail(`QA worker did not complete demo job: ${workerResult.errors.join("; ")}`);
  } else {
    pass("QA worker completes job on pass");
  }

  if (finished?.status !== "completed") {
    fail(`Generic job expected completed, got ${finished?.status || "missing"}`);
  } else {
    pass("QA worker claims one job");
  }

  if (!workerResult.validationResults.length) {
    fail("QA worker should run validation commands");
  } else {
    pass("QA worker runs validation commands");
  }

  if (workerResult.commitHash) {
    fail("QA worker must not commit");
  } else {
    pass("QA worker does not commit");
  }

  if (!(await fileExists(workerResult.reportPath))) {
    fail(`QA report not written: ${workerResult.reportPath}`);
  } else {
    pass("QA worker writes report");
  }

  const forbiddenChanges = (workerResult.changedDuringRun || []).filter(
    (path) => !path.startsWith("reports/openclaw/") && !path.endsWith(".gitkeep"),
  );
  if (
    forbiddenChanges.some(
      (path) =>
        path.startsWith("runtime/") ||
        path.startsWith("src/engine/mission-control/") ||
        path.startsWith("src/engine/score-council/"),
    )
  ) {
    fail(`QA worker modified forbidden paths: ${forbiddenChanges.join(", ")}`);
  } else {
    pass("QA worker does not modify forbidden source paths");
  }

  for (const type of [
    "openclaw.qa.validated",
    "openclaw.qa.started",
    "openclaw.qa.commands_completed",
    "openclaw.qa.expected_outputs_passed",
    "openclaw.qa.reported",
    "openclaw.qa.completed",
  ]) {
    const rows = await getEventsByType(type);
    if (!rows.some((row) => row.metadata?.jobId === demoJobId)) {
      fail(`Missing QA event: ${type}`);
    }
  }
  if (!errors.some((row) => row.startsWith("Missing QA event"))) {
    pass("QA worker emits QA events");
  }
}

const failOpenclaw = buildMinimalQaJob({
  id: `openclaw_qa_fail_${randomUUID().slice(0, 8)}`,
  validationCommands: ["node --check scripts/openclaw/run-qa-job.js"],
  expectedOutputs: [{ type: "containsText", text: "THIS_TEXT_DOES_NOT_EXIST_XYZ", in: "stdout" }],
});

const failJob = await createJob({
  type: "openclaw.qa",
  idempotencyKey: failOpenclaw.idempotencyKey,
  inputRefs: [failOpenclaw.id],
  metadata: {
    correlationId: randomUUID(),
    validationDemo: true,
    openclaw: failOpenclaw,
  },
});

const failResult = await runOpenClawQaJob(failJob.id, { allowValidationDemo: true });
if (failResult.status !== "failed") {
  fail("QA worker should fail job on expected-output failure");
} else {
  pass("QA worker fails job on expected-output failure");
}

const failEvents = await getEventsByType("openclaw.qa.expected_outputs_failed");
if (!failEvents.some((row) => row.metadata?.jobId === failJob.id)) {
  fail("Expected output failure should emit openclaw.qa.expected_outputs_failed");
} else {
  pass("Expected output failure emits QA event");
}

await assertNoForbiddenPatterns();

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-phase-3-1-7-5.js")], {
    cwd: ROOT,
    env: { ...process.env, OPENCLAW_ALLOW_VALIDATION_DEMO: "1" },
  });
  pass("Phase 3.1.7.5 regression passes");
} catch (error) {
  fail(`validate-phase-3-1-7-5.js regression failed: ${error.message}`);
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
  console.error(`\nPhase 3.1.8 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 3.1.8 validation passed.");
console.log("OpenClaw QA Worker complete. One job. No commits. STOP.");
