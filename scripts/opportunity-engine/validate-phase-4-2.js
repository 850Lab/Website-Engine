import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapValidator, finalizeValidator } from "../../src/engine/validation/index.js";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("4.2");

function fail(message) {
  errors.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

for (const rel of [
  "src/engine/founder-intent/backlog-selector.js",
  "src/engine/founder-intent/business-operators.js",
  "src/engine/founder-intent/engineering-task-registry.js",
  "src/engine/founder-intent/openclaw-handoff.js",
  "src/engine/sensors/live/file-drop-sensor.js",
  "scripts/opportunity-engine/validate-engineering-director.js",
  "scripts/opportunity-engine/validate-engineering-task-registry.js",
  "scripts/opportunity-engine/validate-openclaw-handoff.js",
  "scripts/opportunity-engine/validate-business-operators.js",
  "scripts/opportunity-engine/validate-business-discovery.js",
  "scripts/opportunity-engine/validate-phase-4-2.js",
]) {
  try {
    await execFileAsync(process.execPath, ["--check", join(ROOT, rel)], { cwd: ROOT });
    pass(`${rel} syntax check passed`);
  } catch (error) {
    fail(`${rel} syntax check failed: ${error.message}`);
  }
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-engineering-director.js")], {
    cwd: ROOT,
    env: { ...process.env },
  });
  pass("Engineering Director focused validation passed");
} catch (error) {
  fail(`Engineering Director focused validation failed: ${error.stderr || error.message}`);
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-engineering-task-registry.js")], {
    cwd: ROOT,
    env: { ...process.env },
  });
  pass("Engineering task registry validation passed");
} catch (error) {
  fail(`Engineering task registry validation failed: ${error.stderr || error.message}`);
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-openclaw-handoff.js")], {
    cwd: ROOT,
    env: { ...process.env },
  });
  pass("OpenClaw handoff validation passed");
} catch (error) {
  fail(`OpenClaw handoff validation failed: ${error.stderr || error.message}`);
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-business-operators.js")], {
    cwd: ROOT,
    env: { ...process.env },
  });
  pass("Business operator validation passed");
} catch (error) {
  fail(`Business operator validation failed: ${error.stderr || error.message}`);
}

try {
  await execFileAsync(process.execPath, [join(ROOT, "scripts/opportunity-engine/validate-business-discovery.js")], {
    cwd: ROOT,
    env: { ...process.env },
  });
  pass("Business discovery validation passed");
} catch (error) {
  fail(`Business discovery validation failed: ${error.stderr || error.message}`);
}

await finalizeValidator({ phase: "4.2", errors, startedAt: __validationStartedAt });

console.log("\nPhase 4.2 validation passed.");
console.log("Engineering Director backlog execution model active. STOP.");
