import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { findPreviewV3ForLead } from "./render-preview-v3.js";
import { getManifestPath } from "./assets/asset-pipeline.js";
import { listLeadRuns } from "./lead-runs.js";

const ROOT = join(process.cwd());
const PREVIEWS_ROOT = join(ROOT, "previews-v3");
const RENDERS_ROOT = join(ROOT, "renders");

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function slugifyBusinessName(name) {
  return String(name ?? "")
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "business";
}

function expectedDirName(lead) {
  return `${slugifyBusinessName(lead.businessName)}-${String(lead.id ?? "").slice(0, 8)}`;
}

function warning({ id, type, severity = "warning", lead = null, message, recommendation, action = null }) {
  return {
    id,
    type,
    severity,
    leadId: lead?.id ?? null,
    businessName: lead?.businessName ?? null,
    message,
    recommendation,
    action,
  };
}

async function scanLeadArtifacts(lead) {
  const warnings = [];
  const preview = await findPreviewV3ForLead(lead);
  const dirName = preview?.dirName ?? expectedDirName(lead);
  const previewDir = preview?.dir ?? join(PREVIEWS_ROOT, dirName);
  const renderDir = join(RENDERS_ROOT, dirName);
  const indexPath = join(previewDir, "index.html");
  const manifestPath = getManifestPath(previewDir);
  const desktopPath = join(renderDir, "desktop.png");
  const mobilePath = join(renderDir, "mobile.png");
  const previewExists = await pathExists(indexPath);
  const manifestExists = await pathExists(manifestPath);
  const desktopExists = await pathExists(desktopPath);
  const mobileExists = await pathExists(mobilePath);

  if (["generated", "assets_ready", "rendered", "approved"].includes(lead.previewStatus) && !previewExists) {
    warnings.push(warning({
      id: `missing-preview-${lead.id}`,
      type: "missing_preview_folder",
      severity: "critical",
      lead,
      message: "Lead preview status expects a preview, but index.html is missing.",
      recommendation: "Regenerate the preview from the recovery queue or lead detail page.",
      action: "generate_preview",
    }));
  }

  if (["assets_ready", "rendered", "approved"].includes(lead.previewStatus) && !manifestExists) {
    warnings.push(warning({
      id: `missing-assets-${lead.id}`,
      type: "missing_asset_manifest",
      severity: "warning",
      lead,
      message: "Lead is marked assets-ready, but the asset manifest is missing.",
      recommendation: "Prepare assets again. Missing individual image files will fall back safely.",
      action: "prepare_assets",
    }));
  }

  if (manifestExists) {
    const manifest = await readJson(manifestPath, {});
    const imageValues = Object.values(manifest ?? {}).filter((value) => typeof value === "string" && value.match(/\.(png|jpg|jpeg|webp)$/i));
    for (const value of imageValues) {
      const assetPath = value.startsWith("/") ? join(ROOT, value.replace(/^\/+/, "")) : join(previewDir, value);
      if (!(await pathExists(assetPath))) {
        warnings.push(warning({
          id: `missing-asset-file-${lead.id}-${warnings.length}`,
          type: "missing_asset_file",
          severity: "warning",
          lead,
          message: `Asset manifest references a missing image: ${value}`,
          recommendation: "Prepare assets again or regenerate the preview to refresh references.",
          action: "prepare_assets",
        }));
      }
    }
  }

  if (["rendered", "approved"].includes(lead.previewStatus) && (!desktopExists || !mobileExists)) {
    warnings.push(warning({
      id: `missing-render-${lead.id}`,
      type: "missing_screenshot_file",
      severity: "warning",
      lead,
      message: "Lead is marked rendered/approved, but one or more screenshot files are missing.",
      recommendation: "Render screenshots again.",
      action: "render_preview",
    }));
  }

  if (lead.previewStatus === "generated" && previewExists && lead.updatedAt) {
    const hours = (Date.now() - new Date(lead.updatedAt).getTime()) / 3600000;
    if (hours >= 24) {
      warnings.push(warning({
        id: `stale-generated-${lead.id}`,
        type: "stale_temporary_state",
        severity: "info",
        lead,
        message: "Preview has been generated for more than 24 hours without assets or renders.",
        recommendation: "Prepare assets and render screenshots to finish the preview workflow.",
        action: "prepare_assets",
      }));
    }
  }

  return warnings;
}

async function scanRunReferences(leads) {
  const warnings = [];
  const leadIds = new Set(leads.map((lead) => lead.id));
  const runs = await listLeadRuns({ limit: 500 });
  for (const run of runs) {
    const missingIds = (run.qualifiedLeadIds ?? []).filter((id) => !leadIds.has(id));
    if (missingIds.length) {
      warnings.push(warning({
        id: `corrupted-run-${run.id}`,
        type: "corrupted_run_references",
        severity: "critical",
        message: `Target Lead Group "${run.title}" references ${missingIds.length} missing lead(s).`,
        recommendation: "Review this group and remove stale references if they are not recoverable.",
        action: "review_group",
      }));
    }
    const hasUnworked = (run.qualifiedLeads ?? []).some(
      (lead) => lead.previewStatus === "approved" && lead.replyStatus === "not_contacted"
    );
    if (!run.archived && hasUnworked) {
      const ageDays = Math.floor((Date.now() - new Date(run.createdAt).getTime()) / 86400000);
      if (ageDays >= 14) {
        warnings.push(warning({
          id: `inactive-group-${run.id}`,
          type: "inactive_target_group",
          severity: "info",
          message: `Target Lead Group "${run.title}" is ${ageDays} days old and still has unworked leads.`,
          recommendation: "Open the group or Outreach queue and recycle dormant opportunities.",
          action: "review_group",
        }));
      }
    }
  }
  return warnings;
}

async function countFolders(path) {
  try {
    return (await readdir(path, { withFileTypes: true })).filter((entry) => entry.isDirectory()).length;
  } catch {
    return 0;
  }
}

export async function buildRecoveryReport(leads) {
  const leadWarnings = (await Promise.all(leads.map(scanLeadArtifacts))).flat();
  const runWarnings = await scanRunReferences(leads);
  const warnings = [...leadWarnings, ...runWarnings];
  return {
    generatedAt: new Date().toISOString(),
    warningCount: warnings.length,
    criticalCount: warnings.filter((item) => item.severity === "critical").length,
    failedJobs: warnings.filter((item) => item.action && item.severity !== "info").length,
    recommendations: warnings.slice(0, 8),
    queue: warnings,
    artifactCounts: {
      previewFolders: await countFolders(PREVIEWS_ROOT),
      renderFolders: await countFolders(RENDERS_ROOT),
    },
  };
}
