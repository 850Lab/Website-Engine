import { contactMethodLabel } from "./contact-method.js";
import { createOpportunityProjectFromQualifiedBusiness } from "../v7/index.js";
import { getOpportunityProject } from "../v7/opportunity-project-store.js";
import { recordFunnelEvent } from "../v7/funnel-events.js";
import {
  buildBusinessRecord,
  getQualifiedBusiness,
  isPreviewVerified,
  isReadyForOutreach,
  listQualifiedBusinesses,
  upsertQualifiedBusiness,
} from "./qualified-business-store.js";

export async function verifyPreview(project, req) {
  if (!project?.id) {
    return {
      ok: false,
      statusCode: null,
      reason: "missing_project",
      verifiedAt: new Date().toISOString(),
    };
  }

  const base = `${req.protocol}://${req.get("host")}`;
  const url = `${base}/p/${encodeURIComponent(project.id)}`;
  let statusCode = null;
  let ok = false;
  let reason = "fetch_failed";
  try {
    const response = await fetch(url, { redirect: "follow" });
    statusCode = response.status;
    ok = response.ok;
    reason = ok ? "ok" : `http_${response.status}`;
  } catch (err) {
    reason = err.message;
  }

  if (ok) {
    await recordFunnelEvent({
      projectId: project.id,
      event: "preview_viewed",
      sessionId: "system_preview_verifier",
      meta: { source: "founder_preview_bridge_verification", verified: true },
    }).catch(() => {});
  }

  return {
    ok,
    statusCode,
    reason,
    verifiedAt: new Date().toISOString(),
  };
}

export function buildProjectPatch(record, project, links, verification, generationDurationMs) {
  const previewGenerated = Boolean(verification?.ok);
  const readyForOutreach = Boolean(project?.id) && previewGenerated;
  return buildBusinessRecord({
    ...record,
    opportunityProjectId: project?.id ?? "",
    previewGenerated,
    previewUrl: links?.previewUrl ?? "",
    launchUrl: links?.launchUrl ?? "",
    dashboardUrl: links?.dashboardUrl ?? "",
    projectCreatedAt: project?.createdAt ?? new Date().toISOString(),
    projectStatus: project ? "Project Created" : "Project Failed",
    previewStatus: previewGenerated
      ? "Preview Generated"
      : project
        ? "Preview Failed"
        : "No Project",
    previewVerification: verification ?? null,
    projectGenerationDurationMs: generationDurationMs ?? null,
    readyForOutreach,
    readyForOutreachAt: readyForOutreach ? (record.readyForOutreachAt ?? new Date().toISOString()) : null,
  });
}

export async function createProjectForBusiness(record, req) {
  const existingProjectId = record.opportunityProjectId;
  if (existingProjectId) {
    const project = await getOpportunityProject(existingProjectId);
    if (project) {
      const previewUrl = `${req.protocol}://${req.get("host")}/p/${project.id}`;
      const launchUrl = `${req.protocol}://${req.get("host")}/launch/${project.id}`;
      const dashboardUrl = `${req.protocol}://${req.get("host")}/dashboard/${project.id}`;
      const verification = await verifyPreview(project, req);
      const patched = buildProjectPatch(
        record,
        project,
        { previewUrl, launchUrl, dashboardUrl },
        verification,
        record.projectGenerationDurationMs,
      );
      await upsertQualifiedBusiness(patched);
      return {
        status: "already_exists",
        businessId: record.id,
        businessName: record.businessName,
        projectId: project.id,
        previewUrl,
        launchUrl,
        dashboardUrl,
        verification,
        generationDurationMs: record.projectGenerationDurationMs ?? null,
      };
    }
  }

  const created = await createOpportunityProjectFromQualifiedBusiness(record, {
    req,
    source: "qualified_business_database",
  });
  const verification = await verifyPreview(created.project, req);
  const patched = buildProjectPatch(
    record,
    created.project,
    created.links,
    verification,
    created.generationDurationMs,
  );
  await upsertQualifiedBusiness(patched);

  return {
    status: "created",
    businessId: record.id,
    businessName: record.businessName,
    projectId: created.project.id,
    previewUrl: created.links.previewUrl,
    launchUrl: created.links.launchUrl,
    dashboardUrl: created.links.dashboardUrl,
    verification,
    generationDurationMs: created.generationDurationMs,
  };
}

export function selectQualifiedBusinesses(records, mode, selectedBusinessIds = []) {
  const qualified = records.filter((row) => row.qualificationStatus === "qualified");
  if (mode === "selected") {
    const set = new Set(selectedBusinessIds);
    return qualified.filter((row) => set.has(row.id));
  }
  const sizes = {
    top_10: 10,
    top_25: 25,
    top_50: 50,
    top_100: 100,
  };
  const size = sizes[mode] ?? 25;
  return qualified.slice(0, size);
}

export function founderQueueView(record) {
  const previewVerified = isPreviewVerified(record);
  const readyForOutreach = isReadyForOutreach(record);
  return {
    id: record.id,
    businessName: record.businessName,
    city: record.city,
    industry: record.industry,
    qualificationReason: record.qualificationReason || "",
    phone: record.phone || "",
    email: record.email || "",
    contactMethodLabel: contactMethodLabel(record.contactMethodCategory),
    opportunityProjectId: record.opportunityProjectId || null,
    previewUrl: record.previewUrl || null,
    launchUrl: record.launchUrl || null,
    dashboardUrl: record.dashboardUrl || null,
    projectStatus: record.projectStatus || "No Project",
    previewStatus: record.previewStatus || "No Project",
    previewGenerated: Boolean(record.previewGenerated),
    previewVerified,
    readyForOutreach,
    projectCreatedAt: record.projectCreatedAt || null,
  };
}

export async function generateProjectsForRecords(records, req) {
  const startedAt = Date.now();
  const outcomes = [];
  let created = 0;
  let existing = 0;
  let failed = 0;
  let verified = 0;
  const durations = [];

  for (const record of records) {
    try {
      const fresh = (await getQualifiedBusiness(record.id)) ?? record;
      const outcome = await createProjectForBusiness(fresh, req);
      outcomes.push(outcome);
      if (outcome.status === "created") created += 1;
      if (outcome.status === "already_exists") existing += 1;
      if (outcome.verification?.ok) verified += 1;
      if (Number(outcome.generationDurationMs) > 0) durations.push(Number(outcome.generationDurationMs));
    } catch (err) {
      failed += 1;
      outcomes.push({
        status: "failed",
        businessId: record.id,
        businessName: record.businessName,
        error: err.message,
      });
    }
  }

  const successful = created + existing;
  const averageGenerationTimeMs = durations.length
    ? Math.round(durations.reduce((sum, ms) => sum + ms, 0) / durations.length)
    : null;

  return {
    requested: records.length,
    successful,
    created,
    existing,
    failed,
    verifiedPreviews: verified,
    averageGenerationTimeMs,
    elapsedMs: Date.now() - startedAt,
    outcomes,
  };
}

export { listQualifiedBusinesses };
