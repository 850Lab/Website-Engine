import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getRepoRoot } from "../runtime/index.js";

export function hashCanonicalPromptText(promptText) {
  const normalized = String(promptText || "").replace(/\r\n/g, "\n").trim();
  const hex = createHash("sha256").update(normalized, "utf8").digest("hex");
  return `sha256:${hex}`;
}

export function normalizePromptHash(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("sha256:") ? trimmed : `sha256:${trimmed}`;
}

export function buildDefaultPromptArtifactPath(phaseId, options = {}) {
  if (options.validationDemo && options.jobType === "openclaw.qa") {
    return "engine-data/openclaw/prompts/demo-phase-3-1-8.json";
  }
  if (options.validationDemo) {
    return "engine-data/openclaw/prompts/demo-phase-3-1-7.json";
  }
  const slug = String(phaseId || "").replace(/\./g, "-");
  return `engine-data/openclaw/prompts/phase-${slug}.json`;
}

export async function loadPromptArtifact(pathOrOptions = {}) {
  const relativePath =
    typeof pathOrOptions === "string"
      ? pathOrOptions
      : pathOrOptions.path || pathOrOptions.promptArtifactPath;

  if (!relativePath) {
    throw new Error("promptArtifactPath required");
  }

  const absolutePath = join(getRepoRoot(), relativePath);
  const content = await readFile(absolutePath, "utf8");
  const artifact = JSON.parse(content);
  return { artifact, path: relativePath };
}

export function verifyPromptArtifactIntegrity(artifact) {
  if (!artifact?.promptText?.trim()) {
    return { ok: false, reason: "prompt_artifact_invalid", detail: "promptText missing from artifact" };
  }

  const computed = hashCanonicalPromptText(artifact.promptText);
  const declared = normalizePromptHash(artifact.promptHash);

  if (computed !== declared) {
    return {
      ok: false,
      reason: "prompt_artifact_invalid",
      detail: "Prompt artifact promptHash does not match promptText",
    };
  }

  return { ok: true, promptHash: computed, artifact };
}

export function verifyJobPromptHash(openclawJob, artifact, options = {}) {
  const jobHash = normalizePromptHash(openclawJob?.promptHash);
  if (!jobHash) {
    return { ok: false, reason: "prompt_hash_missing", detail: "Job promptHash missing" };
  }

  const artifactCheck = verifyPromptArtifactIntegrity(artifact);
  if (!artifactCheck.ok) {
    return artifactCheck;
  }

  const artifactHash = artifactCheck.promptHash;
  if (jobHash !== artifactHash) {
    return {
      ok: false,
      reason: "prompt_hash_mismatch",
      detail: `Job promptHash ${jobHash} does not match artifact ${artifactHash}`,
    };
  }

  const approvalHash = normalizePromptHash(openclawJob.ownerApproval?.promptHash);
  if (approvalHash && approvalHash !== jobHash) {
    return {
      ok: false,
      reason: "prompt_hash_mismatch",
      detail: "ownerApproval.promptHash does not match job promptHash",
    };
  }

  if (artifact.phaseId && openclawJob.phaseId && artifact.phaseId !== openclawJob.phaseId) {
    return {
      ok: false,
      reason: "prompt_hash_mismatch",
      detail: "Prompt artifact phaseId does not match job phaseId",
    };
  }

  return {
    ok: true,
    reason: "prompt_hash_verified",
    detail: options.validationDemo ? "validation_demo_prompt_verified" : "prompt_hash_verified",
    promptHash: jobHash,
    artifactPath: options.artifactPath || null,
  };
}

export async function resolveAndVerifyPromptHash(openclawJob, options = {}) {
  if (options.promptArtifact) {
    return verifyJobPromptHash(openclawJob, options.promptArtifact, {
      ...options,
      artifactPath: options.promptArtifactPath || "inline",
    });
  }

  const relativePath =
    openclawJob.promptArtifactPath ||
    options.promptArtifactPath ||
    buildDefaultPromptArtifactPath(openclawJob.phaseId, {
      validationDemo: options.allowValidationDemo && isValidationDemoJob(openclawJob),
      jobType: openclawJob.jobType,
    });

  try {
    const { artifact, path } = await loadPromptArtifact(relativePath);
    const result = verifyJobPromptHash(openclawJob, artifact, {
      ...options,
      artifactPath: path,
    });
    return { ...result, artifact, artifactPath: path };
  } catch (error) {
    return {
      ok: false,
      reason: "prompt_artifact_missing",
      detail: `Unable to load prompt artifact at ${relativePath}: ${error.message}`,
    };
  }
}

function isValidationDemoJob(openclawJob) {
  return openclawJob?.ownerApproval?.phaseDocStatus === "VALIDATION_DEMO";
}
