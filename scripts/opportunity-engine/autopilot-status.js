import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const PHASE_DOC = join(ROOT, "docs/opportunity-os/08-current-phase.md");
const BUILD_LOG = join(ROOT, "docs/opportunity-os/09-build-log.md");
const STATUS_REPORT = join(ROOT, "reports/autopilot-status.md");
const LOG_REPORT = join(ROOT, "reports/autopilot-log.json");

const VALIDATION_SCRIPTS = [
  "scripts/opportunity-engine/validate-phase-0-5.js",
  "scripts/opportunity-engine/validate-phase-1.js",
  "scripts/opportunity-engine/validate-phase-2-1.js",
  "scripts/opportunity-engine/validate-phase-2-2.js",
  "scripts/opportunity-engine/validate-phase-2-2-5.js",
  "scripts/opportunity-engine/validate-phase-2-3.js",
  "scripts/opportunity-engine/validate-phase-2-4.js",
  "scripts/opportunity-engine/validate-phase-2-5.js",
];

function nowIso() {
  return new Date().toISOString();
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function runGit(args) {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd: ROOT });
    return stdout.trim();
  } catch (error) {
    return error.stdout?.trim() || "";
  }
}

export async function getGitSummary() {
  const porcelain = await runGit(["status", "--porcelain"]);
  const lines = porcelain ? porcelain.split("\n").filter(Boolean) : [];
  const dirtyFiles = lines.map((line) => {
    const rawPath = line.slice(2).trimStart();
    if (rawPath.includes(" -> ")) {
      return rawPath.split(" -> ").pop().trim();
    }
    return rawPath;
  });
  const branch = await runGit(["branch", "--show-current"]);
  const lastCommit = await runGit(["log", "-1", "--format=%h %s (%an, %ci)"]);

  let summary = "clean";
  if (lines.length) {
    const modified = lines.filter((line) => line.startsWith(" M") || line.startsWith("M")).length;
    const added = lines.filter((line) => line.startsWith("??") || line.startsWith("A")).length;
    const deleted = lines.filter((line) => line.startsWith(" D") || line.startsWith("D")).length;
    summary = `${lines.length} change(s): ${modified} modified, ${added} untracked/new, ${deleted} deleted`;
  }

  return {
    branch: branch || "unknown",
    lastCommit: lastCommit || "unknown",
    dirtyFiles,
    isDirty: lines.length > 0,
    statusSummary: summary,
    porcelain,
  };
}

export function parsePhaseDocument(content) {
  const currentMatch = content.match(
    /\*\*Phase ([0-9.]+)[^*]*\*\* — \*\*(COMPLETE|ACTIVE|BLOCKED)\*\*/i,
  );

  const currentPhase = currentMatch
    ? `Phase ${currentMatch[1]}`.replace(/\s+/g, " ").trim()
    : "Unknown";
  const currentPhaseStatus = currentMatch?.[2]?.toUpperCase() || "UNKNOWN";

  const blockedSections = [...content.matchAll(/## Phase ([^\n]+)\n\n\*\*([^*]+)\*\*[^\n]*\n\n([^#]+)/g)]
    .filter((match) => /blocked/i.test(match[1]) || /blocked/i.test(match[0]))
    .map((match) => ({
      title: match[1].trim(),
      headline: match[2].trim(),
      body: match[3].trim(),
    }));

  const validationCommands = [
    ...new Set([...content.matchAll(/Run: `([^`]+)`/g)].map((match) => match[1])),
  ];

  const nextBlockedMatch = content.match(/## Phase ([0-9.]+)[^\n]*\((Blocked)\)[\s\S]*?\n\n([^#]+)/i);
  const nextRecommendedSubphase = nextBlockedMatch
    ? `Phase ${nextBlockedMatch[1].trim()} — ${nextBlockedMatch[3].split("\n")[0].trim()}`
    : blockedSections[0]?.headline || "See docs/opportunity-os/08-current-phase.md";

  const ownerApprovalRequired =
    /blocked until owner|owner approv/i.test(content) ||
    currentPhaseStatus === "BLOCKED" ||
    blockedSections.length > 0;

  const blockers = [];
  if (ownerApprovalRequired) {
    blockers.push("Next subphase is blocked until owner approval and explicit implementation prompt.");
  }
  if (currentPhaseStatus === "ACTIVE") {
    blockers.push("Current phase is ACTIVE — complete validation before marking COMPLETE.");
  }

  return {
    currentPhase,
    currentPhaseStatus,
    validationCommands,
    nextRecommendedSubphase,
    ownerApprovalRequired,
    blockers,
    blockedSections,
  };
}

export function parseLastMilestone(buildLogContent) {
  const entries = [...buildLogContent.matchAll(/### ([^\n]+)\n\*\*Phase:\*\* ([^\n]+)\n\*\*Type:\*\* ([^\n]+)\n\*\*Summary:\*\* ([^\n]+)/g)];
  const last = entries.at(-1);
  if (!last) {
    return {
      title: "Unknown",
      phase: "Unknown",
      type: "Unknown",
      summary: "No build log entries found.",
    };
  }

  return {
    title: last[1].trim(),
    phase: last[2].trim(),
    type: last[3].trim(),
    summary: last[4].trim(),
  };
}

export async function collectAutopilotState() {
  const phaseContent = await readFile(PHASE_DOC, "utf8");
  const buildLogContent = await readFile(BUILD_LOG, "utf8");
  const git = await getGitSummary();
  const phase = parsePhaseDocument(phaseContent);
  const lastMilestone = parseLastMilestone(buildLogContent);

  const missingValidationScripts = [];
  for (const script of VALIDATION_SCRIPTS) {
    if (!(await fileExists(join(ROOT, script)))) {
      missingValidationScripts.push(script);
    }
  }

  const recommendedNextStep = phase.ownerApprovalRequired
    ? "Stop for owner approval. Review reports/autopilot-status.md, then authorize the next blocked subphase in docs/opportunity-os/08-current-phase.md."
    : `Run validation, commit work, then implement the active subphase in ${PHASE_DOC}.`;

  return {
    timestamp: nowIso(),
    currentPhase: phase.currentPhase,
    currentPhaseStatus: phase.currentPhaseStatus,
    lastCommit: git.lastCommit,
    branch: git.branch,
    dirtyFiles: git.dirtyFiles,
    gitStatusSummary: git.statusSummary,
    isDirty: git.isDirty,
    validationCommands: [
      ...new Set([
        ...phase.validationCommands,
        ...VALIDATION_SCRIPTS.map((script) => `node ${script}`),
      ]),
    ],
    allValidationScripts: VALIDATION_SCRIPTS,
    missingValidationScripts,
    lastCompletedMilestone: lastMilestone,
    nextRecommendedSubphase: phase.nextRecommendedSubphase,
    blockers: phase.blockers,
    ownerApprovalRequired: phase.ownerApprovalRequired,
    recommendedNextStep,
  };
}

function renderStatusMarkdown(state) {
  const validationList = state.validationCommands.map((cmd) => `- \`${cmd}\``).join("\n");
  const blockers =
    state.blockers.length > 0
      ? state.blockers.map((item) => `- ${item}`).join("\n")
      : "- None";

  const dirtyFiles =
    state.dirtyFiles.length > 0
      ? state.dirtyFiles.map((file) => `- ${file}`).join("\n")
      : "- Working tree clean";

  return `# Autopilot Status

Generated: ${state.timestamp}

## Current Phase

- **Phase:** ${state.currentPhase}
- **Status:** ${state.currentPhaseStatus}

## Git

- **Branch:** ${state.branch}
- **Last commit:** ${state.lastCommit}
- **Summary:** ${state.gitStatusSummary}

### Changed files

${dirtyFiles}

## Validation Commands

${validationList}

## Last Completed Milestone

- **Title:** ${state.lastCompletedMilestone.title}
- **Phase:** ${state.lastCompletedMilestone.phase}
- **Type:** ${state.lastCompletedMilestone.type}
- **Summary:** ${state.lastCompletedMilestone.summary}

## Next Recommended Subphase

${state.nextRecommendedSubphase}

## Blockers

${blockers}

## Owner Approval Required

**${state.ownerApprovalRequired ? "Yes" : "No"}**

## Recommended Next Step

${state.recommendedNextStep}

---

Run \`npm run autopilot:check\` before starting automated work.
Run \`npm run autopilot:status\` to refresh this report.
`;
}

export async function writeAutopilotReports(state = null) {
  const snapshot = state || (await collectAutopilotState());
  await mkdir(dirname(STATUS_REPORT), { recursive: true });

  const logPayload = {
    timestamp: snapshot.timestamp,
    currentPhase: snapshot.currentPhase,
    currentPhaseStatus: snapshot.currentPhaseStatus,
    lastCommit: snapshot.lastCommit,
    branch: snapshot.branch,
    dirtyFiles: snapshot.dirtyFiles,
    gitStatusSummary: snapshot.gitStatusSummary,
    recommendedNextStep: snapshot.recommendedNextStep,
    nextRecommendedSubphase: snapshot.nextRecommendedSubphase,
    blockers: snapshot.blockers,
    ownerApprovalRequired: snapshot.ownerApprovalRequired,
    validationCommands: snapshot.validationCommands,
    missingValidationScripts: snapshot.missingValidationScripts,
  };

  await writeFile(STATUS_REPORT, renderStatusMarkdown(snapshot), "utf8");
  await writeFile(LOG_REPORT, `${JSON.stringify(logPayload, null, 2)}\n`, "utf8");

  return {
    statusReport: STATUS_REPORT,
    logReport: LOG_REPORT,
    snapshot,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const result = await writeAutopilotReports();
  console.log(`Wrote ${result.statusReport}`);
  console.log(`Wrote ${result.logReport}`);
  console.log(`Current phase: ${result.snapshot.currentPhase} (${result.snapshot.currentPhaseStatus})`);
  console.log(`Owner approval required: ${result.snapshot.ownerApprovalRequired ? "yes" : "no"}`);
}
