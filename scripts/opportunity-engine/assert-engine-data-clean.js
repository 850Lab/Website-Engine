import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function getEngineDataGitStatus(options = {}) {
  const cwd = options.cwd || ROOT;
  const { stdout } = await execFileAsync("git", ["status", "--short", "engine-data"], { cwd });
  return stdout
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function assertEngineDataClean(options = {}) {
  const lines = await getEngineDataGitStatus(options);
  if (lines.length) {
    throw new Error(`engine-data/ must remain clean:\n${lines.join("\n")}`);
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  try {
    await assertEngineDataClean();
    console.log("PASS: engine-data/ is clean");
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  }
}
