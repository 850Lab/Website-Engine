import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getRepoRoot } from "../runtime/index.js";

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 300_000;

function splitCommand(command) {
  const trimmed = String(command || "").trim();
  if (!trimmed) {
    throw new Error("Empty command");
  }

  const parts = [];
  let current = "";
  let quote = null;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === " ") {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (current) {
    parts.push(current);
  }

  if (!parts.length) {
    throw new Error(`Invalid command: ${command}`);
  }

  return parts;
}

export async function runCommand(command, options = {}) {
  const cwd = options.cwd || getRepoRoot();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const optional = Boolean(options.optional);
  const startedAt = new Date().toISOString();
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
    if (!result.ok && !optional && options.stopOnFailure !== false) {
      break;
    }
  }

  return {
    results,
    ok: results.every((row) => row.ok || row.optional),
  };
}
