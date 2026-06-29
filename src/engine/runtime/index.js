import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertRuntimeOverrideSafe } from "./engine-data-guard.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export function getRepoRoot() {
  return REPO_ROOT;
}

export function getRuntimeRoot() {
  const override =
    process.env.OPPORTUNITY_RUNTIME_DIR ||
    process.env.OPPORTUNITY_OS_RUNTIME_DIR ||
    process.env.OPPORTUNITY_VALIDATION_RUNTIME_DIR;
  if (override) {
    assertRuntimeOverrideSafe(override);
    return override;
  }
  return join(REPO_ROOT, "runtime");
}

export function getRuntimePath(...parts) {
  return join(getRuntimeRoot(), ...parts);
}

export async function ensureRuntimeDirectories() {
  const directories = [
    getRuntimeRoot(),
    getRuntimePath("signals"),
    getRuntimePath("signals", "raw"),
    getRuntimePath("facts"),
    getRuntimePath("graph"),
    getRuntimePath("situations"),
    getRuntimePath("hypotheses"),
    getRuntimePath("problems"),
    getRuntimePath("capability-matches"),
    getRuntimePath("offer-recommendations"),
    getRuntimePath("opportunities"),
    getRuntimePath("events"),
    getRuntimePath("jobs"),
    getRuntimePath("scheduler"),
    getRuntimePath("dispatch"),
    getRuntimePath("inbox"),
    getRuntimePath("orchestrator"),
    getRuntimePath("logs"),
    getRuntimePath("cache"),
  ];

  for (const directory of directories) {
    await mkdir(directory, { recursive: true });
  }
}

export function getRuntimeSignalStorePath() {
  return getRuntimePath("signals", "signals.json");
}

export function getRuntimeRawSignalPath(...parts) {
  return getRuntimePath("signals", "raw", ...parts);
}

export function getRuntimeFactStorePath() {
  return getRuntimePath("facts", "facts.json");
}

export function getRuntimeGraphDirectory() {
  return getRuntimePath("graph");
}

export function getRuntimeGraphStorePath() {
  return getRuntimePath("graph", "graph.json");
}

export function getRuntimeSituationStorePath() {
  return getRuntimePath("situations", "situations.json");
}

export function getRuntimeHypothesisStorePath() {
  return getRuntimePath("hypotheses", "hypotheses.json");
}

export function getRuntimeProblemStorePath() {
  return getRuntimePath("problems", "problems.json");
}

export function getRuntimeCapabilityMatchStorePath() {
  return getRuntimePath("capability-matches", "capability-matches.json");
}

export function getRuntimeOfferRecommendationStorePath() {
  return getRuntimePath("offer-recommendations", "offer-recommendations.json");
}

export function getRuntimeOpportunityStorePath() {
  return getRuntimePath("opportunities", "opportunities.json");
}

export function getRuntimeEventStorePath() {
  return getRuntimePath("events", "events.jsonl");
}

export function getRuntimeJobStorePath() {
  return getRuntimePath("jobs", "jobs.json");
}

export function getRuntimeSchedulerDirectory() {
  return getRuntimePath("scheduler");
}

export function getRuntimeSchedulerStorePath() {
  return getRuntimePath("scheduler", "scheduler.json");
}

export function getRuntimeDispatchDirectory() {
  return getRuntimePath("dispatch");
}

export function getRuntimeDispatchStorePath() {
  return getRuntimePath("dispatch", "dispatch.json");
}

export function getRuntimeInboxDirectory() {
  return getRuntimePath("inbox");
}

export function getRuntimeInboxObservationsDirectory() {
  return getRuntimePath("inbox", "observations");
}

export function getRuntimeInboxProcessedDirectory() {
  return getRuntimePath("inbox", "observations", "processed");
}

export function getRuntimeOrchestratorDirectory() {
  return getRuntimePath("orchestrator");
}

export function getRuntimeOrchestratorStorePath() {
  return getRuntimePath("orchestrator", "orchestrator.json");
}

export function getLegacySignalStorePath() {
  return join(REPO_ROOT, "engine-data", "signals", "signals.json");
}

export function toRepoRelativePath(absolutePath) {
  const repo = REPO_ROOT.replace(/\\/g, "/");
  const normalized = absolutePath.replace(/\\/g, "/");
  if (normalized.startsWith(`${repo}/`)) {
    return normalized.slice(repo.length + 1);
  }
  return normalized;
}

export function usesRuntimeOverride() {
  return Boolean(
    process.env.OPPORTUNITY_RUNTIME_DIR ||
      process.env.OPPORTUNITY_OS_RUNTIME_DIR ||
      process.env.OPPORTUNITY_VALIDATION_RUNTIME_DIR,
  );
}

export {
  assertNotEngineDataWritePath,
  assertRuntimeWritePath,
  isEngineDataPath,
  assertRuntimeOverrideSafe,
  getEngineDataRoot,
} from "./engine-data-guard.js";

export {
  wait,
  safeFileExists,
  ensureDirectory,
  withRetry,
  readJsonWithRetry,
  writeJsonAtomic,
  writeJsonAtomicWithRetry,
  appendJsonLineWithRetry,
  readJsonLinesWithRetry,
  isRetryableIoError,
} from "./io.js";
