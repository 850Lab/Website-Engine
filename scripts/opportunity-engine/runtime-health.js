import { writeFile, mkdir, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  getRuntimeRoot,
  getRuntimePath,
  ensureRuntimeDirectories,
  readJsonWithRetry,
  writeJsonAtomic,
  writeJsonAtomicWithRetry,
  safeFileExists,
  wait,
} from "../../src/engine/runtime/index.js";
import { initializeRuntimeSignalStore } from "../../src/engine/signals/index.js";
import { initializeRuntimeFactStore } from "../../src/engine/facts/index.js";
import { initializeGraphStore } from "../../src/engine/graph-store/index.js";
import { initializeSituationStore } from "../../src/engine/situations/index.js";
import { initializeHypothesisStore } from "../../src/engine/hypotheses/index.js";
import { initializeProblemStore } from "../../src/engine/problems/index.js";
import { initializeCapabilityMatchStore } from "../../src/engine/capability-matches/index.js";
import { initializeOfferRecommendationStore } from "../../src/engine/offer-recommendations/index.js";
import { initializeOpportunityStore } from "../../src/engine/opportunities/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_MD = join(ROOT, "reports/runtime-health.md");
const REPORT_JSON = join(ROOT, "reports/runtime-health.json");

const checks = [];
const errors = [];

function record(name, passed, detail = "") {
  checks.push({ name, passed, detail });
  if (passed) {
    console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    errors.push(name);
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function runGit(args) {
  const { stdout } = await execFileAsync("git", args, { cwd: ROOT });
  return stdout.trim();
}

async function main() {
  const beforeGit = await runGit(["status", "--porcelain"]);
  const beforeLines = beforeGit ? beforeGit.split("\n").filter(Boolean) : [];

  record(
    "Runtime directory exists",
    await safeFileExists(getRuntimeRoot()) || await safeFileExists(getRuntimePath()),
    getRuntimeRoot(),
  );

  await ensureRuntimeDirectories();
  await initializeRuntimeSignalStore();
  await initializeRuntimeFactStore();
  await initializeGraphStore();
  await initializeSituationStore();
  await initializeHypothesisStore();
  await initializeProblemStore();
  await initializeCapabilityMatchStore();
  await initializeOfferRecommendationStore();
  await initializeOpportunityStore();
  record("Runtime stores initialize", true);

  const probePath = getRuntimePath("cache", `health_probe_${randomUUID().slice(0, 8)}.json`);
  const probePayload = { probe: true, at: new Date().toISOString() };
  await writeJsonAtomic(probePath, probePayload);
  const atomicRead = await readJsonWithRetry(probePath, null);
  record(
    "Atomic write works",
    atomicRead?.probe === true,
  );

  await wait(50);
  const retryPayload = { probe: "retry", at: new Date().toISOString() };
  await writeJsonAtomicWithRetry(probePath, retryPayload);
  const retryRead = await readJsonWithRetry(probePath, null);
  record(
    "Retry read/write works",
    retryRead?.probe === "retry",
  );

  record(
    "Runtime files readable after writes",
    (await safeFileExists(probePath)) && retryRead != null,
  );

  const afterRuntimeGit = await runGit(["status", "--porcelain"]);
  const afterLines = afterRuntimeGit ? afterRuntimeGit.split("\n").filter(Boolean) : [];
  const runtimeChanges = afterLines.filter((line) => {
    const path = line.slice(2).trimStart();
    if (path.endsWith(".gitkeep")) return false;
    return path.startsWith("runtime/");
  });
  record(
    "Gitignored runtime writes do not dirty git",
    runtimeChanges.length === 0,
    runtimeChanges.length ? runtimeChanges.join(", ") : "no runtime paths in git status",
  );

  const engineDataChanges = afterLines.filter((line) => {
    const path = line.slice(2).trimStart();
    return path.startsWith("engine-data/") && !beforeLines.includes(line);
  });
  record(
    "No engine-data writes during runtime operations",
    engineDataChanges.length === 0,
  );

  await mkdir(join(ROOT, "reports"), { recursive: true });
  const reportsGitignore = await readFile(join(ROOT, ".gitignore"), "utf8");
  const ignoredReports = [
    "reports/autopilot-status.md",
    "reports/autopilot-log.json",
    "reports/core-validation.md",
    "reports/core-validation.json",
    "reports/runtime-health.md",
    "reports/runtime-health.json",
    "reports/performance-baseline.md",
    "reports/performance-baseline.json",
  ];
  const allIgnored = ignoredReports.every((path) => reportsGitignore.includes(path));
  record(
    "Reports directory can be reset or ignored safely",
    allIgnored,
    allIgnored ? "generated reports listed in .gitignore" : "missing .gitignore entries",
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    passed: checks.filter((row) => row.passed).length,
    failed: checks.filter((row) => !row.passed).length,
    checks,
  };

  const markdown = `# Runtime Health

Generated: ${summary.generatedAt}

## Summary

- **Passed:** ${summary.passed}
- **Failed:** ${summary.failed}

| Check | Result | Detail |
|---|---|---|
${checks.map((row) => `| ${row.name} | ${row.passed ? "PASS" : "FAIL"} | ${row.detail || ""} |`).join("\n")}
`;

  await writeFile(REPORT_MD, markdown, "utf8");
  await writeFile(REPORT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log("\nRuntime health summary");
  console.log(`  Passed: ${summary.passed}`);
  console.log(`  Failed: ${summary.failed}`);
  console.log(`  Report: reports/runtime-health.md`);

  if (summary.failed) {
    process.exit(1);
  }
}

await main();
