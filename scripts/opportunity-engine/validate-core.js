import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ValidationRunner } from "../../src/engine/validation/runner.js";
import { ValidationReporter } from "../../src/engine/validation/reporter.js";
import { getRepoRoot } from "../../src/engine/validation/env.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const LEGACY_REPORT_MD = join(ROOT, "reports/core-validation.md");
const LEGACY_REPORT_JSON = join(ROOT, "reports/core-validation.json");

function parseArgs(argv) {
  const only = [];
  const phases = [];
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--only=")) {
      only.push(...arg.slice("--only=".length).split(",").map((value) => value.trim()).filter(Boolean));
    }
    if (arg.startsWith("--phases=")) {
      phases.push(...arg.slice("--phases=".length).split(",").map((value) => value.trim()).filter(Boolean));
    }
  }
  return { only, phases };
}

function resolvePhases({ only, phases }) {
  if (phases.length) return phases;
  if (!only.length) return null;
  return only.map((name) => name.replace(/^validate-phase-/, "").replace(/\.js$/, "").replace(/-/g, "."));
}

function renderLegacyMarkdown(summary) {
  const rows = summary.results
    .map(
      (row) =>
        `| ${row.script} | ${row.passed ? "PASS" : row.dependencyBlocked ? "BLOCKED" : "FAIL"} | ${row.duration}ms | ${row.retryCount || 0} | \`${row.script}\` |`,
    )
    .join("\n");

  return `# Core Validation

Generated: ${summary.generatedAt}

## Summary

- **Passed:** ${summary.passed}
- **Failed:** ${summary.failed}
- **Total duration:** ${summary.totalDuration}ms
- **Validators:** ${summary.results.length}

| Validator | Result | Duration | Retries | Command |
|---|---|---:|---:|---|
${rows}
`;
}

export async function runCoreValidation(options = {}) {
  let phases = options.phases || null;
  if (!phases && options.only?.length) {
    phases = options.only.map((name) =>
      name.replace(/^validate-phase-/, "").replace(/\.js$/, "").replace(/-/g, "."),
    );
  }

  const summary = await ValidationRunner.runReleaseSuite({
    repoRoot: getRepoRoot(),
    phases,
    failFast: options.failFast !== false,
  });

  const legacySummary = {
    generatedAt: summary.generatedAt,
    passed: summary.passed,
    failed: summary.failed,
    totalDurationMs: summary.totalDuration,
    results: summary.results.map((row) => ({
      script: row.script,
      command: `node scripts/opportunity-engine/${row.script}`,
      passed: row.passed,
      durationMs: row.duration,
      retryCount: row.retryCount || 0,
      error: row.rootFailures?.[0] || row.error || null,
    })),
  };

  await mkdir(dirname(LEGACY_REPORT_MD), { recursive: true });
  await writeFile(LEGACY_REPORT_MD, renderLegacyMarkdown(legacySummary), "utf8");
  await writeFile(LEGACY_REPORT_JSON, `${JSON.stringify(legacySummary, null, 2)}\n`, "utf8");

  return summary;
}

export async function runReleaseSuite(options = {}) {
  return ValidationRunner.runReleaseSuite({
    repoRoot: getRepoRoot(),
    ...options,
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const args = parseArgs(process.argv);
  const phases = resolvePhases(args);
  const summary = await runReleaseSuite({ phases });

  console.log("\nRelease validation summary");
  console.log(`  Passed: ${summary.passed}`);
  console.log(`  Failed: ${summary.failed}`);
  console.log(`  Skipped/blocked: ${summary.skipped + summary.dependencyBlocked}`);
  console.log(`  Duration: ${summary.totalDuration}ms`);
  console.log(`  Report: reports/release-validation.md`);

  if (summary.rootFailure) {
    console.error(`\nRoot Failure: Phase ${summary.rootFailure.phase} (${summary.rootFailure.script})`);
    if (summary.blockedPhases.length) {
      console.error(`Affected: ${summary.blockedPhases.join(", ")}`);
    }
  }

  if (summary.failed > 0) {
    process.exit(1);
  }
}
