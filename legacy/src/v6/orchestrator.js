import { normalizeV6Intake, buildWorkingLead } from "./intake.js";
import { buildResearchReport } from "./research-engine.js";
import { buildCompetitorAnalysis } from "./competitor-engine.js";
import { buildRevenueLeakAudit } from "./audit-engine.js";
import { buildWebsiteRedesign } from "./website-engine.js";
import { buildAnnotationAssets } from "./annotation-engine.js";
import { buildLoomScripts } from "./loom-script-engine.js";
import { buildOutreachAssets } from "./outreach-engine.js";
import {
  buildDownloadBundle,
  getV6Package,
  saveV6Package,
  writeV6Artifacts,
} from "./store.js";
import { newPackageId, nowIso } from "./shared.js";

function buildSalesPackageRecord({
  packageId,
  intake,
  researchReport,
  competitorAnalysis,
  revenueLeakAudit,
  websiteRedesign,
  annotationAssets,
  loomScripts,
  outreachAssets,
}) {
  return {
    version: 1,
    generatedAt: nowIso(),
    packageId,
    businessName: intake.businessName,
    deliverableIndex: [
      { key: "researchReport", title: "Business Research Report", file: "research-report.json" },
      { key: "competitorAnalysis", title: "Competitor Analysis", file: "competitor-analysis.json" },
      { key: "revenueLeakAudit", title: "Revenue Leak Audit", file: "revenue-leak-audit.json" },
      { key: "websiteRedesign", title: "Website Redesign", file: "website-redesign.json" },
      {
        key: "annotationAssets.auditWalkthrough",
        title: "Annotated Audit Walkthrough Assets",
        file: "annotation-assets.json",
      },
      {
        key: "annotationAssets.websiteWalkthrough",
        title: "Annotated Website Walkthrough Assets",
        file: "annotation-assets.json",
      },
      { key: "loomScripts", title: "Loom Narration Script", file: "loom-scripts.json" },
      { key: "outreachAssets", title: "Email & SMS Outreach", file: "outreach-assets.json" },
    ],
    summary: {
      headline: `${intake.businessName} sales package`,
      severityScore: revenueLeakAudit.severityScore,
      previewUrl: websiteRedesign.previewUrl,
      topAuditFindings: revenueLeakAudit.findings.slice(0, 3).map((finding) => finding.title),
      outreachSubject: outreachAssets.email.subject,
    },
    contents: {
      researchReport,
      competitorAnalysis,
      revenueLeakAudit,
      websiteRedesign,
      annotationAssets,
      loomScripts,
      outreachAssets,
    },
  };
}

/**
 * End-to-end V6 pipeline: manual intake -> complete sales package.
 */
export async function generateV6Package(input, { packageId = newPackageId() } = {}) {
  const intake = normalizeV6Intake(input, packageId);
  const lead = buildWorkingLead(intake);

  const researchReport = await buildResearchReport(lead, intake);
  const workingLead = researchReport.enrichedLead ?? lead;

  const competitorAnalysis = buildCompetitorAnalysis(researchReport);
  const revenueLeakAudit = buildRevenueLeakAudit(researchReport);
  const websiteRedesign = await buildWebsiteRedesign(workingLead);
  const annotationAssets = buildAnnotationAssets({
    audit: revenueLeakAudit,
    website: websiteRedesign,
  });
  const loomScripts = buildLoomScripts({
    research: researchReport,
    audit: revenueLeakAudit,
    annotations: annotationAssets,
    website: websiteRedesign,
  });
  const outreachAssets = buildOutreachAssets({
    lead: workingLead,
    research: researchReport,
    audit: revenueLeakAudit,
    website: websiteRedesign,
  });

  const sanitizedResearch = { ...researchReport };
  delete sanitizedResearch.enrichedLead;

  const salesPackage = buildSalesPackageRecord({
    packageId,
    intake,
    researchReport: sanitizedResearch,
    competitorAnalysis,
    revenueLeakAudit,
    websiteRedesign,
    annotationAssets,
    loomScripts,
    outreachAssets,
  });

  const deliverables = {
    researchReport: sanitizedResearch,
    competitorAnalysis,
    revenueLeakAudit,
    websiteRedesign,
    annotationAssets,
    loomScripts,
    outreachAssets,
    salesPackage,
  };

  const artifactFiles = await writeV6Artifacts(packageId, deliverables);

  const record = {
    id: packageId,
    businessName: intake.businessName,
    status: "ready",
    intake,
    deliverables,
    artifactFiles,
    previewUrl: websiteRedesign.previewUrl,
    severityScore: revenueLeakAudit.severityScore,
    createdAt: intake.createdAt,
    updatedAt: nowIso(),
  };

  await saveV6Package(record);
  return record;
}

export async function getV6PackageDownload(packageId) {
  const record = await getV6Package(packageId);
  if (!record) return null;
  return buildDownloadBundle(record);
}
