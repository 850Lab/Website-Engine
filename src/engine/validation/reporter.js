import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getRepoRoot } from "./env.js";

export class ValidationReporter {
  static async writeValidatorResult(resultPath, result) {
    if (!resultPath) return;
    await mkdir(join(resultPath, ".."), { recursive: true });
    await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  static async writeReleaseReport(summary, options = {}) {
    const reportDir = options.reportDir || join(getRepoRoot(), "reports");
    const mdPath = join(reportDir, "release-validation.md");
    const jsonPath = join(reportDir, "release-validation.json");
    await mkdir(reportDir, { recursive: true });
    await writeFile(mdPath, ValidationReporter.renderReleaseMarkdown(summary), "utf8");
    await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    return { mdPath, jsonPath };
  }

  static renderReleaseMarkdown(summary) {
    const rows = summary.results
      .map((row) => {
        const status = row.skipped
          ? "SKIPPED"
          : row.dependencyBlocked
            ? "DEPENDENCY BLOCKED"
            : row.passed
              ? "PASS"
              : "FAIL";
        return `| ${row.phase} | ${row.script} | ${status} | ${row.duration}ms | ${row.rootFailures?.[0] || ""} |`;
      })
      .join("\n");

    const rootFailureSection =
      summary.rootFailure == null
        ? ""
        : `\n## Root Failure\n\n- **Phase:** ${summary.rootFailure.phase}\n- **Script:** ${summary.rootFailure.script}\n- **Cause:** ${summary.rootFailure.rootFailures?.join("; ") || summary.rootFailure.error || "unknown"}\n`;

    const blockedSection =
      summary.blockedPhases?.length > 0
        ? `\n## Dependency Blocked\n\n${summary.blockedPhases.map((phase) => `- ${phase}`).join("\n")}\n`
        : "";

    return `# Release Validation

Generated: ${summary.generatedAt}

## Summary

- **Passed:** ${summary.passed}
- **Failed:** ${summary.failed}
- **Skipped:** ${summary.skipped}
- **Dependency blocked:** ${summary.dependencyBlocked}
- **Total duration:** ${summary.totalDuration}ms
- **Coverage:** ${summary.results.length} validators

| Phase | Script | Result | Duration | Root cause |
|---|---|---|---:|---|
${rows}
${rootFailureSection}${blockedSection}
## Regression Summary

${summary.regressionSummary || "Each validator executed once via dependency graph (no nested subprocess regressions)."}
`;
  }
}
