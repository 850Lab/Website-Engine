import { access } from "node:fs/promises";

const IGNORED_CHANGE_PREFIXES = ["reports/openclaw/"];

const FORBIDDEN_CHANGE_PREFIXES = [
  "runtime/",
  "src/engine/mission-control/",
  "src/engine/score-council/",
  "src/mission-control/",
];

function normalizeSpec(spec) {
  if (typeof spec === "string") {
    return { type: spec };
  }
  return spec || {};
}

function isIgnoredPath(path) {
  return IGNORED_CHANGE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function verifyNoSourceChanges(changedDuringRun = [], options = {}) {
  const violations = [];
  for (const file of changedDuringRun) {
    if (isIgnoredPath(file)) {
      continue;
    }
    if (options.validationDemo && options.allowValidationDemo) {
      if (FORBIDDEN_CHANGE_PREFIXES.some((prefix) => file.startsWith(prefix))) {
        violations.push(`Forbidden path changed during QA demo: ${file}`);
      }
      continue;
    }
    violations.push(`Source or tracked file changed during QA run: ${file}`);
  }
  return { ok: violations.length === 0, violations };
}

async function evaluateSpec(spec, result) {
  const entry = normalizeSpec(spec);
  const type = entry.type;

  if (type === "commandExitCodeZero") {
    const failed = (result.validationResults || []).find((row) => !row.ok || row.rejected);
    return {
      type,
      ok: !failed,
      detail: failed ? `Command failed: ${failed.command}` : "All validation commands exited zero",
    };
  }

  if (type === "containsText") {
    const haystack =
      entry.in === "stderr"
        ? (result.validationResults || []).map((row) => row.stderr || "").join("\n")
        : (result.validationResults || []).map((row) => row.stdout || "").join("\n");
    const ok = haystack.includes(String(entry.text || ""));
    return { type, ok, detail: ok ? `Contains text: ${entry.text}` : `Missing text: ${entry.text}` };
  }

  if (type === "doesNotContainText") {
    const haystack =
      entry.in === "stderr"
        ? (result.validationResults || []).map((row) => row.stderr || "").join("\n")
        : (result.validationResults || []).map((row) => row.stdout || "").join("\n");
    const ok = !haystack.includes(String(entry.text || ""));
    return { type, ok, detail: ok ? `Does not contain: ${entry.text}` : `Forbidden text found: ${entry.text}` };
  }

  if (type === "gitStatusClean") {
    const changes = (result.changedDuringRun || []).filter((path) => !isIgnoredPath(path));
    const ok = changes.length === 0;
    return {
      type,
      ok,
      detail: ok ? "Git status clean (excluding QA reports)" : `Unexpected changes: ${changes.join(", ")}`,
    };
  }

  if (type === "noRuntimeFilesTracked") {
    const runtimeChanges = (result.changedDuringRun || []).filter((path) => path.startsWith("runtime/"));
    return {
      type,
      ok: runtimeChanges.length === 0,
      detail: runtimeChanges.length ? `Runtime files changed: ${runtimeChanges.join(", ")}` : "No runtime files tracked",
    };
  }

  if (type === "reportWritten") {
    let ok = false;
    if (result.reportPath) {
      try {
        await access(result.reportPath);
        ok = true;
      } catch {
        ok = false;
      }
    }
    return { type, ok, detail: ok ? `Report written: ${result.reportPath}` : "QA report not found" };
  }

  if (type === "eventsEmitted") {
    const ok = (result.events || []).length > 0;
    return {
      type,
      ok,
      detail: ok ? `${result.events.length} event(s) emitted` : "No events emitted",
    };
  }

  return { type: type || "unknown", ok: false, detail: `Unknown expected output type: ${type}` };
}

export async function evaluateExpectedOutputs(result, expectedOutputs = []) {
  const checks = [];
  for (const spec of expectedOutputs) {
    checks.push(await evaluateSpec(spec, result));
  }
  return {
    ok: checks.every((row) => row.ok),
    checks,
  };
}
