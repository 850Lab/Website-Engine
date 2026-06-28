import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getRepoRoot } from "../runtime/index.js";
import { validateCommandAllowlist, splitCommand } from "./command-allowlist.js";

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 300_000;

export async function runCommand(command, options = {}) {
  const cwd = options.cwd || getRepoRoot();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const optional = Boolean(options.optional);
  const startedAt = new Date().toISOString();
  const allowlist = validateCommandAllowlist(command);

  if (!allowlist.allowed && options.skipAllowlist !== true) {
    return {
      command,
      ok: false,
      rejected: true,
      optional,
      exitCode: 1,
      stdout: "",
      stderr: allowlist.detail,
      startedAt,
      completedAt: new Date().toISOString(),
      reason: allowlist.reason,
      error: allowlist.detail,
    };
  }

  const parts = splitCommand(command);
  const executable = parts[0];
  const args = parts.slice(1);

  try {
    const { stdout, stderr } = await execFileAsync(executable, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, ...(options.env || {}) },
    });

    return {
      command,
      ok: true,
      rejected: false,
      optional,
      exitCode: 0,
      stdout: stdout || "",
      stderr: stderr || "",
      startedAt,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      command,
      ok: false,
      rejected: false,
      optional,
      exitCode: error.code ?? 1,
      stdout: error.stdout?.toString?.() || "",
      stderr: error.stderr?.toString?.() || error.message,
      startedAt,
      completedAt: new Date().toISOString(),
      error: error.message,
    };
  }
}

export async function runCommands(commands = [], options = {}) {
  const results = [];

  for (const entry of commands) {
    const command = typeof entry === "string" ? entry : entry.command;
    const optional = typeof entry === "object" ? Boolean(entry.optional) : false;
    const result = await runCommand(command, {
      ...options,
      optional,
    });
    results.push(result);

    if (result.rejected && !optional) {
      break;
    }

    if (!result.ok && !optional && options.stopOnFailure !== false) {
      break;
    }
  }

  return {
    results,
    ok: results.every((row) => row.ok || row.optional),
    rejected: results.some((row) => row.rejected),
  };
}

export { validateCommandAllowlist, splitCommand };
