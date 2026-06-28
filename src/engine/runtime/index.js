import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export function getRepoRoot() {
  return REPO_ROOT;
}

export function getRuntimeRoot() {
  const override = process.env.OPPORTUNITY_OS_RUNTIME_DIR;
  if (override) return override;
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
  return Boolean(process.env.OPPORTUNITY_OS_RUNTIME_DIR);
}

export {
  wait,
  safeFileExists,
  ensureDirectory,
  withRetry,
  readJsonWithRetry,
  writeJsonAtomic,
  writeJsonAtomicWithRetry,
  isRetryableIoError,
} from "./io.js";
