#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { createJob } from "../../src/engine/jobs/index.js";
import {
  deriveOpenClawIdempotencyKey,
  hashCanonicalPromptText,
  loadPromptArtifact,
} from "../../src/engine/openclaw/index.js";

const DEMO_PROMPT_PATH = "engine-data/openclaw/prompts/demo-phase-3-1-7.json";

const { artifact } = await loadPromptArtifact(DEMO_PROMPT_PATH);
const promptHash = hashCanonicalPromptText(artifact.promptText);
const idempotencyKey = deriveOpenClawIdempotencyKey({
  phaseId: artifact.phaseId,
  jobType: "openclaw.build",
  promptHash,
});

if (promptHash !== artifact.promptHash) {
  console.error("Demo prompt artifact hash mismatch — update engine-data/openclaw/prompts/demo-phase-3-1-7.json");
  process.exit(1);
}

const correlationId = randomUUID();
const openclawId = `openclaw_demo_${randomUUID().slice(0, 8)}`;

const openclaw = {
  id: openclawId,
  jobType: "openclaw.build",
  phaseId: artifact.phaseId,
  title: "Demo OpenClaw Builder Job",
  objective: "Validate OpenClaw Builder Worker without modifying source files.",
  promptArtifactPath: DEMO_PROMPT_PATH,
  ownerApproval: {
    approvedBy: artifact.approvedBy,
    approvedAt: artifact.approvedAt,
    approvalSource: artifact.approvalSource,
    phaseDocStatus: "VALIDATION_DEMO",
    phaseId: artifact.phaseId,
    promptHash,
    promptExcerpt: "Phase 3.1.7 validation demo — safe command-only job",
  },
  agentRole: "builder",
  scope: {
    phaseId: artifact.phaseId,
    summary: "Read-only validation commands only",
    scopeFiles: ["scripts/openclaw/**", "scripts/opportunity-engine/**"],
    allowedOperations: ["validate"],
  },
  constraints: {
    architectureFreeze: true,
    noMissionControlChanges: true,
    noScoreCouncilChanges: true,
    noLiveConnectors: true,
    noScheduler: true,
    maxPhasesPerJob: 1,
  },
  requiredReading: [
    "docs/opportunity-os/29-openclaw-constitution.md",
    "docs/opportunity-os/30-openclaw-job-schema.md",
  ],
  allowedFiles: ["reports/openclaw/**"],
  forbiddenFiles: [
    "src/engine/mission-control/**",
    "src/engine/score-council/**",
    "src/mission-control/**",
    "runtime/**",
  ],
  requiredCommands: ["node --check scripts/openclaw/run-builder-job.js"],
  validationCommands: ["node scripts/opportunity-engine/validate-phase-3-1.js"],
  expectedOutputs: ["reports/openclaw/**"],
  commitPolicy: {
    enabled: false,
    maxCommits: 0,
    allowRuntimeCommits: false,
    allowForceAdd: false,
  },
  reportPolicy: {
    required: true,
    pathPattern: "reports/openclaw/openclaw-{phaseId}-{jobId}.md",
    gitignored: true,
  },
  stopConditions: ["validation_failure", "scope_failure", "owner_approval_missing", "prompt_hash_mismatch"],
  idempotencyKey,
  promptHash,
};

const job = await createJob({
  type: "openclaw.build",
  idempotencyKey,
  inputRefs: [openclawId],
  metadata: {
    correlationId,
    validationDemo: true,
    openclaw,
  },
});

console.log(
  JSON.stringify(
    { jobId: job.id, openclawId, correlationId, idempotencyKey, promptHash, promptArtifactPath: DEMO_PROMPT_PATH },
    null,
    2,
  ),
);
