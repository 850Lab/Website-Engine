import { verifyOpenClawIdempotency } from "./idempotency.js";
import { normalizePromptHash } from "./prompt.js";
import { validateQaCommandAllowlist } from "./command-allowlist.js";

const QA_REQUIRED_FIELDS = [
  "jobType",
  "phaseId",
  "title",
  "objective",
  "ownerApproval",
  "agentRole",
  "requiredReading",
  "validationCommands",
  "expectedOutputs",
  "reportPolicy",
  "stopConditions",
  "idempotencyKey",
  "promptHash",
];

const QA_JOB_TYPE = "openclaw.qa";
const QA_AGENT_ROLE = "qa";

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateQaJob(jobOrGeneric, options = {}) {
  const genericJob = jobOrGeneric?.metadata?.openclaw ? jobOrGeneric : null;
  const openclaw = genericJob ? genericJob.metadata.openclaw : jobOrGeneric;
  const errors = [];

  if (!openclaw || !isObject(openclaw)) {
    return { valid: false, errors: ["OpenClaw QA job missing from metadata.openclaw"], job: null };
  }

  if (openclaw.jobType === "openclaw.build") {
    errors.push("QA worker rejects openclaw.build jobType");
  }

  if (openclaw.jobType !== QA_JOB_TYPE) {
    errors.push(`jobType must be ${QA_JOB_TYPE}, got ${openclaw.jobType}`);
  }

  if (openclaw.agentRole !== QA_AGENT_ROLE) {
    errors.push(`agentRole must be ${QA_AGENT_ROLE}, got ${openclaw.agentRole}`);
  }

  for (const field of QA_REQUIRED_FIELDS) {
    if (openclaw[field] == null || openclaw[field] === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (!normalizePromptHash(openclaw.promptHash)) {
    errors.push("promptHash must be a non-empty string");
  }

  if (asArray(openclaw.validationCommands).length === 0) {
    errors.push("validationCommands must not be empty");
  }

  if (asArray(openclaw.expectedOutputs).length === 0) {
    errors.push("expectedOutputs must not be empty");
  }

  const approval = openclaw.ownerApproval;
  if (!isObject(approval)) {
    errors.push("ownerApproval must be an object");
  } else {
    for (const field of ["approvedBy", "approvedAt", "approvalSource", "phaseDocStatus", "phaseId", "promptHash"]) {
      if (!isNonEmptyString(approval[field]) && field !== "promptHash") {
        errors.push(`ownerApproval.${field} is required`);
      } else if (field === "promptHash" && !normalizePromptHash(approval[field])) {
        errors.push("ownerApproval.promptHash is required");
      }
    }
  }

  if (!isObject(openclaw.reportPolicy)) {
    errors.push("reportPolicy must be an object");
  }

  const commitPolicy = openclaw.commitPolicy || {};
  if (commitPolicy.enabled === true || Number(commitPolicy.maxCommits) > 0) {
    errors.push("QA jobs must not enable commits (commitPolicy.enabled must be false)");
  }

  const requiredCommands = asArray(openclaw.requiredCommands);
  if (requiredCommands.length > 0) {
    errors.push("QA jobs must not define requiredCommands for implementation work");
  }

  const allCommands = [...requiredCommands, ...asArray(openclaw.validationCommands)];
  for (const command of allCommands) {
    const trimmed = String(command || "").trim();
    if (/git add|git commit|git checkout|git reset/i.test(trimmed)) {
      errors.push(`Forbidden QA command: ${trimmed}`);
      continue;
    }
    const allow = validateQaCommandAllowlist(trimmed);
    if (!allow.allowed) {
      errors.push(`QA command not allowlisted: ${trimmed} (${allow.detail})`);
    }
  }

  if (errors.length === 0 && options.verifyIdempotency !== false) {
    const idempotency = verifyOpenClawIdempotency(openclaw, genericJob);
    if (!idempotency.ok) {
      errors.push(idempotency.detail);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    job: openclaw,
  };
}

export { QA_REQUIRED_FIELDS, QA_JOB_TYPE, QA_AGENT_ROLE };
