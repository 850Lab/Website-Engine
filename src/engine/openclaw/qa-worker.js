import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { appendEvent } from "../events/index.js";
import { claimJob, cancelJob, completeJob, failJob, getJob } from "../jobs/index.js";
import { getRepoRoot } from "../runtime/index.js";
import { isValidationDemoAllowed, isValidationDemoJob, verifyOwnerApproval } from "./approval.js";
import { runCommands } from "./command-runner.js";
import { verifyOpenClawIdempotency } from "./idempotency.js";
import { resolveAndVerifyPromptHash } from "./prompt.js";
import { evaluateExpectedOutputs, verifyNoSourceChanges } from "./qa-assertions.js";
import { buildQaReportPath, writeOpenClawQaReport } from "./qa-report.js";
import { validateQaJob } from "./qa-schema.js";
import { extractOpenClawJob } from "./schema.js";

const execFileAsync = promisify(execFile);

function nowIso() {
  return new Date().toISOString();
}

async function emitQaEvent(type, openclawJob, genericJob, payload = {}, causationId = null) {
  return appendEvent({
    type,
    subjectType: "openclaw_job",
    subjectId: openclawJob?.id || genericJob?.id || payload.jobId,
    payload: {
      jobId: openclawJob?.id || genericJob?.id || payload.jobId,
      phaseId: openclawJob?.phaseId || payload.phaseId || null,
      agentRole: "qa",
      timestamp: nowIso(),
      ...payload,
    },
    correlationId: genericJob?.metadata?.correlationId || genericJob?.id || payload.jobId,
    causationId,
    metadata: {
      jobId: genericJob?.id || payload.genericJobId || null,
      openclawJobId: openclawJob?.id || null,
      phaseId: openclawJob?.phaseId || payload.phaseId || null,
      agentRole: "qa",
    },
  });
}

async function getGitChangedFiles() {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd: getRepoRoot() });
    return stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => line.slice(3).trim().replace(/\\/g, "/"));
  } catch {
    return [];
  }
}

async function getGitStatusSummary() {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--short"], { cwd: getRepoRoot() });
    const lines = stdout.split("\n").filter(Boolean);
    return lines.length ? `${lines.length} change(s)` : "clean";
  } catch (error) {
    return error.message;
  }
}

async function getNextBlockedPhase() {
  const content = await readFile(join(getRepoRoot(), "docs/opportunity-os/08-current-phase.md"), "utf8");
  const match = content.match(/## Phase ([^\n]+)\s*\(Blocked\)/i);
  return match ? `Phase ${match[1].trim()} (blocked until owner approval)` : "See 08-current-phase.md";
}

export async function runOpenClawQaJob(jobId, options = {}) {
  const result = {
    jobId,
    genericJobId: jobId,
    openclawJobId: null,
    status: "stopped",
    qaVerdict: "stopped",
    stopReason: null,
    errors: [],
    events: [],
    eventIds: [],
    validationResults: [],
    expectedOutputResults: null,
    changedDuringRun: [],
    sourceChangeResult: null,
    reportPath: null,
    openclawJob: null,
    phaseId: null,
    agentRole: "qa",
    objective: null,
    promptHash: null,
    idempotencyKey: null,
    correlationId: null,
    approvalVerification: null,
    promptArtifactPath: null,
    gitStatusSummary: null,
    nextBlockedPhase: null,
    completedAt: null,
  };

  let lastEventId = null;
  let genericJob = null;
  let openclawJob = null;
  let changedBefore = [];

  async function recordEvent(event) {
    if (!event?.id) {
      return event;
    }
    lastEventId = event.id;
    result.events.push(event);
    result.eventIds.push(event.id);
    return event;
  }

  async function emit(type, payload = {}) {
    const event = await emitQaEvent(type, openclawJob, genericJob, payload, lastEventId);
    return recordEvent(event);
  }

  async function emitBare(type, payload = {}) {
    const event = await appendEvent({
      type,
      subjectType: "openclaw_job",
      subjectId: payload.jobId || jobId,
      payload: { jobId: payload.jobId || jobId, agentRole: "qa", timestamp: nowIso(), ...payload },
      correlationId: payload.correlationId || jobId,
      causationId: lastEventId,
      metadata: { jobId: payload.jobId || jobId, agentRole: "qa" },
    });
    return recordEvent(event);
  }

  async function writeReport() {
    result.gitStatusSummary = result.gitStatusSummary || (await getGitStatusSummary());
    result.completedAt = result.completedAt || nowIso();
    result.nextBlockedPhase = result.nextBlockedPhase || (await getNextBlockedPhase());
    result.reportPath = result.reportPath || buildQaReportPath(openclawJob || { id: jobId, phaseId: result.phaseId || "unknown" });
    await writeOpenClawQaReport({ ...result, openclawJob: openclawJob || { id: jobId } });
  }

  async function terminalFailure({ reason, detail, specificEvent, cancelPending = false, failGeneric = false, failCode = "QA_FAILED" }) {
    result.status = "failed";
    result.qaVerdict = "failed";
    result.stopReason = reason;
    result.errors.push(`${reason}: ${detail}`);

    if (specificEvent && openclawJob && genericJob) {
      await emit(specificEvent, { reason, detail });
    }

    if (openclawJob && genericJob) {
      await emit("openclaw.qa.failed", { reason, detail });
      await emit("openclaw.qa.stopped", { reason, detail });
    } else {
      await emitBare("openclaw.qa.failed", { reason, detail, jobId });
      await emitBare("openclaw.qa.stopped", { reason, detail, jobId });
    }

    await writeReport();
    if (openclawJob && genericJob) {
      await emit("openclaw.qa.reported", { reportPath: result.reportPath });
    } else {
      await emitBare("openclaw.qa.reported", { reportPath: result.reportPath, jobId });
    }

    if (failGeneric && genericJob && ["claimed", "running"].includes(genericJob.status)) {
      try {
        await failJob(jobId, { code: failCode, message: detail, retryable: false });
      } catch {
        // Job may have been cleared by nested validation — failure already recorded in events/report.
      }
    } else if (cancelPending && genericJob?.status === "pending") {
      await cancelJob(jobId, { reason: `${reason}: ${detail}` });
    }

    return result;
  }

  genericJob = await getJob(jobId);
  if (!genericJob) {
    result.errors.push(`Job not found: ${jobId}`);
    await emitBare("openclaw.qa.not_found", { jobId, reason: "job_not_found" });
    return terminalFailure({ reason: "job_not_found", detail: `Job not found: ${jobId}` });
  }

  result.correlationId = genericJob.metadata?.correlationId || genericJob.id;
  openclawJob = extractOpenClawJob(genericJob);
  result.openclawJob = openclawJob;
  result.openclawJobId = openclawJob?.id || null;
  result.phaseId = openclawJob?.phaseId || null;
  result.objective = openclawJob?.objective || null;
  result.promptHash = openclawJob?.promptHash || null;
  result.idempotencyKey = openclawJob?.idempotencyKey || genericJob.idempotencyKey || null;

  const schema = validateQaJob(genericJob);
  if (!schema.valid) {
    result.errors.push(...schema.errors);
    return terminalFailure({
      reason: "schema_invalid",
      detail: schema.errors.join("; "),
      cancelPending: true,
      specificEvent: "openclaw.qa.schema_failed",
    });
  }

  const idempotency = verifyOpenClawIdempotency(openclawJob, genericJob);
  if (!idempotency.ok) {
    result.errors.push(idempotency.detail);
    return terminalFailure({
      reason: "idempotency_mismatch",
      detail: idempotency.detail,
      cancelPending: true,
      specificEvent: "openclaw.qa.idempotency_mismatch",
    });
  }

  const promptVerification = await resolveAndVerifyPromptHash(openclawJob, {
    ...options,
    allowValidationDemo: isValidationDemoAllowed(options),
    validationDemo: isValidationDemoJob(openclawJob),
    promptArtifactPath:
      openclawJob.promptArtifactPath ||
      (isValidationDemoJob(openclawJob) ? "engine-data/openclaw/prompts/demo-phase-3-1-8.json" : undefined),
  });
  result.promptArtifactPath = promptVerification.artifactPath || null;
  if (!promptVerification.ok) {
    result.errors.push(promptVerification.detail);
    return terminalFailure({
      reason: promptVerification.reason,
      detail: promptVerification.detail,
      cancelPending: true,
      specificEvent: "openclaw.qa.prompt_hash_mismatch",
    });
  }

  const approval = await verifyOwnerApproval(openclawJob, options);
  result.approvalVerification = approval.detail;
  if (!approval.ok) {
    result.errors.push(approval.detail);
    return terminalFailure({
      reason: approval.reason,
      detail: approval.detail,
      cancelPending: true,
      specificEvent: "openclaw.qa.approval_failed",
    });
  }

  await emit("openclaw.qa.validated", { approval: approval.detail, promptHash: result.promptHash });

  changedBefore = await getGitChangedFiles();

  try {
    genericJob = await claimJob(jobId);
  } catch (error) {
    result.errors.push(error.message);
    return terminalFailure({
      reason: "claim_failed",
      detail: error.message,
      specificEvent: "openclaw.qa.claim_failed",
    });
  }

  await emit("openclaw.qa.started");

  const validationRun = await runCommands(openclawJob.validationCommands || [], {
    ...options,
    qaMode: true,
    env: { ...options.env, OPENCLAW_WORKER_RUN: "1" },
  });
  result.validationResults = validationRun.results;

  const rejected = validationRun.results.find((row) => row.rejected);
  if (rejected) {
    return terminalFailure({
      reason: "command_rejected",
      detail: rejected.error || rejected.stderr,
      specificEvent: "openclaw.qa.command_rejected",
      failGeneric: true,
      failCode: "COMMAND_REJECTED",
    });
  }

  if (!validationRun.ok) {
    const failed = validationRun.results.find((row) => !row.ok);
    return terminalFailure({
      reason: "validation_failed",
      detail: failed?.stderr || failed?.error || "Validation command failed",
      failGeneric: true,
      failCode: "VALIDATION_FAILED",
    });
  }

  await emit("openclaw.qa.commands_completed", { count: validationRun.results.length });

  const changedAfter = await getGitChangedFiles();
  result.changedDuringRun = changedAfter.filter((path) => !changedBefore.includes(path));
  result.sourceChangeResult = verifyNoSourceChanges(result.changedDuringRun, {
    validationDemo: isValidationDemoJob(openclawJob),
    allowValidationDemo: isValidationDemoAllowed(options),
  });

  if (!result.sourceChangeResult.ok) {
    return terminalFailure({
      reason: "source_change_forbidden",
      detail: result.sourceChangeResult.violations.join("; "),
      failGeneric: true,
      failCode: "SOURCE_CHANGE_FORBIDDEN",
    });
  }

  result.reportPath = buildQaReportPath(openclawJob);
  result.qaVerdict = "pending";
  await writeOpenClawQaReport(result);

  result.expectedOutputResults = await evaluateExpectedOutputs(result, openclawJob.expectedOutputs || []);
  if (!result.expectedOutputResults.ok) {
    await emit("openclaw.qa.expected_outputs_failed", {
      failures: result.expectedOutputResults.checks.filter((row) => !row.ok),
    });
    return terminalFailure({
      reason: "expected_outputs_failed",
      detail: result.expectedOutputResults.checks
        .filter((row) => !row.ok)
        .map((row) => `${row.type}: ${row.detail}`)
        .join("; "),
      failGeneric: true,
      failCode: "EXPECTED_OUTPUTS_FAILED",
    });
  }

  await emit("openclaw.qa.expected_outputs_passed");

  result.status = "completed";
  result.qaVerdict = "passed";
  result.stopReason = "completed";
  result.completedAt = nowIso();
  result.nextBlockedPhase = await getNextBlockedPhase();
  await writeReport();
  await emit("openclaw.qa.reported", { reportPath: result.reportPath });
  await emit("openclaw.qa.completed", { reportPath: result.reportPath, qaVerdict: "passed" });

  await completeJob(jobId, { outputRefs: [result.reportPath] });

  return result;
}
