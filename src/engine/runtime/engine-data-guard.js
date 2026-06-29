import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), "../../.."));

function normalizePath(path) {
  return resolve(path).replace(/\\/g, "/");
}

function engineDataRoot() {
  return normalizePath(join(REPO_ROOT, "engine-data"));
}

function runtimeValidationRoot() {
  return normalizePath(join(REPO_ROOT, "runtime-validation"));
}

function defaultRuntimeRoot() {
  return normalizePath(join(REPO_ROOT, "runtime"));
}

function getEffectiveRuntimeRoot() {
  const override =
    process.env.OPPORTUNITY_RUNTIME_DIR ||
    process.env.OPPORTUNITY_OS_RUNTIME_DIR ||
    process.env.OPPORTUNITY_VALIDATION_RUNTIME_DIR;
  return normalizePath(override || defaultRuntimeRoot());
}

export function isEngineDataPath(path) {
  if (!path) return false;
  const normalized = normalizePath(path);
  const root = engineDataRoot();
  return normalized === root || normalized.startsWith(`${root}/`);
}

export function assertRuntimeOverrideSafe(overridePath) {
  if (!overridePath) return;
  if (isEngineDataPath(overridePath)) {
    throw new Error(`Runtime override must not target engine-data/: ${overridePath}`);
  }
}

export function assertNotEngineDataWritePath(path) {
  if (isEngineDataPath(path)) {
    throw new Error(`engine-data/ is read-only — refused write: ${path}`);
  }
}

function isRuntimeValidationPath(path) {
  const normalized = normalizePath(path);
  const root = runtimeValidationRoot();
  return normalized === root || normalized.startsWith(`${root}/`);
}

export function assertRuntimeWritePath(path) {
  assertNotEngineDataWritePath(path);
  const normalized = normalizePath(path);
  const runtimeRoot = getEffectiveRuntimeRoot();
  if (normalized === runtimeRoot || normalized.startsWith(`${runtimeRoot}/`)) {
    return;
  }
  if (isRuntimeValidationPath(normalized)) {
    return;
  }
  throw new Error(`Write path must be under active runtime or runtime-validation/: ${path}`);
}

export function getEngineDataRoot() {
  return join(REPO_ROOT, "engine-data");
}
