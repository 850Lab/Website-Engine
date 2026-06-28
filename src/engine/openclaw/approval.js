import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getRepoRoot } from "../runtime/index.js";

const PHASE_DOC = join(getRepoRoot(), "docs/opportunity-os/08-current-phase.md");

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidationDemoJob(openclawJob) {
  return (
    openclawJob.metadata?.validationDemo === true ||
    openclawJob.ownerApproval?.phaseDocStatus === "VALIDATION_DEMO"
  );
}

export async function verifyOwnerApproval(openclawJob, options = {}) {
  if (!openclawJob?.ownerApproval) {
    return { ok: false, reason: "owner_approval_missing", detail: "ownerApproval object missing" };
  }

  const { approvedBy, approvedAt, approvalSource, phaseDocStatus, promptExcerpt } = openclawJob.ownerApproval;

  if (!approvedBy || !approvedAt || !approvalSource || !phaseDocStatus) {
    return { ok: false, reason: "owner_approval_incomplete", detail: "Required ownerApproval fields missing" };
  }

  if (approvalSource === "explicit_prompt" && !promptExcerpt?.trim()) {
    return { ok: false, reason: "owner_approval_incomplete", detail: "promptExcerpt required" };
  }

  if (!openclawJob.phaseId?.trim()) {
    return { ok: false, reason: "phase_id_missing", detail: "Job phaseId missing" };
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

  if (blockedHeading.test(phaseContent) && !isValidationDemoJob(openclawJob)) {
    return { ok: false, reason: "phase_blocked", detail: `Phase ${phaseId} is blocked in 08-current-phase.md` };
  }

  if (blockedSection.test(phaseContent) && phaseDocStatus === "ACTIVE" && !isValidationDemoJob(openclawJob)) {
    return { ok: false, reason: "phase_blocked", detail: `Phase ${phaseId} blocked section found` };
  }

  const phaseMentioned = new RegExp(`Phase\\s+${escapeRegex(phaseId)}`, "i").test(phaseContent);
  if (!phaseMentioned && !isValidationDemoJob(openclawJob)) {
    return {
      ok: false,
      reason: "phase_not_authorized",
      detail: `Phase ${phaseId} not referenced in 08-current-phase.md`,
    };
  }

  if (isValidationDemoJob(openclawJob) && approvedBy !== "owner") {
    return { ok: false, reason: "owner_approval_invalid", detail: "validationDemo requires approvedBy owner" };
  }

  return {
    ok: true,
    reason: "approved",
    detail: isValidationDemoJob(openclawJob) ? "validation_demo_approved" : "owner_approval_verified",
  };
}

export function getPhaseDocPath() {
  return PHASE_DOC;
}
