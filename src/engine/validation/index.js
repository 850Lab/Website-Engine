import { writeFile, mkdir } from "node:fs/promises";
import { ValidationContext } from "./context.js";
import { ValidationReporter } from "./reporter.js";
import {
  getValidationResultPath,
  isValidationFrameworkManaged,
  shouldSkipNestedRegressions,
} from "./env.js";

export {
  getRepoRoot,
  resolveRuntimeOverride,
  setValidationRuntimeDir,
  clearValidationRuntimeDir,
  isValidationFrameworkManaged,
  shouldSkipNestedRegressions,
  getValidationResultPath,
} from "./env.js";

export { ValidationContext } from "./context.js";
export { ValidationRuntime } from "./runtime.js";
export { ValidationAssertions } from "./assertions.js";
export { ValidationReporter } from "./reporter.js";
export { ValidationRunner, VALIDATOR_GRAPH, resolveExecutionOrder } from "./runner.js";
export {
  VALIDATOR_GRAPH as validatorGraph,
  getValidatorByPhase,
  getValidatorByScript,
  getBlockedPhases,
} from "./graph.js";

let activeContext = null;

export async function bootstrapValidator(phase, options = {}) {
  if (activeContext) return activeContext;
  const cleanupOnFinish = options.cleanupOnFinish ?? !isValidationFrameworkManaged();
  activeContext = await ValidationContext.create(phase, { cleanupOnFinish, ...options });
  return activeContext;
}

export function getActiveValidationContext() {
  return activeContext;
}

export async function emitValidatorResult(result) {
  const resultPath = getValidationResultPath();
  if (resultPath) {
    await ValidationReporter.writeValidatorResult(resultPath, result);
  }
  return result;
}

export async function finalizeValidator({ phase, errors = [], warnings = [], artifacts = [], startedAt = null }) {
  const passed = errors.length === 0;
  const result = {
    phase,
    passed,
    duration: startedAt ? Date.now() - startedAt : 0,
    rootFailures: passed ? [] : [...errors],
    warnings: [...warnings],
    skipped: false,
    artifacts: [...artifacts],
    runtimePath: activeContext?.runtimePath || process.env.OPPORTUNITY_VALIDATION_RUNTIME_DIR || process.env.OPPORTUNITY_RUNTIME_DIR || null,
  };

  if (activeContext) {
    const contextResult = activeContext.buildResult({ passed, skipped: false });
    result.warnings = [...new Set([...result.warnings, ...contextResult.warnings])];
    result.runtimePath = activeContext.runtimePath || result.runtimePath;
    await activeContext.finish({ passed, skipped: false });
    activeContext = null;
  }

  await emitValidatorResult(result);

  if (!passed) {
    console.error(`\nPhase ${phase} validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }
}

export async function runManagedValidator(phase, execute, options = {}) {
  const startedAt = Date.now();
  const context = await bootstrapValidator(phase, options);
  const errors = [];
  const fail = (message) => {
    errors.push(message);
    context.fail(message);
  };
  const pass = (message) => context.pass(message);
  const warn = (message) => context.warn(message);

  try {
    await execute({ context, fail, pass, warn, assertions: context.assertions });
  } catch (error) {
    fail(error.message || String(error));
  }

  await finalizeValidator({ phase, errors, warnings: context.buildResult().warnings, startedAt });
}
