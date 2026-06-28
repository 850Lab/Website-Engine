import { writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { wait } from "../../src/engine/runtime/io.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_MD = join(ROOT, "reports/core-validation.md");
const REPORT_JSON = join(ROOT, "reports/core-validation.json");

const VALIDATORS = [
  "validate-phase-0-5.js",
  "validate-phase-1.js",
  "validate-phase-2-1.js",
  "validate-phase-2-2.js",
  "validate-phase-2-2-5.js",
  "validate-phase-2-3.js",
  "validate-phase-2-4.js",
  "validate-phase-2-5.js",
  "validate-phase-2-5-5.js",
  "validate-phase-2-6.js",
  "validate-phase-2-7.js",
  "validate-phase-2-8.js",
  "validate-phase-2-9.js",
];

const DELAY_BETWEEN_MS = 1500;
const RETRYABLE = /\b(EBUSY|EPERM|EACCES)\b/;

function parseArgs(argv) {
  const only = [];
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--only=")) {
      only.push(...arg.slice("--only=".length).split(",").map((value) => value.trim()).filter(Boolean));
    }
  }
  return { only };
}

function normalizeValidatorName(name) {
  return name.endsWith(".js") ? name : `${name}.js`;
}

function resolveValidators({ only }) {
  if (!only.length) return VALIDATORS;
  return only.map((name) => {
    const normalized = normalizeValidatorName(name);
    if (!VALIDATORS.includes(normalized)) {
      throw new Error(`Unknown validator: ${name}`);
    }
    return normalized;
  });
}

async function runValidator(scriptName) {
  const scriptPath = join(ROOT, "scripts/opportunity-engine", scriptName);
  const command = `node ${join("scripts/opportunity-engine", scriptName)}`;
  const started = Date.now();
  let retryCount = 0;
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await execFileAsync(process.execPath, [scriptPath], { cwd: ROOT });
      return {
        script: scriptName,
        command,
        passed: true,
        durationMs: Date.now() - started,
        retryCount,
      };
    } catch (error) {
      lastError = error;
      const output = `${error.message}\n${error.stdout || ""}\n${error.stderr || ""}`;
      if (attempt === 1 && RETRYABLE.test(output)) {
        retryCount += 1;
        await wait(2000);
        continue;
      }
      break;
    }
  }

  return {
    script: scriptName,
    command,
    passed: false,
    durationMs: Date.now() - started,
    retryCount,
    error: lastError?.message || "Unknown error",
  };
}

function renderMarkdown(summary) {
  const rows = summary.results
    .map(
      (row) =>
        `| ${row.script} | ${row.passed ? "PASS" : "FAIL"} | ${row.durationMs}ms | ${row.retryCount} | \`${row.command}\` |`,
    )
    .join("\n");

  return `# Core Validation

Generated: ${summary.generatedAt}

## Summary

- **Passed:** ${summary.passed}
- **Failed:** ${summary.failed}
- **Total duration:** ${summary.totalDurationMs}ms
- **Validators:** ${summary.results.length}

| Validator | Result | Duration | Retries | Command |
|---|---|---:|---:|---|
${rows}

${summary.failed ? "## Failures\n\n" + summary.results.filter((row) => !row.passed).map((row) => `- **${row.script}:** ${row.error}`).join("\n") : ""}
`;
}

export async function runCoreValidation(options = {}) {
  const validators = resolveValidators(options);
  const started = Date.now();
  const results = [];

  for (let index = 0; index < validators.length; index += 1) {
    const script = validators[index];
    console.log(`\n[core-validation] Running ${script} (${index + 1}/${validators.length})`);
    const result = await runValidator(script);
    results.push(result);
    console.log(
      `[core-validation] ${result.passed ? "PASS" : "FAIL"} ${script} (${result.durationMs}ms, retries=${result.retryCount})`,
    );
    if (index < validators.length - 1) {
      await wait(DELAY_BETWEEN_MS);
    }
  }

  const passed = results.filter((row) => row.passed).length;
  const failed = results.length - passed;
  const summary = {
    generatedAt: new Date().toISOString(),
    passed,
    failed,
    totalDurationMs: Date.now() - started,
    results,
  };

  await mkdir(dirname(REPORT_MD), { recursive: true });
  await writeFile(REPORT_MD, renderMarkdown(summary), "utf8");
  await writeFile(REPORT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  return summary;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const options = parseArgs(process.argv);
  const summary = await runCoreValidation(options);

  console.log("\nCore validation summary");
  console.log(`  Passed: ${summary.passed}`);
  console.log(`  Failed: ${summary.failed}`);
  console.log(`  Duration: ${summary.totalDurationMs}ms`);
  console.log(`  Report: reports/core-validation.md`);

  if (summary.failed) {
    process.exit(1);
  }
}
