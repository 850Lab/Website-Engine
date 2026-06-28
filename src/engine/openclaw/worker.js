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
import { verifyOwnerApproval } from "./approval.js";
import { runCommands } from "./command-runner.js";
import { enforceFileScope } from "./file-scope.js";
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
    subjectId: openclawJob.id || genericJob.id,
    payload: {
      jobId: openclawJob.id || genericJob.id,
      phaseId: openclawJob.phaseId,
      agentRole: openclawJob.agentRole,
      timestamp: nowIso(),
      ...payload,
    },
    correlationId: genericJob.metadata?.correlationId || genericJob.id,
    causationId,
    metadata: {
      jobId: genericJob.id,
      openclawJobId: openclawJob.id,
      phaseId: openclawJob.phaseId,
      agentRole: openclawJob.agentRole,
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

  await execFileAsync("git", ["add", "--", ...changedFiles], { cwd: getRepoRoot() });
  await execFileAsync("git", ["commit", "-m", message], { cwd: getRepoRoot() });
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: getRepoRoot() });

  return { committed: true, commitHash: stdout.trim(), reason: "committed" };
}

async function getNextBlockedPhase() {
  const content = await readFile(join(getRepoRoot(), "docs/opportunity-os/08-current-phase.md"), "utf8");
  const match = content.match(/## Phase ([^\n]+)\s*\(Blocked\)/i);
  return match ? `Phase ${match[1].trim()} (blocked until owner approval)` : "See 08-current-phase.md";
}

export async function runOpenClawBuilderJob(jobId, options = {}) {
  const result = {
    jobId,
    status: "stopped",
    errors: [],
    events: [],
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
    gitStatusSummary: null,
    nextBlockedPhase: null,
    completedAt: null,
  };

  let lastEventId = null;
  let genericJob = null;
  let openclawJob = null;

  async function emit(type, payload = {}) {
    if (!openclawJob || !genericJob) return null;
    const event = await emitOpenClawEvent(type, openclawJob, genericJob, payload, lastEventId);
    lastEventId = event.id;
    result.events.push(event);
    return event;
  }

  async function stop(reason, detail, options = {}) {
    result.status = "stopped";
    result.errors.push(`${reason}: ${detail}`);
    if (openclawJob && genericJob) {
      await emit("openclaw.job.stopped", { reason, detail });
    }
    result.completedAt = nowIso();
    result.nextBlockedPhase = await getNextBlockedPhase();
    result.reportPath = buildReportPath(openclawJob || { id: jobId, phaseId: result.phaseId || "unknown" });
    await writeOpenClawReport({ ...result, openclawJob: openclawJob || { id: jobId } });
    if (openclawJob && genericJob) {
      await emit("openclaw.job.reported", { reportPath: result.reportPath });
    }
    if (options.cancelPending && genericJob?.status === "pending") {
      await cancelJob(jobId, { reason: `${reason}: ${detail}` });
    }
    return result;
  }

  genericJob = await getJob(jobId);
  if (!genericJob) {
    result.errors.push(`Job not found: ${jobId}`);
    result.completedAt = nowIso();
    return result;
  }

  openclawJob = extractOpenClawJob(genericJob);
  result.openclawJob = openclawJob;
  result.phaseId = openclawJob?.phaseId || null;
  result.objective = openclawJob?.objective || null;

  const schema = validateOpenClawJob(openclawJob);
  if (!schema.valid) {
    result.errors.push(...schema.errors);
    await stop("schema_invalid", schema.errors.join("; "), { cancelPending: true });
    return result;
  }

  const approval = await verifyOwnerApproval(openclawJob, options);
  if (!approval.ok) {
    result.errors.push(approval.detail);
    await stop(approval.reason, approval.detail, { cancelPending: true });
    return result;
  }

  await emit("openclaw.job.validated", { approval: approval.detail });

  try {
    genericJob = await claimJob(jobId);
  } catch (error) {
    result.errors.push(error.message);
    await stop("claim_failed", error.message);
    return result;
  }

  await emit("openclaw.job.started");

  const requiredRun = await runCommands(openclawJob.requiredCommands || [], {
    ...options,
    env: { ...options.env, OPENCLAW_WORKER_RUN: "1" },
  });
  result.commandResults = requiredRun.results;
  if (!requiredRun.ok) {
    await emit("openclaw.job.failed", { stage: "requiredCommands" });
    await failJob(jobId, {
      code: "REQUIRED_COMMAND_FAILED",
      message: requiredRun.results.find((row) => !row.ok)?.stderr || "Required command failed",
      retryable: false,
    });
    result.status = "failed";
    result.completedAt = nowIso();
    result.nextBlockedPhase = await getNextBlockedPhase();
    result.reportPath = buildReportPath(openclawJob);
    await writeOpenClawReport(result);
    await emit("openclaw.job.reported", { reportPath: result.reportPath });
    return result;
  }

  await emit("openclaw.job.commands_completed", { count: requiredRun.results.length });

  const validationRun = await runCommands(openclawJob.validationCommands || [], {
    ...options,
    env: { ...options.env, OPENCLAW_WORKER_RUN: "1" },
  });
  result.validationResults = validationRun.results;
  if (!validationRun.ok) {
    await emit("openclaw.job.validation_failed", {
      failedCommand: validationRun.results.find((row) => !row.ok)?.command,
    });
    await failJob(jobId, {
      code: "VALIDATION_FAILED",
      message: "Validation command failed",
      retryable: false,
    });
    result.status = "failed";
    result.completedAt = nowIso();
    result.nextBlockedPhase = await getNextBlockedPhase();
    result.reportPath = buildReportPath(openclawJob);
    await writeOpenClawReport(result);
    await emit("openclaw.job.reported", { reportPath: result.reportPath });
    return result;
  }

  await emit("openclaw.job.validation_passed");

  result.gitStatusSummary = await getGitStatusSummary();
  result.changedFiles = await getGitChangedFiles();

  const scopeResult = enforceFileScope(openclawJob, result.changedFiles, {
    commitScope: false,
    validationDemo:
      genericJob.metadata?.validationDemo === true ||
      openclawJob.ownerApproval?.phaseDocStatus === "VALIDATION_DEMO",
  });
  result.scopeResult = scopeResult;
  if (!scopeResult.ok) {
    await emit("openclaw.job.scope_failed", { violations: scopeResult.violations });
    await failJob(jobId, {
      code: "SCOPE_FAILED",
      message: scopeResult.violations.join("; "),
      retryable: false,
    });
    result.status = "failed";
    result.errors.push(...scopeResult.violations);
    result.completedAt = nowIso();
    result.nextBlockedPhase = await getNextBlockedPhase();
    result.reportPath = buildReportPath(openclawJob);
    await writeOpenClawReport(result);
    await emit("openclaw.job.reported", { reportPath: result.reportPath });
    return result;
  }

  await emit("openclaw.job.scope_passed");

  const commitResult = await maybeCommit(openclawJob, result.changedFiles);
  result.commitHash = commitResult.commitHash;
  if (commitResult.committed) {
    await emit("openclaw.job.committed", { commitHash: commitResult.commitHash });
  }

  result.status = "completed";
  result.completedAt = nowIso();
  result.nextBlockedPhase = await getNextBlockedPhase();
  result.reportPath = buildReportPath(openclawJob);
  await writeOpenClawReport(result);
  await emit("openclaw.job.reported", { reportPath: result.reportPath });
  await emit("openclaw.job.completed", { reportPath: result.reportPath });

  await completeJob(jobId, {
    outputRefs: [result.reportPath, ...(result.commitHash ? [result.commitHash] : [])],
  });

  return result;
}
