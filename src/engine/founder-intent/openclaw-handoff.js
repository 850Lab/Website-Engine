import { randomUUID } from "node:crypto";
import {
  deriveOpenClawIdempotencyKey,
  hashCanonicalPromptText,
  validateOpenClawJob,
} from "../openclaw/index.js";

const DEFAULT_REQUIRED_READING = Object.freeze([
  "docs/opportunity-os/29-openclaw-constitution.md",
  "docs/opportunity-os/30-openclaw-job-schema.md",
  "docs/opportunity-os/34-engineering-director-execution-model.md",
]);

const DEFAULT_FORBIDDEN_FILES = Object.freeze([
  "runtime/**",
  "src/engine/mission-control/**",
  "src/engine/score-council/**",
  "src/mission-control/**",
  "src/engine/execution-queue/**",
  "src/engine/campaigns/**",
  "src/engine/outreach/**",
]);

const DEFAULT_STOP_CONDITIONS = Object.freeze([
  "owner_approval_missing",
  "validation_failure",
  "forbidden_file_touched",
  "unexpected_file_modification",
  "scope_exceeded",
]);

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).map((value) => String(value).trim()).filter(Boolean))];
}

function normalizeScopePattern(value) {
  const normalized = String(value || "").replace(/\\/g, "/").trim();
  if (!normalized) return "";
  if (normalized.includes("*")) return normalized;
  if (normalized.endsWith("/")) return `${normalized}**`;
  return normalized;
}

function normalizeScopePatterns(values) {
  return uniqueStrings(values).map(normalizeScopePattern).filter(Boolean);
}

function promptExcerpt(promptText) {
  return String(promptText || "").replace(/\s+/g, " ").trim().slice(0, 240);
}

export function buildOpenClawPromptFromEngineeringTask(task, options = {}) {
  const validationCommands = uniqueStrings(options.validationCommands || task.validationCommands);
  const expectedOutputs = uniqueStrings(options.expectedOutputs || task.expectedOutputs);
  return [
    `Engineering Task: ${task.title}`,
    `Task ID: ${task.taskId}`,
    `Phase: ${task.phase || "4.2"}`,
    "",
    "Objective:",
    task.problem || task.title,
    "",
    "Allowed Paths:",
    ...normalizeScopePatterns(task.scope?.allowedPaths).map((path) => `- ${path}`),
    "",
    "Forbidden Paths:",
    ...normalizeScopePatterns(task.scope?.forbiddenPaths).map((path) => `- ${path}`),
    "",
    "Acceptance Criteria:",
    ...uniqueStrings(task.acceptanceCriteria).map((criterion) => `- ${criterion}`),
    "",
    "Validation Commands:",
    ...validationCommands.map((command) => `- ${command}`),
    "",
    "Expected Outputs:",
    ...expectedOutputs.map((output) => `- ${output}`),
    "",
    "Stop Conditions:",
    ...uniqueStrings(options.stopConditions || task.stopConditions || DEFAULT_STOP_CONDITIONS).map((condition) => `- ${condition}`),
  ].join("\n");
}

export function createOpenClawHandoffPackage(task, options = {}) {
  if (!task || typeof task !== "object") {
    throw new Error("Engineering task is required");
  }
  if (task.status !== "approved") {
    throw new Error(`Engineering task must be approved before OpenClaw handoff: ${task.taskId || "(missing taskId)"}`);
  }
  if (task.openClawEligible !== true) {
    throw new Error(`Engineering task is not OpenClaw eligible: ${task.taskId || "(missing taskId)"}`);
  }

  const createdAt = options.createdAt || nowIso();
  const phaseId = String(options.phaseId || task.phase || "4.2").trim();
  const jobType = "openclaw.build";
  const agentRole = "builder";
  const validationCommands = uniqueStrings(options.validationCommands || task.validationCommands);
  if (!validationCommands.length) {
    throw new Error("OpenClaw handoff requires validationCommands");
  }

  const allowedFiles = normalizeScopePatterns(options.allowedFiles || task.scope?.allowedPaths);
  if (!allowedFiles.length) {
    throw new Error("OpenClaw handoff requires allowed files");
  }

  const forbiddenFiles = uniqueStrings([
    ...normalizeScopePatterns(task.scope?.forbiddenPaths),
    ...normalizeScopePatterns(options.forbiddenFiles),
    ...DEFAULT_FORBIDDEN_FILES,
  ]);
  const expectedOutputs = uniqueStrings(options.expectedOutputs || task.expectedOutputs);
  const promptText = options.promptText || buildOpenClawPromptFromEngineeringTask(task, {
    validationCommands,
    expectedOutputs,
    stopConditions: options.stopConditions,
  });
  const promptHash = hashCanonicalPromptText(promptText);
  const idempotencyKey = deriveOpenClawIdempotencyKey({ phaseId, jobType, promptHash });
  const correlationId = options.correlationId || `corr_${randomUUID()}`;
  const openclawJobId = options.openclawJobId || `openclaw_job_${randomUUID()}`;

  const openclawJob = {
    id: openclawJobId,
    jobType,
    phaseId,
    title: task.title,
    objective: task.problem || task.title,
    ownerApproval: {
      approvedBy: task.metadata?.approvedBy || options.approvedBy || "owner",
      approvedAt: task.metadata?.approvedAt || options.approvedAt || createdAt,
      approvalSource: options.approvalSource || "explicit_prompt",
      promptExcerpt: promptExcerpt(promptText),
      phaseDocStatus: options.phaseDocStatus || "ACTIVE",
      phaseId,
      promptHash,
    },
    agentRole,
    scope: {
      phaseId,
      summary: task.title,
      scopeFiles: allowedFiles,
      allowedOperations: uniqueStrings(options.allowedOperations || ["create", "update"]),
    },
    constraints: {
      architectureFreeze: true,
      noMissionControlChanges: true,
      noScoreCouncilChanges: true,
      noLiveConnectors: true,
      noScheduler: true,
      noOutreachChanges: true,
      noCampaignChanges: true,
      maxPhasesPerJob: 1,
      ...(options.constraints || {}),
    },
    requiredReading: uniqueStrings([...(options.requiredReading || []), ...DEFAULT_REQUIRED_READING]),
    allowedFiles,
    forbiddenFiles,
    requiredCommands: uniqueStrings(options.requiredCommands || []),
    validationCommands,
    expectedOutputs,
    commitPolicy: {
      maxCommits: 1,
      messageFormat: "Implement {phaseId} {title}",
      allowRuntimeCommits: false,
      allowForceAdd: false,
      allowEmpty: false,
      ...(options.commitPolicy || {}),
    },
    reportPolicy: {
      required: true,
      pathPattern: "reports/openclaw/openclaw-{phaseId}-{jobId}.md",
      gitignored: true,
      ...(options.reportPolicy || {}),
    },
    stopConditions: uniqueStrings(options.stopConditions || task.stopConditions || DEFAULT_STOP_CONDITIONS),
    idempotencyKey,
    promptHash,
    status: "pending",
    createdAt,
    updatedAt: createdAt,
    metadata: {
      schemaVersion: "3.1.8",
      sourceEngineeringTaskId: task.taskId,
      missionId: task.missionId || null,
      genericJobId: null,
      correlationId,
      workerVersion: null,
      handoffOnly: true,
    },
  };

  const genericJobDraft = {
    type: openclawJob.jobType,
    priority: options.priority ?? 10,
    inputRefs: [task.taskId],
    idempotencyKey,
    metadata: {
      correlationId,
      openclaw: openclawJob,
      handoffOnly: true,
    },
  };

  return {
    handoffPackageId: options.handoffPackageId || `openclaw_handoff_${randomUUID()}`,
    createdAt,
    taskId: task.taskId,
    dispatchAllowed: false,
    runAllowed: false,
    openclawJob,
    genericJobDraft,
    prompt: {
      promptText,
      promptHash,
    },
  };
}

export function validateOpenClawHandoffPackage(packageDraft) {
  const errors = [];
  if (!packageDraft || typeof packageDraft !== "object") {
    return { valid: false, errors: ["OpenClaw handoff package must be an object"] };
  }
  if (packageDraft.dispatchAllowed !== false) {
    errors.push("dispatchAllowed must be false");
  }
  if (packageDraft.runAllowed !== false) {
    errors.push("runAllowed must be false");
  }
  if (packageDraft.genericJobDraft?.metadata?.handoffOnly !== true) {
    errors.push("genericJobDraft must be marked handoffOnly");
  }
  if (packageDraft.genericJobDraft?.metadata?.openclaw !== packageDraft.openclawJob) {
    errors.push("genericJobDraft.metadata.openclaw must reference the generated OpenClaw job");
  }

  const openclawValidation = validateOpenClawJob(packageDraft.openclawJob);
  if (!openclawValidation.valid) {
    errors.push(...openclawValidation.errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
