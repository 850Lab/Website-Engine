import { stat } from "node:fs/promises";
import { ensureRuntimeDirectories, getRuntimePath } from "../../src/engine/runtime/index.js";

export async function isRuntimeDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export function runtimeDirectoryLabel(...parts) {
  return `runtime/${parts.join("/")}/`;
}

export async function assertRuntimeDirectoryExists(fail, pass, passLabel, ...parts) {
  const dir = getRuntimePath(...parts);
  if (!(await isRuntimeDirectory(dir))) {
    fail(`${runtimeDirectoryLabel(...parts)} missing`);
    return false;
  }
  pass(passLabel);
  return true;
}

export async function assertEnsureRuntimeDirectoriesCreates(fail, pass, passLabel, ...parts) {
  await ensureRuntimeDirectories();
  return assertRuntimeDirectoryExists(fail, pass, passLabel, ...parts);
}
