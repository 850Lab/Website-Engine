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

export function createOpenClawReport(result) {
  const lines = [
    "# OpenClaw Builder Report",
    "",
    `Generated: ${result.completedAt || new Date().toISOString()}`,
    "",
    "## Job",
    "",
    `- **jobId:** ${result.jobId}`,
    `- **phaseId:** ${result.phaseId}`,
    `- **agentRole:** ${result.agentRole}`,
    `- **objective:** ${result.objective || ""}`,
    `- **final status:** ${result.status}`,
    "",
    "## Commands Run",
    "",
  ];

  for (const row of result.commandResults || []) {
    lines.push(`- \`${row.command}\` — ${row.ok ? "PASS" : "FAIL"} (exit ${row.exitCode})`);
  }

  lines.push("", "## Validation Results", "");
  for (const row of result.validationResults || []) {
    lines.push(`- \`${row.command}\` — ${row.ok ? "PASS" : "FAIL"} (exit ${row.exitCode})`);
  }

  lines.push("", "## Files Changed", "");
  if (result.changedFiles?.length) {
    for (const file of result.changedFiles) {
      lines.push(`- ${file}`);
    }
  } else {
    lines.push("- None");
  }

  lines.push("", "## File Scope", "");
  lines.push(result.scopeResult == null ? "- Not evaluated" : result.scopeResult.ok ? "- PASS" : `- FAIL: ${(result.scopeResult.violations || []).join("; ")}`);

  lines.push("", "## Git", "");
  lines.push(`- **summary:** ${result.gitStatusSummary || "unknown"}`);
  if (result.commitHash) {
    lines.push(`- **commit hash:** ${result.commitHash}`);
  } else {
    lines.push("- **commit hash:** none");
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
