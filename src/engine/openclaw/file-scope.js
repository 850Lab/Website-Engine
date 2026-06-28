const DEFAULT_FORBIDDEN_PREFIXES = [
  "runtime/",
  "src/engine/mission-control/",
  "src/engine/score-council/",
  "src/mission-control/",
];

function normalizePath(filePath) {
  return String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+/g, "/");
}

function globToRegExp(pattern) {
  const normalized = normalizePath(pattern);
  let regex = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const rest = normalized.slice(index);

    if (rest.startsWith("**/*")) {
      regex += ".*";
      index += 3;
      continue;
    }
    if (rest.startsWith("**")) {
      regex += ".*";
      index += 1;
      continue;
    }
    if (char === "*") {
      regex += "[^/]*";
      continue;
    }
    if (char === "?") {
      regex += "[^/]";
      continue;
    }
    regex += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  regex += "$";
  return new RegExp(regex);
}

function matchesPattern(pattern, filePath) {
  const normalized = normalizePath(filePath);
  const globPattern = normalizePath(pattern);

  if (globPattern.endsWith("/**")) {
    const prefix = globPattern.slice(0, -3);
    return normalized === prefix || normalized.startsWith(`${prefix}/`);
  }

  if (globPattern.includes("*") || globPattern.includes("?")) {
    return globToRegExp(globPattern).test(normalized);
  }

  return normalized === globPattern || normalized.endsWith(`/${globPattern}`);
}

function matchesAnyPattern(patterns, filePath) {
  return patterns.some((pattern) => matchesPattern(pattern, filePath));
}

export function enforceFileScope(job, changedFiles = [], options = {}) {
  const allowedFiles = Array.isArray(job?.allowedFiles) ? job.allowedFiles : [];
  const forbiddenFiles = Array.isArray(job?.forbiddenFiles) ? job.forbiddenFiles : [];
  const constraints = job?.constraints || {};
  const violations = [];
  const normalizedChanged = changedFiles.map(normalizePath).filter(Boolean);
  const commitScope = options.commitScope === true;

  const validationDemo =
    options.validationDemo === true ||
    job?.metadata?.validationDemo === true ||
    job?.ownerApproval?.phaseDocStatus === "VALIDATION_DEMO";

  for (const file of normalizedChanged) {
    if (file.startsWith("runtime/")) {
      violations.push(`Runtime file change not committable: ${file}`);
    }

    if (matchesAnyPattern(forbiddenFiles, file)) {
      violations.push(`Forbidden file touched: ${file}`);
    }

    if (constraints.noMissionControlChanges !== false) {
      if (file.startsWith("src/engine/mission-control/") || file.startsWith("src/mission-control/")) {
        violations.push(`Mission Control change forbidden: ${file}`);
      }
    }

    if (constraints.noScoreCouncilChanges !== false && file.startsWith("src/engine/score-council/")) {
      violations.push(`Score Council change forbidden: ${file}`);
    }

    for (const prefix of DEFAULT_FORBIDDEN_PREFIXES) {
      if (prefix !== "runtime/" && file.startsWith(prefix) && constraints[`no${prefix}`] !== false) {
        if (prefix.includes("mission-control") && constraints.noMissionControlChanges === false) continue;
        if (prefix.includes("score-council") && constraints.noScoreCouncilChanges === false) continue;
      }
    }

    if (commitScope && allowedFiles.length > 0 && !matchesAnyPattern(allowedFiles, file)) {
      violations.push(`File outside allowedFiles: ${file}`);
    } else if (!commitScope && !validationDemo && allowedFiles.length > 0 && normalizedChanged.length > 0) {
      const reportOnly = file.startsWith("reports/openclaw/");
      if (!reportOnly && !matchesAnyPattern(allowedFiles, file)) {
        violations.push(`Unexpected file change outside scope: ${file}`);
      }
    }
  }

  if (commitScope && allowedFiles.length === 0 && normalizedChanged.length > 0) {
    violations.push("Commit requested but allowedFiles is empty");
  }

  return {
    ok: violations.length === 0,
    violations,
    changedFiles: normalizedChanged,
  };
}

export { normalizePath, matchesPattern };
