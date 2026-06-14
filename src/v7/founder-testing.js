import { getFounderNotes, saveFounderNotes } from "./founder-notes.js";
import { buildFunnelMetrics } from "./funnel-metrics.js";
import { runProjectActivation } from "./activation.js";
import { markProjectLaunchPaid } from "./opportunity-project.js";
import {
  getOpportunityProject,
  listOpportunityProjects,
} from "./opportunity-project-store.js";
import { calculateSalesReadiness } from "./sales-readiness.js";
import { publicBaseUrl } from "./shared.js";

function projectLinks(project, base) {
  const token = project.customerAccessToken;
  return {
    preview: `${base}/p/${project.id}`,
    launch: `${base}/launch/${project.id}`,
    activation: `${base}/activate/${project.id}`,
    dashboard: token
      ? `${base}/dashboard/${project.id}?token=${encodeURIComponent(token)}`
      : `${base}/dashboard/${project.id}`,
  };
}

export async function buildFounderProjectView(project, req) {
  const base = publicBaseUrl(req);
  const [metrics, notes] = await Promise.all([
    buildFunnelMetrics(project.id),
    getFounderNotes(project.id),
  ]);
  const readiness = calculateSalesReadiness(project, metrics, notes);
  const links = projectLinks(project, base);

  return {
    id: project.id,
    businessName: project.businessName,
    category: project.category,
    city: project.city,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    links,
    metrics,
    notes,
    readiness,
    flags: {
      launchPaid: Boolean(project.billing?.launchPaid || project.flags?.launchPaid),
      founderTest: Boolean(project.billing?.founderTest),
      dashboardReady: Boolean(project.flags?.dashboardReady),
    },
  };
}

export async function listFounderTestingView(req) {
  const projects = await listOpportunityProjects();
  const views = await Promise.all(projects.map((project) => buildFounderProjectView(project, req)));
  const avgReadiness =
    views.length > 0
      ? Math.round(
          (views.reduce((sum, entry) => sum + entry.readiness.overallReadiness, 0) / views.length) *
            10
        ) / 10
      : null;

  return {
    projects: views,
    summary: {
      projectCount: views.length,
      averageReadiness: avgReadiness,
      totalPurchases: views.reduce((sum, entry) => sum + entry.metrics.purchases, 0),
      totalPreviewViews: views.reduce((sum, entry) => sum + entry.metrics.previewViews, 0),
    },
  };
}

export async function getFounderTestingProject(projectId, req) {
  const project = await getOpportunityProject(projectId);
  if (!project) return null;
  return buildFounderProjectView(project, req);
}

export async function updateFounderTestingNotes(projectId, input) {
  return saveFounderNotes(projectId, input);
}

export async function getFounderWalkSteps(projectId, req) {
  const project = await getOpportunityProject(projectId);
  if (!project) return null;
  const base = publicBaseUrl(req);
  const links = projectLinks(project, base);

  return {
    projectId,
    businessName: project.businessName,
    steps: [
      {
        key: "preview",
        label: "Preview",
        description: "See the website we built — exactly what a prospect sees first.",
        url: links.preview,
      },
      {
        key: "launch",
        label: "Launch Page",
        description: "Review the $1,000 offer, pricing, and call to action.",
        url: links.launch,
      },
      {
        key: "activation",
        label: "Activation",
        description: "Post-purchase activation — campaign goes live.",
        url: links.activation,
        requiresPurchase: true,
      },
      {
        key: "dashboard",
        label: "Dashboard",
        description: "Outcome dashboard — momentum, visitors, and activity.",
        url: links.dashboard,
        requiresActivation: true,
      },
    ],
  };
}

export async function simulateFounderTestPurchase(projectId) {
  const project = await getOpportunityProject(projectId);
  if (!project) throw new Error("Project not found");

  const updated = await markProjectLaunchPaid(projectId, {
    email: project.customerEmail || "founder-test@local",
    founderTest: true,
  });

  return {
    projectId,
    launchPaid: true,
    founderTest: true,
    customerAccessToken: updated?.customerAccessToken ?? null,
  };
}

export async function runFounderWalkActivation(projectId, req) {
  const project = await getOpportunityProject(projectId);
  if (!project) throw new Error("Project not found");

  if (!project.billing?.launchPaid && !project.flags?.launchPaid) {
    await simulateFounderTestPurchase(projectId);
  }

  const result = await runProjectActivation({ projectId, sessionId: "", req });
  if (!result.ok) {
    throw new Error(result.reason || "Activation failed");
  }

  const base = publicBaseUrl(req);
  const links = projectLinks(result.project, base);

  return {
    ok: true,
    dashboardUrl: result.dashboardUrl,
    links,
  };
}
