import { verifyOpenClawIdempotency } from "./idempotency.js";
import { normalizePromptHash } from "./prompt.js";

const REQUIRED_FIELDS = [
  "jobType",
  "phaseId",
  "title",
  "objective",
  "ownerApproval",
  "agentRole",
  "scope",
  "constraints",
  "requiredReading",
  "allowedFiles",
  "forbiddenFiles",
  "requiredCommands",
  "validationCommands",
  "expectedOutputs",
  "commitPolicy",
  "reportPolicy",
  "stopConditions",
  "idempotencyKey",
  "promptHash",
];

const BLOCKED_JOB_TYPES = new Set([
  "openclaw.refactor",
  "openclaw.research",
  "openclaw.connector",
  "openclaw.execution",
]);

const BUILDER_ALLOWED_TYPES = new Set(["openclaw.build"]);

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function extractOpenClawJob(genericJob) {
  if (!genericJob || !isObject(genericJob.metadata?.openclaw)) {
    return null;
  }
  return genericJob.metadata.openclaw;
}

export function validateOpenClawJob(jobOrGeneric, options = {}) {
  const genericJob = jobOrGeneric?.metadata?.openclaw ? jobOrGeneric : null;
  const openclaw = genericJob ? genericJob.metadata.openclaw : jobOrGeneric;
  const errors = [];

  if (!openclaw || !isObject(openclaw)) {
    return { valid: false, errors: ["OpenClaw job missing from metadata.openclaw"], job: null };
  }

  for (const field of REQUIRED_FIELDS) {
    if (openclaw[field] == null || openclaw[field] === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (!isNonEmptyString(openclaw.jobType)) {
    errors.push("jobType must be a non-empty string");
  } else if (!BUILDER_ALLOWED_TYPES.has(openclaw.jobType)) {
    if (BLOCKED_JOB_TYPES.has(openclaw.jobType)) {
      errors.push(`Blocked job type: ${openclaw.jobType}`);
    } else {
      errors.push(`Unsupported builder job type: ${openclaw.jobType}`);
    }
  }

  if (openclaw.agentRole !== "builder") {
    errors.push(`agentRole must be builder, got ${openclaw.agentRole}`);
  }

  if (!isNonEmptyString(openclaw.phaseId)) {
    errors.push("phaseId must be a non-empty string");
  }

  if (!normalizePromptHash(openclaw.promptHash)) {
    errors.push("promptHash must be a non-empty string");
  }

  if (asArray(openclaw.validationCommands).length === 0) {
    errors.push("validationCommands must not be empty");
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
    if (approval.approvalSource === "explicit_prompt" && !isNonEmptyString(approval.promptExcerpt)) {
      errors.push("ownerApproval.promptExcerpt required for explicit_prompt");
    }
  }

  if (!isObject(openclaw.scope)) {
    errors.push("scope must be an object");
  }

  if (!isObject(openclaw.commitPolicy)) {
    errors.push("commitPolicy must be an object");
  }

  if (!isObject(openclaw.reportPolicy)) {
    errors.push("reportPolicy must be an object");
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

export { BLOCKED_JOB_TYPES, BUILDER_ALLOWED_TYPES, REQUIRED_FIELDS };
