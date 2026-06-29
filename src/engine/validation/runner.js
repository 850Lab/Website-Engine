import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { wait } from "../runtime/io.js";
import { ValidationRuntime } from "./runtime.js";
import { ValidationReporter } from "./reporter.js";
import {
  getBlockedPhases,
  resolveExecutionOrder,
  VALIDATOR_GRAPH,
} from "./graph.js";
import { getRepoRoot } from "./env.js";

const execFileAsync = promisify(execFile);
const RETRYABLE = /\b(EBUSY|EPERM|EACCES)\b/;

export class ValidationRunner {
  static async runReleaseSuite(options = {}) {
    const runner = new ValidationRunner(options);
    return runner.run();
  }

  constructor(options = {}) {
    this.options = options;
    this.repoRoot = options.repoRoot || getRepoRoot();
    this.scriptsDir = join(this.repoRoot, "scripts/opportunity-engine");
    this.failFast = options.failFast !== false;
    this.phases = options.phases || null;
    this.executionOrder = resolveExecutionOrder(this.phases);
  }

  async run() {
    const started = Date.now();
    const results = [];
    let rootFailure = null;
    const completed = new Set();

    for (const node of this.executionOrder) {
      const unmet = node.dependsOn.filter((dep) => !completed.has(dep));
      if (unmet.length) {
        const blocked = {
          phase: node.phase,
          script: node.script,
          passed: false,
          duration: 0,
          rootFailures: [`Blocked by missing dependencies: ${unmet.join(", ")}`],
          warnings: [],
          skipped: true,
          dependencyBlocked: true,
          artifacts: [],
          runtimePath: null,
        };
        results.push(blocked);
        continue;
      }

      if (rootFailure && this.failFast) {
        results.push({
          phase: node.phase,
          script: node.script,
          passed: false,
          duration: 0,
          rootFailures: [],
          warnings: [],
          skipped: true,
          dependencyBlocked: true,
          artifacts: [],
          runtimePath: null,
        });
        continue;
      }

      console.log(`\n[release-validation] Running ${node.script} (${node.phase})`);
      const result = await this.runValidator(node);
      results.push(result);
      if (result.passed) {
        completed.add(node.phase);
      } else if (!rootFailure) {
        rootFailure = result;
        if (this.failFast) {
          console.error(`\n[release-validation] Root failure at Phase ${node.phase}. Stopping.`);
        }
      }
    }

    const passed = results.filter((row) => row.passed).length;
    const failed = results.filter((row) => !row.passed && !row.skipped && !row.dependencyBlocked).length;
    const skipped = results.filter((row) => row.skipped).length;
    const dependencyBlocked = results.filter((row) => row.dependencyBlocked).length;
    const summary = {
      generatedAt: new Date().toISOString(),
      passed,
      failed,
      skipped,
      dependencyBlocked,
      totalDuration: Date.now() - started,
      rootFailure,
      blockedPhases: rootFailure ? getBlockedPhases(rootFailure.phase) : [],
      regressionSummary:
        "Validators executed once in dependency order with isolated runtime-validation workspaces. Nested subprocess regressions disabled.",
      results,
    };

    await ValidationReporter.writeReleaseReport(summary, this.options);
    return summary;
  }

  async runValidator(node) {
    const runtime = await ValidationRuntime.create();
    const resultPath = join(runtime.reportsDir, "validator-result.json");
    const scriptPath = join(this.scriptsDir, node.script);
    const started = Date.now();
    let retryCount = 0;
    let lastError = null;

    const env = {
      ...process.env,
      VALIDATION_FRAMEWORK_MANAGED: "1",
      OPPORTUNITY_OS_VALIDATION_RUNNER: "1",
      VALIDATION_SKIP_NESTED: "1",
      OPPORTUNITY_RUNTIME_DIR: runtime.root,
      OPPORTUNITY_OS_RUNTIME_DIR: runtime.root,
      OPPORTUNITY_VALIDATION_RUNTIME_DIR: runtime.root,
      VALIDATION_RESULT_PATH: resultPath,
      VALIDATION_PHASE: node.phase,
    };

    if (node.script === "validate-phase-3-4.js") {
      env.OPENCLAW_ALLOW_VALIDATION_DEMO = "1";
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await execFileAsync(process.execPath, [scriptPath], {
          cwd: this.repoRoot,
          env,
        });
        lastError = null;
        break;
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

    let structured = null;
    try {
      structured = JSON.parse(await readFile(resultPath, "utf8"));
    } catch {
      structured = null;
    }

    await runtime.cleanup();

    if (structured) {
      return {
        ...structured,
        script: node.script,
        retryCount,
      };
    }

    return {
      phase: node.phase,
      script: node.script,
      passed: !lastError,
      duration: Date.now() - started,
      rootFailures: lastError ? [lastError.stderr?.trim() || lastError.message || "Validator failed"] : [],
      warnings: [],
      skipped: false,
      dependencyBlocked: false,
      artifacts: [],
      runtimePath: runtime.root,
      retryCount,
      error: lastError?.message || null,
    };
  }
}

export { VALIDATOR_GRAPH, resolveExecutionOrder };
