import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getRepoRoot } from "../runtime/index.js";
import { normalizePromptHash } from "./prompt.js";

const PHASE_DOC = join(getRepoRoot(), "docs/opportunity-os/08-current-phase.md");

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isValidationDemoJob(openclawJob) {
  return openclawJob?.ownerApproval?.phaseDocStatus === "VALIDATION_DEMO";
}

export function isValidationDemoAllowed(options = {}) {
  return options.allowValidationDemo === true || process.env.OPENCLAW_ALLOW_VALIDATION_DEMO === "1";
}

export async function verifyOwnerApproval(openclawJob, options = {}) {
  if (!openclawJob?.ownerApproval) {
    return { ok: false, reason: "owner_approval_missing", detail: "ownerApproval object missing" };
  }

  const approval = openclawJob.ownerApproval;
  const { approvedBy, approvedAt, approvalSource, phaseDocStatus, promptExcerpt } = approval;

  if (!approvedBy || !approvedAt || !approvalSource || !phaseDocStatus) {
    return { ok: false, reason: "owner_approval_incomplete", detail: "Required ownerApproval fields missing" };
  }

  if (!approval.phaseId?.trim()) {
    return { ok: false, reason: "owner_approval_incomplete", detail: "ownerApproval.phaseId is required" };
  }

  if (!normalizePromptHash(approval.promptHash)) {
    return { ok: false, reason: "owner_approval_incomplete", detail: "ownerApproval.promptHash is required" };
  }

  if (approvalSource === "explicit_prompt" && !promptExcerpt?.trim()) {
    return { ok: false, reason: "owner_approval_incomplete", detail: "promptExcerpt required" };
  }

  if (!openclawJob.phaseId?.trim()) {
    return { ok: false, reason: "phase_id_missing", detail: "Job phaseId missing" };
  }

  if (approval.phaseId.trim() !== openclawJob.phaseId.trim()) {
    return {
      ok: false,
      reason: "owner_approval_invalid",
      detail: `ownerApproval.phaseId ${approval.phaseId} does not match job phaseId ${openclawJob.phaseId}`,
    };
  }

  const jobHash = normalizePromptHash(openclawJob.promptHash);
  const approvalHash = normalizePromptHash(approval.promptHash);
  if (jobHash !== approvalHash) {
    return {
      ok: false,
      reason: "owner_approval_invalid",
      detail: "ownerApproval.promptHash does not match job promptHash",
    };
  }

  const demoJob = isValidationDemoJob(openclawJob);
  if (demoJob && !isValidationDemoAllowed(options)) {
    return {
      ok: false,
      reason: "validation_demo_forbidden",
      detail: "VALIDATION_DEMO requires OPENCLAW_ALLOW_VALIDATION_DEMO=1 or allowValidationDemo option",
    };
  }

  let phaseContent = options.phaseDocContent;
  if (phaseContent == null) {
    phaseContent = await readFile(PHASE_DOC, "utf8");
  }

  const phaseId = openclawJob.phaseId.trim();
  const blockedHeading = new RegExp(`##\\s+Phase\\s+${escapeRegex(phaseId)}[^\\n]*\\(Blocked\\)`, "i");
  const blockedSection = new RegExp(
    `##\\s+Phase\\s+${escapeRegex(phaseId)}\\s*\\(Blocked\\)[\\s\\S]*?(?=\\n##\\s|$)`,
    "i",
  );

  if (blockedHeading.test(phaseContent) && !demoJob) {
    return { ok: false, reason: "phase_blocked", detail: `Phase ${phaseId} is blocked in 08-current-phase.md` };
  }

  if (blockedSection.test(phaseContent) && phaseDocStatus === "ACTIVE" && !demoJob) {
    return { ok: false, reason: "phase_blocked", detail: `Phase ${phaseId} blocked section found` };
  }

  const phaseMentioned = new RegExp(`Phase\\s+${escapeRegex(phaseId)}`, "i").test(phaseContent);
  if (!phaseMentioned && !demoJob) {
    return {
      ok: false,
      reason: "phase_not_authorized",
      detail: `Phase ${phaseId} not referenced in 08-current-phase.md`,
    };
  }

  if (demoJob && approvedBy !== "owner") {
    return { ok: false, reason: "owner_approval_invalid", detail: "validationDemo requires approvedBy owner" };
  }

  return {
    ok: true,
    reason: "approved",
    detail: demoJob ? "validation_demo_approved" : "owner_approval_verified",
    summary: {
      approvedBy,
      approvedAt,
      approvalSource,
      phaseId: approval.phaseId,
      promptHash: approvalHash,
      phaseDocStatus,
    },
  };
}

export function getPhaseDocPath() {
  return PHASE_DOC;
}
