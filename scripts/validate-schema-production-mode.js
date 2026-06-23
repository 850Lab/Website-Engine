#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { useSchemaQueueReads, useSchemaOutcomeWrites } from "../src/services/feature-flags.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = join(ROOT, "data", "migration", "production-mode");
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 8787}`;

function runNodeScript(scriptName) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(ROOT, "scripts", scriptName)], {
      cwd: ROOT,
      env: {
        ...process.env,
        USE_SCHEMA_QUEUE_READS: "1",
        USE_SCHEMA_OUTCOME_WRITES: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function probeServer() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      return { reachable: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const health = await res.json();
    return { reachable: true, baseUrl: BASE_URL, health };
  } catch (err) {
    return { reachable: false, baseUrl: BASE_URL, error: err.message };
  }
}

async function main() {
  if (!useSchemaQueueReads() || !useSchemaOutcomeWrites()) {
    console.error(
      "Set USE_SCHEMA_QUEUE_READS=1 and USE_SCHEMA_OUTCOME_WRITES=1 before running production-mode validation.",
    );
    process.exit(1);
  }

  console.log("Schema production-mode validation");
  console.log("─────────────────────────────────");
  console.log("Flags: USE_SCHEMA_QUEUE_READS=1, USE_SCHEMA_OUTCOME_WRITES=1");
  console.log(`Server probe: ${BASE_URL}`);
  console.log("");

  const [serverProbe, dualRead, outcomeWrites] = await Promise.all([
    probeServer(),
    runNodeScript("run-dual-read-validation.js"),
    runNodeScript("validate-schema-outcome-writes.js"),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    flags: {
      USE_SCHEMA_QUEUE_READS: true,
      USE_SCHEMA_OUTCOME_WRITES: true,
    },
    serverProbe,
    dualRead: {
      ok: dualRead.code === 0,
      exitCode: dualRead.code,
      stdout: dualRead.stdout.trim(),
      stderr: dualRead.stderr.trim(),
    },
    outcomeWrites: {
      ok: outcomeWrites.code === 0,
      exitCode: outcomeWrites.code,
      stdout: outcomeWrites.stdout.trim(),
      stderr: outcomeWrites.stderr.trim(),
    },
    summary: {
      serverReachable: serverProbe.reachable,
      dualReadOk: dualRead.code === 0,
      outcomeWritesOk: outcomeWrites.code === 0,
      ready:
        dualRead.code === 0 &&
        outcomeWrites.code === 0 &&
        (serverProbe.reachable || process.env.REQUIRE_SERVER !== "1"),
    },
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  const reportPath = join(OUTPUT_DIR, "validation-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Server reachable: ${serverProbe.reachable ? "yes" : "no"}`);
  if (serverProbe.reachable) {
    console.log(`Health: ${JSON.stringify(serverProbe.health)}`);
  } else if (serverProbe.error) {
    console.log(`Server probe note: ${serverProbe.error}`);
  }
  console.log(`Dual-read validation: ${dualRead.code === 0 ? "pass" : "fail"}`);
  console.log(`Outcome write validation: ${outcomeWrites.code === 0 ? "pass" : "fail"}`);
  console.log(`Report: ${reportPath}`);

  if (!report.summary.ready) {
    if (dualRead.stderr) console.error(dualRead.stderr);
    if (outcomeWrites.stderr) console.error(outcomeWrites.stderr);
    process.exit(1);
  }

  console.log("");
  console.log("Production-mode ready. Manual UI checks:");
  console.log("  1. Website sales queue loads and advances");
  console.log("  2. Outcome + note on a lead persist after refresh");
  console.log("  3. PW queue loads and status/note actions persist after refresh");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
