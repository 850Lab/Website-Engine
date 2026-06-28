import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getRepoRoot } from "../runtime/index.js";

function sanitize(value) {
  return String(value || "unknown").replace(/[^\w.-]+/g, "_");
}

export function buildReportPath(openclawJob) {
  const pattern =
    openclawJob.reportPolicy?.pathPattern || "reports/openclaw/openclaw-{phaseId}-{jobId}.md";
  const jobId = openclawJob.id || openclawJob.metadata?.genericJobId || "job";
  return join(
    getRepoRoot(),
    pattern.replace("{phaseId}", sanitize(openclawJob.phaseId)).replace("{jobId}", sanitize(jobId)),
  );
}

function formatApprovalSummary(approval) {
  if (!approval) {
    return "none";
  }
  return [
    `approvedBy=${approval.approvedBy || "unknown"}`,
    `approvedAt=${approval.approvedAt || "unknown"}`,
    `approvalSource=${approval.approvalSource || "unknown"}`,
    `phaseId=${approval.phaseId || "unknown"}`,
    `promptHash=${approval.promptHash || "unknown"}`,
    `phaseDocStatus=${approval.phaseDocStatus || "unknown"}`,
  ].join("; ");
}

function formatCommandRows(rows, includeFailureOutput = true) {
  const lines = [];
  for (const row of rows || []) {
    let line = `- \`${row.command}\` — ${row.rejected ? "REJECTED" : row.ok ? "PASS" : "FAIL"} (exit ${row.exitCode ?? "n/a"})`;
    if (row.reason) {
      line += ` [${row.reason}]`;
    }
    lines.push(line);
    if (includeFailureOutput && (!row.ok || row.rejected)) {
      if (row.stdout?.trim()) {
        lines.push(`  - stdout: ${row.stdout.trim().slice(0, 2000)}`);
      }
      if (row.stderr?.trim()) {
        lines.push(`  - stderr: ${row.stderr.trim().slice(0, 2000)}`);
      }
    }
  }
  return lines;
}

export function createOpenClawReport(result) {
  const openclawJob = result.openclawJob || {};
  const lines = [
    "# OpenClaw Builder Report",
    "",
    `Generated: ${result.completedAt || new Date().toISOString()}`,
    "",
    "## Identity",
    "",
    `- **generic job id:** ${result.genericJobId || result.jobId || ""}`,
    `- **OpenClaw job id:** ${openclawJob.id || result.openclawJobId || ""}`,
    `- **phaseId:** ${result.phaseId || openclawJob.phaseId || ""}`,
    `- **jobType:** ${openclawJob.jobType || "openclaw.build"}`,
    `- **agentRole:** ${result.agentRole || openclawJob.agentRole || "builder"}`,
    `- **objective:** ${result.objective || openclawJob.objective || ""}`,
    `- **promptHash:** ${result.promptHash || openclawJob.promptHash || ""}`,
    `- **idempotencyKey:** ${result.idempotencyKey || openclawJob.idempotencyKey || ""}`,
    `- **correlationId:** ${result.correlationId || ""}`,
    `- **final status:** ${result.status}`,
    `- **stop reason:** ${result.stopReason || "none"}`,
    "",
    "## Owner Approval",
    "",
    `- **summary:** ${formatApprovalSummary(openclawJob.ownerApproval)}`,
    `- **verification:** ${result.approvalVerification || "not evaluated"}`,
    `- **prompt artifact:** ${result.promptArtifactPath || "not loaded"}`,
    "",
    "## Commands Run",
    "",
    ...formatCommandRows(result.commandResults),
    "",
    "## Validation Results",
    "",
    ...formatCommandRows(result.validationResults),
    "",
    "## Files Changed",
    "",
  ];

  if (result.changedFiles?.length) {
    for (const file of result.changedFiles) {
      lines.push(`- ${file}`);
    }
  } else {
    lines.push("- None");
  }

  lines.push("", "## File Scope", "");
  lines.push(
    result.scopeResult == null
      ? "- Not evaluated"
      : result.scopeResult.ok
        ? "- PASS"
        : `- FAIL: ${(result.scopeResult.violations || []).join("; ")}`,
  );

  lines.push("", "## Git", "");
  lines.push(`- **summary:** ${result.gitStatusSummary || "unknown"}`);
  lines.push(`- **commit hash:** ${result.commitHash || "none"}`);

  lines.push("", "## Events Emitted", "");
  if (result.eventIds?.length) {
    for (const eventId of result.eventIds) {
      lines.push(`- ${eventId}`);
    }
  } else if (result.events?.length) {
    for (const event of result.events) {
      lines.push(`- ${event.id} (${event.type})`);
    }
  } else {
    lines.push("- None");
  }

  if (result.errors?.length) {
    lines.push("", "## Failures", "");
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
  }

  lines.push("", "## Next Blocked Phase", "");
  lines.push(result.nextBlockedPhase || "Phase 3.1.8 — OpenClaw QA Worker (blocked until owner approval)");
  lines.push("");
  return lines.join("\n");
}

export async function writeOpenClawReport(result) {
  const path = result.reportPath || buildReportPath(result.openclawJob || result);
  await mkdir(dirname(path), { recursive: true });
  const markdown = createOpenClawReport(result);
  await writeFile(path, markdown, "utf8");
  return { path, markdown };
}
