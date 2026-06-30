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
  getRuntimeSignalStorePath,
  getRuntimeFactStorePath,
  getRuntimeGraphStorePath,
  getRuntimeSituationStorePath,
  getRuntimeHypothesisStorePath,
  getRuntimeProblemStorePath,
  getRuntimeCapabilityMatchStorePath,
  getRuntimeOfferRecommendationStorePath,
  getRuntimeOpportunityStorePath,
  getRuntimeEventStorePath,
  getRuntimeJobStorePath,
  getRuntimeMissionStorePath,
  getRuntimeEngineeringTaskStorePath,
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
const GENERATED_REPORTS = Object.freeze([
  "reports/autopilot-status.md",
  "reports/autopilot-log.json",
  "reports/core-validation.md",
  "reports/core-validation.json",
  "reports/release-validation.md",
  "reports/release-validation.json",
  "reports/runtime-health.md",
  "reports/runtime-health.json",
  "reports/backlog-progress-dashboard.md",
  "reports/backlog-progress-dashboard.json",
  "reports/performance-baseline.md",
  "reports/performance-baseline.json",
]);

function nowIso() {
  return process.env.OPPORTUNITY_HEALTH_GENERATED_AT || new Date().toISOString();
}

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

async function countJsonArrayStore(path, key) {
  const store = await readJsonWithRetry(path, null);
  const collection = key ? store?.[key] : store;
  return Array.isArray(collection) ? collection.length : 0;
}

async function countJsonl(path) {
  if (!(await safeFileExists(path))) return 0;
  const content = await readFile(path, "utf8");
  return content.split(/\r?\n/).filter((line) => line.trim()).length;
}

async function collectRuntimeStoreHealth() {
  const stores = [
    { name: "signals", path: getRuntimeSignalStorePath(), key: "signals" },
    { name: "facts", path: getRuntimeFactStorePath(), key: "facts" },
    { name: "graphNodes", path: getRuntimeGraphStorePath(), key: "nodes" },
    { name: "situations", path: getRuntimeSituationStorePath(), key: "situations" },
    { name: "hypotheses", path: getRuntimeHypothesisStorePath(), key: "hypotheses" },
    { name: "problems", path: getRuntimeProblemStorePath(), key: "problems" },
    { name: "capabilityMatches", path: getRuntimeCapabilityMatchStorePath(), key: "matches" },
    { name: "offerRecommendations", path: getRuntimeOfferRecommendationStorePath(), key: "recommendations" },
    { name: "opportunities", path: getRuntimeOpportunityStorePath(), key: "opportunities" },
    { name: "jobs", path: getRuntimeJobStorePath(), key: "jobs" },
    { name: "missions", path: getRuntimeMissionStorePath(), key: "missions" },
    { name: "engineeringTasks", path: getRuntimeEngineeringTaskStorePath(), key: "tasks" },
  ];

  const rows = [];
  for (const store of stores) {
    rows.push({
      name: store.name,
      path: store.path.replace(/\\/g, "/"),
      count: await countJsonArrayStore(store.path, store.key),
      exists: await safeFileExists(store.path),
    });
  }
  rows.push({
    name: "events",
    path: getRuntimeEventStorePath().replace(/\\/g, "/"),
    count: await countJsonl(getRuntimeEventStorePath()),
    exists: await safeFileExists(getRuntimeEventStorePath()),
  });
  return rows;
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
  const probePayload = { probe: true, at: nowIso() };
  await writeJsonAtomic(probePath, probePayload);
  const atomicRead = await readJsonWithRetry(probePath, null);
  record(
    "Atomic write works",
    atomicRead?.probe === true,
  );

  await wait(50);
  const retryPayload = { probe: "retry", at: nowIso() };
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
  const allIgnored = GENERATED_REPORTS.every((path) => reportsGitignore.includes(path));
  record(
    "Reports directory can be reset or ignored safely",
    allIgnored,
    allIgnored ? "generated reports listed in .gitignore" : "missing .gitignore entries",
  );

  const runtimeStores = await collectRuntimeStoreHealth();
  record(
    "Runtime store health collected",
    runtimeStores.length >= 10 && runtimeStores.every((row) => Number.isInteger(row.count)),
    `${runtimeStores.length} stores`,
  );

  const summary = {
    schemaVersion: "4.2.s1",
    generatedAt: nowIso(),
    runtimeRoot: getRuntimeRoot().replace(/\\/g, "/"),
    passed: checks.filter((row) => row.passed).length,
    failed: checks.filter((row) => !row.passed).length,
    checks,
    runtimeStores,
    reportPolicy: {
      generatedReports: [...GENERATED_REPORTS],
      gitignored: allIgnored,
    },
  };

  const markdown = `# Runtime Health

Generated: ${summary.generatedAt}

## Summary

- **Passed:** ${summary.passed}
- **Failed:** ${summary.failed}
- **Runtime stores:** ${summary.runtimeStores.length}
- **Generated reports gitignored:** ${summary.reportPolicy.gitignored ? "yes" : "no"}

| Check | Result | Detail |
|---|---|---|
${checks.map((row) => `| ${row.name} | ${row.passed ? "PASS" : "FAIL"} | ${row.detail || ""} |`).join("\n")}

## Runtime Stores

| Store | Count | Path |
|---|---:|---|
${runtimeStores.map((row) => `| ${row.name} | ${row.count} | ${row.path} |`).join("\n")}

## Generated Report Policy

| Report | Gitignored |
|---|---|
${GENERATED_REPORTS.map((path) => `| ${path} | ${allIgnored ? "yes" : "no"} |`).join("\n")}
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
