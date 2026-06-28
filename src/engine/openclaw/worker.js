import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { appendEvent } from "../events/index.js";
import {
  claimJob,
  cancelJob,
  completeJob,
  failJob,
  getJob,
} from "../jobs/index.js";
import { getRepoRoot } from "../runtime/index.js";
import { isValidationDemoAllowed, isValidationDemoJob, verifyOwnerApproval } from "./approval.js";
import { runCommands } from "./command-runner.js";
import { enforceFileScope } from "./file-scope.js";
import { verifyOpenClawIdempotency } from "./idempotency.js";
import { resolveAndVerifyPromptHash } from "./prompt.js";
import { buildReportPath, writeOpenClawReport } from "./report.js";
import { extractOpenClawJob, validateOpenClawJob } from "./schema.js";

const execFileAsync = promisify(execFile);

function nowIso() {
  return new Date().toISOString();
}

async function emitOpenClawEvent(type, openclawJob, genericJob, payload = {}, causationId = null) {
  return appendEvent({
    type,
    subjectType: "openclaw_job",
    subjectId: openclawJob?.id || genericJob?.id || payload.jobId,
    payload: {
      jobId: openclawJob?.id || genericJob?.id || payload.jobId,
      phaseId: openclawJob?.phaseId || payload.phaseId || null,
      agentRole: openclawJob?.agentRole || payload.agentRole || "builder",
      timestamp: nowIso(),
      ...payload,
    },
    correlationId: genericJob?.metadata?.correlationId || genericJob?.id || payload.jobId,
    causationId,
    metadata: {
      jobId: genericJob?.id || payload.genericJobId || null,
      openclawJobId: openclawJob?.id || null,
      phaseId: openclawJob?.phaseId || payload.phaseId || null,
      agentRole: openclawJob?.agentRole || payload.agentRole || "builder",
    },
  });
}

async function getGitChangedFiles() {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd: getRepoRoot() });
    return stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => line.slice(3).trim().replace(/\\/g, "/"))
      .filter((path) => !path.startsWith("reports/openclaw/"));
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

async function maybeCommit(openclawJob, changedFiles) {
  const policy = openclawJob.commitPolicy || {};
  const enabled = policy.enabled === true || (policy.enabled !== false && Number(policy.maxCommits) > 0);

  if (!enabled) {
    return { committed: false, commitHash: null, reason: "commit_disabled" };
  }

  const scope = enforceFileScope(openclawJob, changedFiles, { commitScope: true });
  if (!scope.ok) {
    return { committed: false, commitHash: null, reason: "scope_failed", scope };
  }

  if (changedFiles.length === 0) {
    return { committed: false, commitHash: null, reason: "no_changes" };
  }

  const message =
    String(policy.messageFormat || "Implement {phaseId} {title}")
      .replace("{phaseId}", openclawJob.phaseId)
      .replace("{title}", openclawJob.title) || `Implement ${openclawJob.phaseId}`;

  try {
    await execFileAsync("git", ["add", "--", ...changedFiles], { cwd: getRepoRoot() });
    await execFileAsync("git", ["commit", "-m", message], { cwd: getRepoRoot() });
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: getRepoRoot() });
    return { committed: true, commitHash: stdout.trim(), reason: "committed" };
  } catch (error) {
    return { committed: false, commitHash: null, reason: "commit_failed", error: error.message };
  }
}

async function getNextBlockedPhase() {
  const content = await readFile(join(getRepoRoot(), "docs/opportunity-os/08-current-phase.md"), "utf8");
  const match = content.match(/## Phase ([^\n]+)\s*\(Blocked\)/i);
  return match ? `Phase ${match[1].trim()} (blocked until owner approval)` : "See 08-current-phase.md";
}

export async function runOpenClawBuilderJob(jobId, options = {}) {
  const result = {
    jobId,
    genericJobId: jobId,
    openclawJobId: null,
    status: "stopped",
    stopReason: null,
    errors: [],
    events: [],
    eventIds: [],
    commandResults: [],
    validationResults: [],
    changedFiles: [],
    scopeResult: null,
    commitHash: null,
    reportPath: null,
    openclawJob: null,
    phaseId: null,
    agentRole: "builder",
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
    const event = await emitOpenClawEvent(type, openclawJob, genericJob, payload, lastEventId);
    return recordEvent(event);
  }

  async function emitBare(type, payload = {}) {
    const event = await appendEvent({
      type,
      subjectType: "openclaw_job",
      subjectId: payload.jobId || jobId,
      payload: {
        jobId: payload.jobId || jobId,
        timestamp: nowIso(),
        agentRole: "builder",
        ...payload,
      },
      correlationId: payload.correlationId || jobId,
      causationId: lastEventId,
    });
    return recordEvent(event);
  }

  async function writeReport() {
    result.gitStatusSummary = result.gitStatusSummary || (await getGitStatusSummary());
    result.completedAt = result.completedAt || nowIso();
    result.nextBlockedPhase = result.nextBlockedPhase || (await getNextBlockedPhase());
    result.reportPath =
      result.reportPath ||
      buildReportPath(openclawJob || { id: jobId, phaseId: result.phaseId || "unknown" });
    await writeOpenClawReport({ ...result, openclawJob: openclawJob || { id: jobId } });
  }

  async function terminalFailure({
    reason,
    detail,
    specificEvent,
    cancelPending = false,
    failGeneric = false,
    failCode = "OPENCLAW_FAILED",
  }) {
    result.status = "failed";
    result.stopReason = reason;
    result.errors.push(`${reason}: ${detail}`);

    if (specificEvent && openclawJob && genericJob) {
      await emit(specificEvent, { reason, detail });
    }

    if (openclawJob && genericJob) {
      await emit("openclaw.job.failed", { reason, detail });
      await emit("openclaw.job.stopped", { reason, detail });
    } else {
      await emitBare("openclaw.job.failed", { reason, detail, jobId });
      await emitBare("openclaw.job.stopped", { reason, detail, jobId });
    }

    await writeReport();
    if (openclawJob && genericJob) {
      await emit("openclaw.job.reported", { reportPath: result.reportPath });
    } else {
      await emitBare("openclaw.job.reported", { reportPath: result.reportPath, jobId });
    }

    if (failGeneric && genericJob && ["claimed", "running"].includes(genericJob.status)) {
      await failJob(jobId, { code: failCode, message: detail, retryable: false });
    } else if (cancelPending && genericJob?.status === "pending") {
      await cancelJob(jobId, { reason: `${reason}: ${detail}` });
    }

    return result;
  }

  async function terminalStop({ reason, detail, cancelPending = false, specificEvent = null }) {
    result.status = "stopped";
    result.stopReason = reason;
    result.errors.push(`${reason}: ${detail}`);

    if (specificEvent && openclawJob && genericJob) {
      await emit(specificEvent, { reason, detail });
    }

    if (openclawJob && genericJob) {
      await emit("openclaw.job.failed", { reason, detail });
      await emit("openclaw.job.stopped", { reason, detail });
    } else {
      await emitBare("openclaw.job.failed", { reason, detail, jobId });
      await emitBare("openclaw.job.stopped", { reason, detail, jobId });
    }

    await writeReport();
    if (openclawJob && genericJob) {
      await emit("openclaw.job.reported", { reportPath: result.reportPath });
    } else {
      await emitBare("openclaw.job.reported", { reportPath: result.reportPath, jobId });
    }

    if (cancelPending && genericJob?.status === "pending") {
      await cancelJob(jobId, { reason: `${reason}: ${detail}` });
    }

    return result;
  }

  genericJob = await getJob(jobId);
  if (!genericJob) {
    result.errors.push(`Job not found: ${jobId}`);
    result.stopReason = "job_not_found";
    await emitBare("openclaw.job.not_found", { jobId, reason: "job_not_found" });
    return terminalFailure({
      reason: "job_not_found",
      detail: `Job not found: ${jobId}`,
      failCode: "JOB_NOT_FOUND",
    });
  }

  result.correlationId = genericJob.metadata?.correlationId || genericJob.id;
  openclawJob = extractOpenClawJob(genericJob);
  result.openclawJob = openclawJob;
  result.openclawJobId = openclawJob?.id || null;
  result.phaseId = openclawJob?.phaseId || null;
  result.objective = openclawJob?.objective || null;
  result.promptHash = openclawJob?.promptHash || null;
  result.idempotencyKey = openclawJob?.idempotencyKey || genericJob.idempotencyKey || null;

  const schema = validateOpenClawJob(genericJob);
  if (!schema.valid) {
    result.errors.push(...schema.errors);
    return terminalStop({
      reason: "schema_invalid",
      detail: schema.errors.join("; "),
      cancelPending: true,
      specificEvent: "openclaw.job.schema_failed",
    });
  }

  const idempotency = verifyOpenClawIdempotency(openclawJob, genericJob);
  if (!idempotency.ok) {
    result.errors.push(idempotency.detail);
    return terminalStop({
      reason: "idempotency_mismatch",
      detail: idempotency.detail,
      cancelPending: true,
      specificEvent: "openclaw.job.idempotency_mismatch",
    });
  }

  const promptVerification = await resolveAndVerifyPromptHash(openclawJob, {
    ...options,
    allowValidationDemo: isValidationDemoAllowed(options),
    validationDemo: isValidationDemoJob(openclawJob),
    promptArtifactPath:
      openclawJob.promptArtifactPath ||
      (isValidationDemoJob(openclawJob) ? "engine-data/openclaw/prompts/demo-phase-3-1-7.json" : undefined),
  });
  result.promptArtifactPath = promptVerification.artifactPath || null;
  if (!promptVerification.ok) {
    result.errors.push(promptVerification.detail);
    return terminalStop({
      reason: promptVerification.reason,
      detail: promptVerification.detail,
      cancelPending: true,
      specificEvent: "openclaw.job.prompt_hash_mismatch",
    });
  }

  const approval = await verifyOwnerApproval(openclawJob, options);
  result.approvalVerification = approval.detail;
  if (!approval.ok) {
    result.errors.push(approval.detail);
    return terminalStop({
      reason: approval.reason,
      detail: approval.detail,
      cancelPending: true,
      specificEvent: "openclaw.job.approval_failed",
    });
  }

  await emit("openclaw.job.validated", { approval: approval.detail, promptHash: result.promptHash });

  try {
    genericJob = await claimJob(jobId);
  } catch (error) {
    result.errors.push(error.message);
    return terminalFailure({
      reason: "claim_failed",
      detail: error.message,
      specificEvent: "openclaw.job.claim_failed",
    });
  }

  await emit("openclaw.job.started");

  const requiredRun = await runCommands(openclawJob.requiredCommands || [], {
    ...options,
    env: { ...options.env, OPENCLAW_WORKER_RUN: "1" },
  });
  result.commandResults = requiredRun.results;

  const rejectedRequired = requiredRun.results.find((row) => row.rejected);
  if (rejectedRequired) {
    return terminalFailure({
      reason: "command_rejected",
      detail: rejectedRequired.error || rejectedRequired.stderr,
      specificEvent: "openclaw.job.command_rejected",
      failGeneric: true,
      failCode: "COMMAND_REJECTED",
    });
  }

  if (!requiredRun.ok) {
    const failed = requiredRun.results.find((row) => !row.ok);
    return terminalFailure({
      reason: "command_failed",
      detail: failed?.stderr || failed?.error || "Required command failed",
      specificEvent: "openclaw.job.command_failed",
      failGeneric: true,
      failCode: "REQUIRED_COMMAND_FAILED",
    });
  }

  await emit("openclaw.job.commands_completed", { count: requiredRun.results.length });

  const validationRun = await runCommands(openclawJob.validationCommands || [], {
    ...options,
    env: { ...options.env, OPENCLAW_WORKER_RUN: "1" },
  });
  result.validationResults = validationRun.results;

  const rejectedValidation = validationRun.results.find((row) => row.rejected);
  if (rejectedValidation) {
    return terminalFailure({
      reason: "command_rejected",
      detail: rejectedValidation.error || rejectedValidation.stderr,
      specificEvent: "openclaw.job.command_rejected",
      failGeneric: true,
      failCode: "COMMAND_REJECTED",
    });
  }

  if (!validationRun.ok) {
    const failed = validationRun.results.find((row) => !row.ok);
    await emit("openclaw.job.validation_failed", {
      failedCommand: failed?.command,
      stderr: failed?.stderr,
    });
    return terminalFailure({
      reason: "validation_failed",
      detail: failed?.stderr || failed?.error || "Validation command failed",
      failGeneric: true,
      failCode: "VALIDATION_FAILED",
    });
  }

  await emit("openclaw.job.validation_passed");

  result.gitStatusSummary = await getGitStatusSummary();
  result.changedFiles = await getGitChangedFiles();

  const scopeResult = enforceFileScope(openclawJob, result.changedFiles, {
    commitScope: false,
    validationDemo: isValidationDemoJob(openclawJob),
    allowValidationDemo: isValidationDemoAllowed(options),
  });
  result.scopeResult = scopeResult;

  if (!scopeResult.ok) {
    await emit("openclaw.job.scope_failed", { violations: scopeResult.violations });
    return terminalFailure({
      reason: "scope_failed",
      detail: scopeResult.violations.join("; "),
      failGeneric: true,
      failCode: "SCOPE_FAILED",
    });
  }

  await emit("openclaw.job.scope_passed");

  const commitResult = await maybeCommit(openclawJob, result.changedFiles);
  result.commitHash = commitResult.commitHash;

  if (commitResult.reason === "commit_failed") {
    return terminalFailure({
      reason: "commit_failed",
      detail: commitResult.error || "Git commit failed",
      failGeneric: true,
      failCode: "COMMIT_FAILED",
    });
  }

  if (commitResult.committed) {
    await emit("openclaw.job.committed", { commitHash: commitResult.commitHash });
  }

  result.status = "completed";
  result.stopReason = "completed";
  result.completedAt = nowIso();
  result.nextBlockedPhase = await getNextBlockedPhase();
  await writeReport();
  await emit("openclaw.job.reported", { reportPath: result.reportPath });
  await emit("openclaw.job.completed", { reportPath: result.reportPath });

  await completeJob(jobId, {
    outputRefs: [result.reportPath, ...(result.commitHash ? [result.commitHash] : [])],
  });

  return result;
}
