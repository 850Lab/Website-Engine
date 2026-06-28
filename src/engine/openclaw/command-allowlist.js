const FORBIDDEN_SHELL_PATTERNS = [
  /&&/,
  /\|\|/,
  /;/,
  /`/,
  /\$\(/,
  /\$\{/,
  /\|\s*(?!$)/,
  /(^|\s)>\s/,
  /(^|\s)<\s/,
];

const FORBIDDEN_EXECUTABLES = new Set([
  "powershell",
  "powershell.exe",
  "cmd",
  "cmd.exe",
  "bash",
  "sh",
  "curl",
  "wget",
  "rm",
  "del",
  "erase",
  "rmdir",
  "rd",
]);

function normalizeExecutable(value) {
  const base = String(value || "").replace(/\\/g, "/").split("/").pop() || "";
  return base.toLowerCase();
}

function isGitStatusAllowed(args) {
  if (args.length === 0) {
    return true;
  }
  return args.every((arg) => arg === "--short" || arg === "--porcelain");
}

function isGitDiffAllowed(args) {
  return args.includes("--name-only");
}

function isGitCommitAllowed(args) {
  return args.includes("-m");
}

function isGitLogAllowed(args) {
  return args[0] === "-1";
}

function isGitRevParseAllowed(args) {
  return args.length === 1 && args[0] === "HEAD";
}

function isNodeEval(args) {
  return args.some((arg) => arg === "-e" || arg === "--eval" || arg.startsWith("-e") || arg.startsWith("--eval="));
}

const QA_BLOCKED_GIT = new Set(["add", "commit", "checkout", "reset", "apply", "cherry-pick", "merge", "rebase", "push", "pull", "clean", "rm"]);

const QA_ALLOWED_NPM_SCRIPTS = new Set(["autopilot:status", "autopilot:check"]);

function isQaNodeCommand(args) {
  if (args.includes("--check")) {
    return true;
  }
  for (const arg of args) {
    const normalized = String(arg).replace(/\\/g, "/");
    if (/scripts\/opportunity-engine\/validate-[^/]+\.js$/i.test(normalized)) {
      return true;
    }
  }
  return false;
}

export function validateQaCommandAllowlist(command) {
  const trimmed = String(command || "").trim();
  if (!trimmed) {
    return { allowed: false, reason: "empty_command", detail: "Command is empty" };
  }

  for (const pattern of FORBIDDEN_SHELL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: "shell_metacharacter",
        detail: "Shell chaining, pipes, redirection, or substitution is forbidden",
      };
    }
  }

  let parts;
  try {
    parts = splitCommand(trimmed);
  } catch (error) {
    return { allowed: false, reason: "invalid_command", detail: error.message };
  }

  const executable = normalizeExecutable(parts[0]);
  const args = parts.slice(1);

  if (FORBIDDEN_EXECUTABLES.has(executable)) {
    return {
      allowed: false,
      reason: "executable_not_allowlisted",
      detail: `Executable not allowlisted: ${parts[0]}`,
    };
  }

  if (executable === "node" || executable === "node.exe") {
    if (isNodeEval(args)) {
      return { allowed: false, reason: "node_eval_forbidden", detail: "node -e / --eval is forbidden" };
    }
    if (!isQaNodeCommand(args)) {
      return {
        allowed: false,
        reason: "qa_node_command_forbidden",
        detail: "QA node commands must use --check or scripts/opportunity-engine/validate-*.js",
      };
    }
    return { allowed: true, reason: "qa_node_allowed", executable: parts[0], args };
  }

  if (executable === "npm" || executable === "npm.cmd") {
    if (args[0] !== "run" || !QA_ALLOWED_NPM_SCRIPTS.has(args[1])) {
      return {
        allowed: false,
        reason: "qa_npm_run_forbidden",
        detail: "QA npm run limited to autopilot:status and autopilot:check",
      };
    }
    return { allowed: true, reason: "qa_npm_allowed", executable: parts[0], args };
  }

  if (executable === "git" || executable === "git.exe") {
    const subcommand = args[0];
    if (QA_BLOCKED_GIT.has(subcommand)) {
      return {
        allowed: false,
        reason: "qa_git_write_forbidden",
        detail: `Git write/mutate command forbidden for QA: git ${subcommand}`,
      };
    }
    if (subcommand === "status" && isGitStatusAllowed(args.slice(1))) {
      return { allowed: true, reason: "git_status_allowed", executable: parts[0], args };
    }
    if (subcommand === "diff" && isGitDiffAllowed(args.slice(1))) {
      return { allowed: true, reason: "git_diff_allowed", executable: parts[0], args };
    }
    if (subcommand === "rev-parse" && isGitRevParseAllowed(args.slice(1))) {
      return { allowed: true, reason: "git_rev_parse_allowed", executable: parts[0], args };
    }
    if (subcommand === "log" && isGitLogAllowed(args.slice(1))) {
      return { allowed: true, reason: "git_log_allowed", executable: parts[0], args };
    }
    return {
      allowed: false,
      reason: "git_subcommand_not_allowlisted",
      detail: `Git subcommand not allowlisted for QA: git ${subcommand || ""}`.trim(),
    };
  }

  return {
    allowed: false,
    reason: "executable_not_allowlisted",
    detail: `Executable not allowlisted for QA: ${parts[0]}`,
  };
}

export function validateCommandAllowlist(command) {
  const trimmed = String(command || "").trim();
  if (!trimmed) {
    return { allowed: false, reason: "empty_command", detail: "Command is empty" };
  }

  for (const pattern of FORBIDDEN_SHELL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: "shell_metacharacter",
        detail: "Shell chaining, pipes, redirection, or substitution is forbidden",
      };
    }
  }

  let parts;
  try {
    parts = splitCommand(trimmed);
  } catch (error) {
    return { allowed: false, reason: "invalid_command", detail: error.message };
  }

  const executable = normalizeExecutable(parts[0]);
  const args = parts.slice(1);

  if (FORBIDDEN_EXECUTABLES.has(executable)) {
    return {
      allowed: false,
      reason: "executable_not_allowlisted",
      detail: `Executable not allowlisted: ${parts[0]}`,
    };
  }

  if (executable === "node" || executable === "node.exe") {
    if (isNodeEval(args)) {
      return {
        allowed: false,
        reason: "node_eval_forbidden",
        detail: "node -e / --eval is forbidden",
      };
    }
    return { allowed: true, reason: "node_allowed", executable: parts[0], args };
  }

  if (executable === "npm" || executable === "npm.cmd") {
    if (args[0] !== "run") {
      return { allowed: false, reason: "npm_run_only", detail: "Only npm run is allowlisted" };
    }
    return { allowed: true, reason: "npm_run_allowed", executable: parts[0], args };
  }

  if (executable === "git" || executable === "git.exe") {
    const subcommand = args[0];
    if (subcommand === "status" && isGitStatusAllowed(args.slice(1))) {
      return { allowed: true, reason: "git_status_allowed", executable: parts[0], args };
    }
    if (subcommand === "diff" && isGitDiffAllowed(args.slice(1))) {
      return { allowed: true, reason: "git_diff_allowed", executable: parts[0], args };
    }
    if (subcommand === "add") {
      return { allowed: true, reason: "git_add_allowed", executable: parts[0], args };
    }
    if (subcommand === "commit" && isGitCommitAllowed(args.slice(1))) {
      return { allowed: true, reason: "git_commit_allowed", executable: parts[0], args };
    }
    if (subcommand === "rev-parse" && isGitRevParseAllowed(args.slice(1))) {
      return { allowed: true, reason: "git_rev_parse_allowed", executable: parts[0], args };
    }
    if (subcommand === "log" && isGitLogAllowed(args.slice(1))) {
      return { allowed: true, reason: "git_log_allowed", executable: parts[0], args };
    }
    return {
      allowed: false,
      reason: "git_subcommand_not_allowlisted",
      detail: `Git subcommand not allowlisted: git ${subcommand || ""}`.trim(),
    };
  }

  return {
    allowed: false,
    reason: "executable_not_allowlisted",
    detail: `Executable not allowlisted: ${parts[0]}`,
  };
}

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

export { splitCommand };
