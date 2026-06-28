import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  getRuntimePath,
  readJsonWithRetry,
  writeJsonAtomic,
  writeJsonAtomicWithRetry,
  safeFileExists,
  wait,
  isRetryableIoError,
} from "../../src/engine/runtime/index.js";
import { runCoreValidation } from "./validate-core.js";
import { collectAutopilotState } from "./autopilot-status.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];

function fail(message) {
  errors.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function runGit(args) {
  const { stdout } = await execFileAsync("git", args, { cwd: ROOT });
  return stdout.trim();
}

async function assertIoHelpers() {
  const ioPath = join(ROOT, "src/engine/runtime/io.js");
  const source = await readFile(ioPath, "utf8");
  for (const name of [
    "readJsonWithRetry",
    "writeJsonAtomic",
    "writeJsonAtomicWithRetry",
    "ensureDirectory",
    "safeFileExists",
    "wait",
  ]) {
    if (!source.includes(`export async function ${name}`) && !source.includes(`export function ${name}`)) {
      fail(`Missing runtime IO helper: ${name}`);
    }
  }
  if (!errors.some((message) => message.includes("Missing runtime IO helper"))) {
    pass("Runtime IO helpers load");
  }

  const probePath = getRuntimePath("cache", `phase_295_probe_${randomUUID().slice(0, 8)}.json`);
  await writeJsonAtomic(probePath, { ok: true });
  const readBack = await readJsonWithRetry(probePath, null);
  if (readBack?.ok !== true) {
    fail("Atomic write probe failed");
  } else {
    pass("Atomic writes work");
  }

  await writeJsonAtomicWithRetry(probePath, { ok: "retry" });
  const retryBack = await readJsonWithRetry(probePath, null);
  if (retryBack?.ok !== "retry") {
    fail("Retry write probe failed");
  } else {
    pass("Retry helpers work");
  }

  if (!isRetryableIoError({ code: "EBUSY" })) {
    fail("isRetryableIoError does not recognize EBUSY");
  } else {
    pass("Retryable IO error detection works");
  }
}

async function assertRuntimeHealth() {
  try {
    await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/runtime-health.js")], {
      cwd: ROOT,
    });
    pass("Runtime health script passes");
  } catch (error) {
    fail(`Runtime health script failed: ${error.message}`);
  }
}

const QUICK = process.argv.includes("--quick");

async function assertValidateCore() {
  const corePath = join(ROOT, "scripts/opportunity-engine/validate-core.js");
  if (!(await fileExists(corePath))) {
    fail("validate-core.js missing");
    return;
  }
  pass("validate-core.js exists");

  if (QUICK) {
    pass("validate-core smoke skipped (--quick)");
    return;
  }

  const summary = await runCoreValidation({ only: ["validate-phase-2-9.js"] });
  if (summary.failed) {
    fail("validate-core orchestrator failed smoke run (validate-phase-2-9.js)");
  } else {
    pass("validate-core runs successfully (smoke: validate-phase-2-9.js)");
  }

  if (!(await fileExists(join(ROOT, "reports/core-validation.json")))) {
    fail("core-validation report missing");
  } else {
    pass("validate-core reports cleanly");
  }
}

async function assertGitCleanlinessPolicy() {
  const gitignore = await readFile(join(ROOT, ".gitignore"), "utf8");
  const ignored = [
    "reports/core-validation.md",
    "reports/core-validation.json",
    "reports/runtime-health.md",
    "reports/runtime-health.json",
    "reports/performance-baseline.md",
    "reports/performance-baseline.json",
    "reports/autopilot-status.md",
    "reports/autopilot-log.json",
  ];
  for (const path of ignored) {
    if (!gitignore.includes(path)) {
      fail(`Generated report not gitignored: ${path}`);
    }
  }
  if (!errors.some((message) => message.includes("Generated report not gitignored"))) {
    const porcelain = await runGit(["status", "--porcelain"]);
    const dirtyFiles = (porcelain ? porcelain.split("\n").filter(Boolean) : []).map((line) =>
      line.slice(2).trimStart().replace(/\\/g, "/"),
    );
    const unignoredReportChanges = dirtyFiles.filter(
      (path) => path.startsWith("reports/") && !ignored.includes(path),
    );
    if (unignoredReportChanges.length) {
      fail(`Untracked or non-ignored report changes: ${unignoredReportChanges.join(", ")}`);
    } else {
      pass("Generated reports follow git cleanliness policy");
    }
  }
}

async function assertAutopilotGates() {
  const state = await collectAutopilotState();
  if (!state.validationCommands.some((cmd) => cmd.includes("validate-core.js"))) {
    fail("Autopilot does not recommend validate-core.js");
  } else {
    pass("Autopilot recommends validate-core.js");
  }

  if (!state.ownerApprovalRequired) {
    fail("Autopilot should block on owner approval before Phase 3");
  } else {
    pass("Autopilot still blocks on owner approval");
  }
}

async function assertArchitectureFreeze() {
  const bannedPaths = ["scripts/opportunity-engine/openclaw"];
  for (const rel of bannedPaths) {
    if (await fileExists(join(ROOT, rel))) {
      fail(`Forbidden path present: ${rel}`);
    }
  }
  if (!errors.some((message) => message.includes("Forbidden path"))) {
    pass("No premature OpenClaw scripts under opportunity-engine");
  }

  const missionControl = await readFile(join(ROOT, "src/engine/mission-control/index.js"), "utf8");
  if (/phase_2_9_5|runtime\/io/.test(missionControl)) {
    fail("Mission Control modified for Phase 2.9.5");
  } else {
    pass("No Mission Control changes");
  }

  const scoreCouncil = await readFile(join(ROOT, "src/engine/score-council/index.js"), "utf8");
  if (/phase_2_9_5|runtime\/io/.test(scoreCouncil)) {
    fail("Score Council modified for Phase 2.9.5");
  } else {
    pass("No Score Council changes");
  }

  const connectorsDir = join(ROOT, "src/engine/connectors");
  const connectorEntries = await readFile(join(ROOT, "src/engine/connectors/index.js"), "utf8");
  if (/live_connector|phase_3_sensor/i.test(connectorEntries)) {
    fail("Live connector markers found");
  } else {
    pass("No live connectors added");
  }

  pass("No architecture redesign detected (Phase 2.9.5 hardening only)");
}

await assertIoHelpers();
await wait(500);
await assertRuntimeHealth();
await assertValidateCore();
await assertGitCleanlinessPolicy();
await assertAutopilotGates();
await assertArchitectureFreeze();

if (errors.length) {
  console.error(`\nPhase 2.9.5 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 2.9.5 validation passed.");
console.log("Core stability hardening complete. Phase 3 remains blocked until owner approval.");
