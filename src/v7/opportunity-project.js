import { generatePreviewSiteV3 } from "../preview-v3.js";
import { normalizeV6Intake, buildWorkingLead } from "../v6/intake.js";
import { appendActivityEvent } from "./activity-events.js";
import {
  getOpportunityProject,
  saveOpportunityProject,
} from "./opportunity-project-store.js";
import { cleanText, geoCellFromCity, newCustomerToken, newProjectId, nowIso, publicBaseUrl } from "./shared.js";

function defaultMetrics() {
  return {
    visitorsLifetime: 0,
    visitorsThisWeek: 0,
    visitorsPriorWeek: 0,
    contentPublished: 0,
    lastActivityAt: null,
    lastVisitorAt: null,
  };
}

function defaultFlags() {
  return {
    websiteLive: false,
    visibilityCampaignActivated: false,
    dashboardReady: false,
    campaignStarted: false,
    launchPaid: false,
  };
}

export async function createOpportunityProject(input = {}) {
  const projectId = newProjectId();
  const intake = normalizeV6Intake(input, projectId);
  const lead = buildWorkingLead(intake);
  const preview = await generatePreviewSiteV3(lead);
  const previewUrl = `/previews/${preview.dirName}/index.html`;

  const record = {
    id: projectId,
    businessName: intake.businessName,
    category: intake.category,
    city: intake.city,
    phone: intake.phone,
    websiteUrl: intake.websiteUrl,
    googleMapsUrl: intake.googleMapsUrl,
    notes: intake.notes,
    status: "preview_ready",
    momentumState: "launching",
    geoCell: geoCellFromCity(intake.city),
    leadId: lead.id,
    preview: {
      previewUrl,
      previewDirName: preview.dirName,
      slug: preview.slug,
      generatedAt: nowIso(),
    },
    flags: defaultFlags(),
    metrics: defaultMetrics(),
    billing: {
      launchPaid: false,
      launchPaidAt: null,
      stripeCustomerId: null,
      stripeCheckoutSessionId: null,
    },
    customerAccessToken: null,
    customerEmail: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await saveOpportunityProject(record);
  return record;
}

export async function createOpportunityProjectFromQualifiedBusiness(
  business,
  { req, source = "qualified_business_database" } = {},
) {
  const startedAt = Date.now();
  const intake = {
    businessName: cleanText(business.businessName),
    category: cleanText(business.category || business.industry),
    industry: cleanText(business.industry),
    city: `${cleanText(business.city)}${cleanText(business.state) ? `, ${cleanText(business.state)}` : ""}`,
    state: cleanText(business.state),
    address: cleanText(business.address),
    phone: cleanText(business.phone || business.normalizedPhone),
    websiteUrl: cleanText(business.websiteUrl),
    googleMapsUrl: cleanText(business.googleMapsUrl),
    googleReviewCount: Number(business.googleReviewCount) || 0,
    googleRating: Number(business.googleRating) || 0,
    websiteStatus: cleanText(business.websiteStatus),
    websiteScore: Number(business.websiteScore) || 0,
    websiteScoreReasons: Array.isArray(business.websiteScoreReasons) ? business.websiteScoreReasons : [],
    qualificationReason: cleanText(business.qualificationReason),
    contactMethodCategory: cleanText(business.contactMethodCategory),
    notes: [
      `Source: ${source}`,
      `Qualified business ID: ${cleanText(business.id)}`,
      cleanText(business.address) ? `Address: ${cleanText(business.address)}` : "",
      Number(business.googleRating) ? `Google rating: ${Number(business.googleRating)}` : "",
      Number(business.googleReviewCount) ? `Review count: ${Number(business.googleReviewCount)}` : "",
      cleanText(business.email) ? `Email: ${cleanText(business.email)}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
  };

  const project = await createOpportunityProject(intake);
  const base = req ? publicBaseUrl(req) : cleanText(process.env.PUBLIC_BASE_URL) || "http://localhost:8787";
  const links = {
    previewUrl: `${base}/p/${project.id}`,
    launchUrl: `${base}/launch/${project.id}`,
    dashboardUrl: `${base}/dashboard/${project.id}`,
  };

  return {
    project,
    links,
    generationDurationMs: Date.now() - startedAt,
  };
}

export async function recordProjectVisitor(projectId) {
  const project = await getOpportunityProject(projectId);
  if (!project) return null;

  const metrics = { ...defaultMetrics(), ...project.metrics };
  metrics.visitorsLifetime += 1;
  metrics.visitorsThisWeek += 1;
  metrics.lastVisitorAt = nowIso();

  const updated = await saveOpportunityProject({
    ...project,
    metrics,
  });
  return updated;
}

export async function markProjectLaunchPaid(projectId, patch = {}) {
  const project = await getOpportunityProject(projectId);
  if (!project) return null;

  const token = project.customerAccessToken || newCustomerToken();
  const updated = await saveOpportunityProject({
    ...project,
    status: "launch_paid",
    customerAccessToken: token,
    customerEmail: cleanText(patch.email) || project.customerEmail,
    billing: {
      ...project.billing,
      launchPaid: true,
      launchPaidAt: nowIso(),
      founderTest: Boolean(patch.founderTest) || Boolean(project.billing?.founderTest),
      stripeCustomerId: cleanText(patch.stripeCustomerId) || project.billing?.stripeCustomerId,
      stripeCheckoutSessionId:
        cleanText(patch.stripeCheckoutSessionId) || project.billing?.stripeCheckoutSessionId,
    },
    flags: {
      ...defaultFlags(),
      ...project.flags,
      launchPaid: true,
    },
  });
  return updated;
}

export async function activateOpportunityProject(projectId) {
  const project = await getOpportunityProject(projectId);
  if (!project) throw new Error("Project not found");
  if (!project.billing?.launchPaid && !project.flags?.launchPaid) {
    throw new Error("Launch payment is required before activation.");
  }

  const token = project.customerAccessToken || newCustomerToken();
  const alreadyStarted = Boolean(project.flags?.campaignStarted);

  const updated = await saveOpportunityProject({
    ...project,
    status: "active",
    momentumState: "launching",
    customerAccessToken: token,
    flags: {
      ...defaultFlags(),
      ...project.flags,
      websiteLive: true,
      visibilityCampaignActivated: true,
      dashboardReady: true,
      campaignStarted: true,
      launchPaid: true,
    },
    metrics: {
      ...defaultMetrics(),
      ...project.metrics,
      lastActivityAt: nowIso(),
    },
  });

  if (!alreadyStarted) {
    await appendActivityEvent({
      projectId,
      type: "campaign_started",
      headline: "Your visibility campaign is live",
      detail: `We're watching what people in ${cleanText(project.city) || "your area"} need.`,
      geoLabel: cleanText(project.city),
    });
  }

  return updated;
}
