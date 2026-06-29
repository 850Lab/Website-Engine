import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export function getRepoRoot() {
  return REPO_ROOT;
}

export function resolveRuntimeOverride() {
  return (
    process.env.OPPORTUNITY_RUNTIME_DIR ||
    process.env.OPPORTUNITY_OS_RUNTIME_DIR ||
    process.env.OPPORTUNITY_VALIDATION_RUNTIME_DIR ||
    null
  );
}

export function setValidationRuntimeDir(dir) {
  process.env.OPPORTUNITY_RUNTIME_DIR = dir;
  process.env.OPPORTUNITY_OS_RUNTIME_DIR = dir;
  process.env.OPPORTUNITY_VALIDATION_RUNTIME_DIR = dir;
}

export function clearValidationRuntimeDir() {
  delete process.env.OPPORTUNITY_RUNTIME_DIR;
  delete process.env.OPPORTUNITY_OS_RUNTIME_DIR;
  delete process.env.OPPORTUNITY_VALIDATION_RUNTIME_DIR;
}

export function isValidationFrameworkManaged() {
  return process.env.VALIDATION_FRAMEWORK_MANAGED === "1";
}

export function shouldSkipNestedRegressions() {
  if (process.env.VALIDATION_ALLOW_NESTED === "1") {
    return false;
  }
  return (
    process.env.VALIDATION_SKIP_NESTED === "1" ||
    process.env.VALIDATION_FRAMEWORK_MANAGED === "1" ||
    Boolean(process.env.OPPORTUNITY_VALIDATION_RUNTIME_DIR)
  );
}

export function getValidationResultPath() {
  return process.env.VALIDATION_RESULT_PATH || null;
}
