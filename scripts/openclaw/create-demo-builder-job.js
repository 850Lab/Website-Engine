#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { createJob } from "../../src/engine/jobs/index.js";

const correlationId = randomUUID();
const idempotencyKey = `openclaw.build.demo.${createHash("sha256").update(correlationId).digest("hex").slice(0, 16)}`;
const openclawId = `openclaw_demo_${randomUUID().slice(0, 8)}`;

const openclaw = {
  id: openclawId,
  jobType: "openclaw.build",
  phaseId: "3.1.7",
  title: "Demo OpenClaw Builder Job",
  objective: "Validate OpenClaw Builder Worker without modifying source files.",
  ownerApproval: {
    approvedBy: "owner",
    approvedAt: new Date().toISOString(),
    approvalSource: "validation",
    phaseDocStatus: "VALIDATION_DEMO",
    promptExcerpt: "Phase 3.1.7 validation demo — safe command-only job",
  },
  agentRole: "builder",
  scope: {
    phaseId: "3.1.7",
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
  stopConditions: ["validation_failure", "scope_failure", "owner_approval_missing"],
  idempotencyKey,
  promptHash: createHash("sha256").update("phase-3-1-7-demo-builder").digest("hex"),
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

console.log(JSON.stringify({ jobId: job.id, openclawId, correlationId, idempotencyKey }, null, 2));
