import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getRepoRoot } from "../runtime/index.js";

function sanitize(value) {
  return String(value || "unknown").replace(/[^\w.-]+/g, "_");
}

export function buildQaReportPath(openclawJob) {
  const pattern =
    openclawJob.reportPolicy?.pathPattern || "reports/openclaw/openclaw-qa-{phaseId}-{jobId}.md";
  const jobId = openclawJob.id || "qa-job";
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

function formatCommandRows(rows) {
  const lines = [];
  for (const row of rows || []) {
    let line = `- \`${row.command}\` — ${row.rejected ? "REJECTED" : row.ok ? "PASS" : "FAIL"} (exit ${row.exitCode ?? "n/a"})`;
    if (row.reason) {
      line += ` [${row.reason}]`;
    }
    lines.push(line);
    if (!row.ok || row.rejected) {
      if (row.stdout?.trim()) {
        lines.push(`  - stdout: ${row.stdout.trim().slice(0, 2000)}`);
      }
      if (row.stderr?.trim()) {
        lines.push(`  - stderr: ${row.stderr.trim().slice(0, 2000)}`);
      }
    }
  }
  return lines.length ? lines : ["- None"];
}

export function createOpenClawQaReport(result) {
  const openclawJob = result.openclawJob || {};
  const lines = [
    "# OpenClaw QA Report",
    "",
    `Generated: ${result.completedAt || new Date().toISOString()}`,
    "",
    "## Job",
    "",
    `- **generic job id:** ${result.genericJobId || result.jobId || ""}`,
    `- **OpenClaw job id:** ${result.openclawJobId || openclawJob.id || ""}`,
    `- **phaseId:** ${result.phaseId || openclawJob.phaseId || ""}`,
    `- **jobType:** ${openclawJob.jobType || "openclaw.qa"}`,
    `- **agentRole:** ${result.agentRole || openclawJob.agentRole || "qa"}`,
    `- **objective:** ${result.objective || openclawJob.objective || ""}`,
    `- **promptHash:** ${result.promptHash || openclawJob.promptHash || ""}`,
    `- **idempotencyKey:** ${result.idempotencyKey || openclawJob.idempotencyKey || ""}`,
    `- **final QA verdict:** ${result.qaVerdict || result.status}`,
    `- **stop reason:** ${result.stopReason || "none"}`,
    "",
    "## Owner Approval",
    "",
    `- **summary:** ${formatApprovalSummary(openclawJob.ownerApproval)}`,
    `- **verification:** ${result.approvalVerification || "not evaluated"}`,
    "",
    "## Commands Run",
    "",
    ...formatCommandRows(result.validationResults),
    "",
    "## Expected Output Results",
    "",
  ];

  for (const row of result.expectedOutputResults?.checks || []) {
    lines.push(`- **${row.type}** — ${row.ok ? "PASS" : "FAIL"}: ${row.detail}`);
  }
  if (!(result.expectedOutputResults?.checks || []).length) {
    lines.push("- None");
  }

  lines.push("", "## Git", "");
  lines.push(`- **summary:** ${result.gitStatusSummary || "unknown"}`);
  lines.push(`- **source change check:** ${result.sourceChangeResult?.ok ? "PASS" : "FAIL"}`);
  if (result.sourceChangeResult?.violations?.length) {
    lines.push(`- **violations:** ${result.sourceChangeResult.violations.join("; ")}`);
  }
  if (result.changedDuringRun?.length) {
    lines.push("", "### Changes During Run", "");
    for (const file of result.changedDuringRun) {
      lines.push(`- ${file}`);
    }
  }

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
  lines.push(result.nextBlockedPhase || "Phase 3.2 — Scheduler (blocked until owner approval)");
  lines.push("");
  return lines.join("\n");
}

export async function writeOpenClawQaReport(result) {
  const path = result.reportPath || buildQaReportPath(result.openclawJob || result);
  await mkdir(dirname(path), { recursive: true });
  const markdown = createOpenClawQaReport(result);
  await writeFile(path, markdown, "utf8");
  return { path, markdown };
}
