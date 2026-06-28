#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { createJob } from "../../src/engine/jobs/index.js";
import {
  deriveOpenClawIdempotencyKey,
  hashCanonicalPromptText,
  loadPromptArtifact,
} from "../../src/engine/openclaw/index.js";

const DEMO_PROMPT_PATH = "engine-data/openclaw/prompts/demo-phase-3-1-8.json";

const { artifact } = await loadPromptArtifact(DEMO_PROMPT_PATH);
const promptHash = hashCanonicalPromptText(artifact.promptText);
const idempotencyKey = deriveOpenClawIdempotencyKey({
  phaseId: artifact.phaseId,
  jobType: "openclaw.qa",
  promptHash,
});

if (promptHash !== artifact.promptHash) {
  console.error("Demo QA prompt artifact hash mismatch — update engine-data/openclaw/prompts/demo-phase-3-1-8.json");
  process.exit(1);
}

const correlationId = randomUUID();
const openclawId = `openclaw_qa_demo_${randomUUID().slice(0, 8)}`;

const openclaw = {
  id: openclawId,
  jobType: "openclaw.qa",
  phaseId: artifact.phaseId,
  title: "Demo OpenClaw QA Job",
  objective: "Validate OpenClaw QA Worker read-only behavior without modifying source.",
  promptArtifactPath: DEMO_PROMPT_PATH,
  ownerApproval: {
    approvedBy: artifact.approvedBy,
    approvedAt: artifact.approvedAt,
    approvalSource: artifact.approvalSource,
    phaseDocStatus: "VALIDATION_DEMO",
    phaseId: artifact.phaseId,
    promptHash,
    promptExcerpt: "Phase 3.1.8 validation demo — read-only QA job",
  },
  agentRole: "qa",
  requiredReading: [
    "docs/opportunity-os/29-openclaw-constitution.md",
    "docs/opportunity-os/30-openclaw-job-schema.md",
  ],
  validationCommands: [
    "node --check scripts/openclaw/run-qa-job.js",
    "node scripts/opportunity-engine/validate-phase-3-1-7-5.js",
  ],
  expectedOutputs: [{ type: "commandExitCodeZero" }, { type: "reportWritten" }, { type: "eventsEmitted" }],
  commitPolicy: {
    enabled: false,
    maxCommits: 0,
    allowRuntimeCommits: false,
  },
  reportPolicy: {
    required: true,
    pathPattern: "reports/openclaw/openclaw-qa-{phaseId}-{jobId}.md",
    gitignored: true,
  },
  stopConditions: ["validation_failure", "expected_outputs_failed", "source_change_forbidden"],
  idempotencyKey,
  promptHash,
};

const job = await createJob({
  type: "openclaw.qa",
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
