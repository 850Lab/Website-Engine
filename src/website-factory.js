import { access, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";
import { getManifestPath } from "./assets/asset-pipeline.js";
import { findPreviewV3ForLead } from "./render-preview-v3.js";
import { listDeploymentRecords } from "./deployment.js";
import { listWebsiteFactoryStates } from "./website-state.js";
import { listWebsiteQcRecords } from "./qc.js";
import { listOutreachQueueRecords } from "./outreach-queue.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PREVIEWS_ROOT = join(ROOT, "previews-v3");
const RENDERS_ROOT = join(ROOT, "renders");

export const WEBSITE_MAPPINGS_FILE = join(DATA_DIR, "website-mappings.json");
export const WEBSITE_EVENTS_FILE = join(DATA_DIR, "website-events.json");
export const WEBSITE_EXCEPTION_ACTIONS_FILE = join(DATA_DIR, "website-exception-actions.json");
export const WEBSITE_LIFECYCLE_STAGES = [
  "intake",
  "research",
  "generation",
  "qc",
  "deployment",
  "live",
  "maintenance",
];

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "business";
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function defaultState() {
  return {
    version: 1,
    mappings: [],
  };
}

function normalizeMapping(mapping = {}) {
  const now = nowIso();
  return {
    websiteId: cleanText(mapping.websiteId) || `website_${randomUUID()}`,
    leadId: cleanText(mapping.leadId),
    revenueId: cleanText(mapping.revenueId),
    fulfillmentId: cleanText(mapping.fulfillmentId),
    clientId: cleanText(mapping.clientId),
    siteId: cleanText(mapping.siteId),
    createdAt: cleanText(mapping.createdAt) || now,
    updatedAt: cleanText(mapping.updatedAt) || now,
  };
}

function normalizeState(input = {}) {
  return {
    version: 1,
    mappings: Array.isArray(input.mappings) ? input.mappings.map(normalizeMapping) : [],
  };
}

function normalizeEvent(event = {}) {
  const now = nowIso();
  return {
    eventId: cleanText(event.eventId) || `website_event_${randomUUID()}`,
    websiteId: cleanText(event.websiteId),
    type: cleanText(event.type) || "website_action",
    label: cleanText(event.label) || "Website action",
    detail: cleanText(event.detail),
    source: cleanText(event.source) || "website",
    at: cleanText(event.at) || now,
    metadata: event.metadata && typeof event.metadata === "object" ? event.metadata : {},
  };
}

function normalizeEventsState(input = {}) {
  return {
    version: 1,
    events: Array.isArray(input.events) ? input.events.map(normalizeEvent) : [],
  };
}

function normalizeExceptionAction(action = {}) {
  return {
    exceptionId: cleanText(action.exceptionId),
    status: cleanText(action.status) || "open",
    escalated: Boolean(action.escalated),
    manualReview: Boolean(action.manualReview),
    retryCount: Math.max(0, Number(action.retryCount) || 0),
    createdAt: cleanText(action.createdAt) || nowIso(),
    updatedAt: cleanText(action.updatedAt) || nowIso(),
    resolvedAt: cleanText(action.resolvedAt),
    notes: cleanText(action.notes),
  };
}

function normalizeExceptionActionState(input = {}) {
  return {
    version: 1,
    actions: Array.isArray(input.actions) ? input.actions.map(normalizeExceptionAction) : [],
  };
}

async function readMappingState() {
  try {
    return normalizeState(JSON.parse(await readFile(WEBSITE_MAPPINGS_FILE, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return defaultState();
    throw err;
  }
}

async function writeMappingState(state) {
  const normalized = normalizeState(state);
  await writeJsonFileSafe(WEBSITE_MAPPINGS_FILE, normalized);
  return normalized;
}

async function readEventsState() {
  try {
    return normalizeEventsState(JSON.parse(await readFile(WEBSITE_EVENTS_FILE, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return { version: 1, events: [] };
    throw err;
  }
}

async function writeEventsState(state) {
  const normalized = normalizeEventsState(state);
  await writeJsonFileSafe(WEBSITE_EVENTS_FILE, normalized);
  return normalized;
}

export async function appendWebsiteEvent(websiteId, event = {}) {
  const state = await readEventsState();
  const next = normalizeEvent({ ...event, websiteId });
  state.events.push(next);
  await writeEventsState(state);
  return next;
}

export async function listWebsiteEvents() {
  return (await readEventsState()).events;
}

async function readExceptionActionState() {
  try {
    return normalizeExceptionActionState(JSON.parse(await readFile(WEBSITE_EXCEPTION_ACTIONS_FILE, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return { version: 1, actions: [] };
    throw err;
  }
}

async function writeExceptionActionState(state) {
  const normalized = normalizeExceptionActionState(state);
  await writeJsonFileSafe(WEBSITE_EXCEPTION_ACTIONS_FILE, normalized);
  return normalized;
}

export async function updateWebsiteExceptionAction(exceptionId, patch = {}) {
  const state = await readExceptionActionState();
  const index = state.actions.findIndex((action) => action.exceptionId === exceptionId);
  const current = index === -1 ? { exceptionId, createdAt: nowIso() } : state.actions[index];
  const next = normalizeExceptionAction({
    ...current,
    ...patch,
    exceptionId,
    updatedAt: nowIso(),
  });
  if (index === -1) state.actions.push(next);
  else state.actions[index] = next;
  await writeExceptionActionState(state);
  return next;
}

export async function listWebsiteExceptionActions() {
  return (await readExceptionActionState()).actions;
}

function mappingMatches(mapping, candidate = {}) {
  return Boolean(
    (candidate.leadId && mapping.leadId === candidate.leadId) ||
    (candidate.revenueId && mapping.revenueId === candidate.revenueId) ||
    (candidate.fulfillmentId && mapping.fulfillmentId === candidate.fulfillmentId) ||
    (candidate.clientId && mapping.clientId === candidate.clientId) ||
    (candidate.siteId && mapping.siteId === candidate.siteId)
  );
}

function mergeMapping(mapping, candidate = {}) {
  return normalizeMapping({
    ...mapping,
    leadId: mapping.leadId || candidate.leadId,
    revenueId: mapping.revenueId || candidate.revenueId,
    fulfillmentId: mapping.fulfillmentId || candidate.fulfillmentId,
    clientId: mapping.clientId || candidate.clientId,
    siteId: mapping.siteId || candidate.siteId,
    updatedAt: nowIso(),
  });
}

function compactCandidates({ leads = [], revenueRecords = [], fulfillmentRecords = [], clients = [], sites = [] } = {}) {
  const candidates = [];
  for (const lead of leads) {
    candidates.push({ leadId: lead.id });
  }
  for (const revenue of revenueRecords) {
    candidates.push({
      leadId: revenue.leadId,
      revenueId: revenue.revenueId,
      clientId: revenue.clientId,
    });
  }
  for (const client of clients) {
    candidates.push({
      leadId: client.sourceLeadId,
      clientId: client.clientId,
    });
  }
  for (const site of sites) {
    candidates.push({
      clientId: site.clientId,
      siteId: site.siteId,
    });
  }
  for (const fulfillment of fulfillmentRecords) {
    candidates.push({
      leadId: fulfillment.leadId,
      revenueId: fulfillment.revenueId,
      fulfillmentId: fulfillment.fulfillmentId,
      clientId: fulfillment.clientId,
      siteId: fulfillment.siteId,
    });
  }
  return candidates.filter((candidate) =>
    candidate.leadId ||
    candidate.revenueId ||
    candidate.fulfillmentId ||
    candidate.clientId ||
    candidate.siteId
  );
}

export async function syncWebsiteMappings(data = {}) {
  const state = await readMappingState();
  let mappings = [...state.mappings];
  for (const candidate of compactCandidates(data)) {
    const matchingIndexes = mappings
      .map((mapping, index) => ({ mapping, index }))
      .filter(({ mapping }) => mappingMatches(mapping, candidate))
      .map(({ index }) => index);
    if (!matchingIndexes.length) {
      mappings.push(normalizeMapping(candidate));
      continue;
    }
    const [primaryIndex, ...duplicateIndexes] = matchingIndexes;
    let merged = mergeMapping(mappings[primaryIndex], candidate);
    for (const duplicateIndex of duplicateIndexes) {
      merged = mergeMapping(merged, mappings[duplicateIndex]);
    }
    mappings = mappings.filter((_, index) => !duplicateIndexes.includes(index));
    const nextPrimaryIndex = mappings.findIndex((mapping) => mapping.websiteId === merged.websiteId);
    if (nextPrimaryIndex === -1) mappings.push(merged);
    else mappings[nextPrimaryIndex] = merged;
  }
  await writeMappingState({ ...state, mappings });
  return mappings;
}

async function buildPreview(lead) {
  if (!lead) {
    return {
      previewUrl: null,
      previewExists: false,
      assetsReady: false,
      desktopRenderUrl: null,
      mobileRenderUrl: null,
      desktopExists: false,
      mobileExists: false,
    };
  }
  const existing = await findPreviewV3ForLead(lead);
  const slug = slugify(lead.businessName);
  const previewDirBase = existing?.dirName ?? (existing?.dir ? basename(existing.dir) : `${slug}-${String(lead.id ?? "").slice(0, 8)}`);
  const previewDir = join(PREVIEWS_ROOT, previewDirBase);
  const renderDir = join(RENDERS_ROOT, previewDirBase);
  const previewExists = await fileExists(join(previewDir, "index.html"));
  const assetsReady = await fileExists(getManifestPath(previewDir));
  const desktopExists = await fileExists(join(renderDir, "desktop.png"));
  const mobileExists = await fileExists(join(renderDir, "mobile.png"));
  return {
    slug,
    previewDirBase,
    previewUrl: previewExists ? `/previews/${previewDirBase}/index.html` : null,
    previewExists,
    assetsReady,
    desktopRenderUrl: desktopExists ? `/renders/${previewDirBase}/desktop.png` : null,
    mobileRenderUrl: mobileExists ? `/renders/${previewDirBase}/mobile.png` : null,
    desktopExists,
    mobileExists,
  };
}

function isOpenRequest(request = {}) {
  return !["completed", "cancelled"].includes(request.status);
}

function hasEvent(events, type) {
  return events.some((event) => event.type === type);
}

function deriveLifecycleStage({ lead, preview, revenue, fulfillment, site, client, maintenanceRequests = [], websiteEvents = [], deployment }) {
  const openMaintenance = maintenanceRequests.some(isOpenRequest);
  const deployedUrl = deployment?.deployedUrl || site?.deploymentUrl || site?.domain || "";
  if (openMaintenance || maintenanceRequests.length > 0) return "maintenance";
  if (deployedUrl && (fulfillment?.status === "launched" || client?.billingStatus === "active")) return "live";
  if (deployment?.status === "ready" || site || fulfillment || hasEvent(websiteEvents, "qc_approved")) return "deployment";
  if (lead?.previewStatus === "approved" || preview.desktopExists || preview.mobileExists || lead?.previewStatus === "rendered") return "qc";
  if (preview.previewExists || ["generated", "assets_ready"].includes(lead?.previewStatus) || hasEvent(websiteEvents, "research_approved")) return "generation";
  if (lead?.score || lead?.category || lead?.status || lead?.websiteUrl) return "research";
  return "intake";
}

function addTimeline(items, item) {
  if (!item?.at) return;
  items.push({
    at: item.at,
    type: item.type,
    label: item.label,
    detail: item.detail || "",
    source: item.source || "",
  });
}

function buildTimeline({ lead, revenue, fulfillment, maintenanceRequests = [], websiteEvents = [], deployment }) {
  const items = [];
  addTimeline(items, { at: lead?.createdAt, type: "intake", label: "Lead created", source: "lead" });
  addTimeline(items, { at: lead?.updatedAt, type: "research", label: "Lead updated", source: "lead" });
  addTimeline(items, { at: lead?.previewGeneratedAt, type: "generation", label: "Preview generated", source: "preview" });
  addTimeline(items, { at: lead?.previewApprovedAt, type: "qc", label: "Preview approved", source: "preview" });
  for (const entry of lead?.outreachHistory ?? []) {
    addTimeline(items, {
      at: entry.at || entry.createdAt || entry.sentAt,
      type: "outreach",
      label: entry.type || "Outreach activity",
      detail: entry.summary || entry.notes || "",
      source: "lead",
    });
  }
  for (const entry of lead?.operatorActivityLog ?? []) {
    addTimeline(items, {
      at: entry.at || entry.createdAt,
      type: entry.type || "activity",
      label: entry.summary || entry.type || "Operator activity",
      source: "lead",
    });
  }
  for (const entry of revenue?.stageHistory ?? []) {
    addTimeline(items, {
      at: entry.at,
      type: "revenue",
      label: `${entry.previousStage || "start"} to ${entry.newStage}`,
      detail: entry.notes,
      source: "revenue",
    });
  }
  for (const reply of revenue?.replies ?? []) {
    addTimeline(items, {
      at: reply.receivedAt,
      type: "reply",
      label: `Reply logged (${reply.sentiment || "neutral"})`,
      detail: reply.nextAction || reply.replyText || "",
      source: "revenue",
    });
  }
  for (const meeting of revenue?.meetings ?? []) {
    addTimeline(items, {
      at: meeting.scheduledAt,
      type: "meeting",
      label: "Meeting scheduled",
      detail: meeting.expectedOutcome || meeting.notes || "",
      source: "revenue",
    });
  }
  for (const proposal of revenue?.proposals ?? []) {
    addTimeline(items, {
      at: proposal.sentAt || proposal.createdAt,
      type: "proposal",
      label: `Proposal ${proposal.status || "created"}`,
      detail: proposal.checkoutUrl || proposal.proposalNotes || "",
      source: "revenue",
    });
  }
  for (const evidence of revenue?.activationEvidence ?? []) {
    addTimeline(items, {
      at: evidence.at,
      type: "activation",
      label: "Activation proof recorded",
      detail: evidence.eventType || evidence.notes || "",
      source: "revenue",
    });
  }
  addTimeline(items, { at: fulfillment?.createdAt, type: "fulfillment", label: "Fulfillment created", source: "fulfillment" });
  addTimeline(items, {
    at: deployment?.createdAt,
    type: "deployment",
    label: `Preview deployment ${deployment?.status || "created"}`,
    detail: deployment?.deployedUrl || (deployment?.logs ?? []).join(" | "),
    source: "deployment",
  });
  for (const item of fulfillment?.checklist ?? []) {
    addTimeline(items, {
      at: item.completedAt,
      type: "fulfillment",
      label: `${item.label} completed`,
      detail: item.notes,
      source: "fulfillment",
    });
  }
  for (const request of maintenanceRequests) {
    addTimeline(items, {
      at: request.createdAt,
      type: "maintenance",
      label: `Maintenance request created: ${request.title}`,
      detail: request.description || request.notes || "",
      source: "operations",
    });
    addTimeline(items, {
      at: request.completedDate,
      type: "maintenance",
      label: `Maintenance request completed: ${request.title}`,
      source: "operations",
    });
  }
  for (const event of websiteEvents) {
    addTimeline(items, {
      at: event.at,
      type: event.type,
      label: event.label,
      detail: event.detail,
      source: event.source || "website",
    });
  }
  return items.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

function exception(severity, type, message, action) {
  return { severity, type, message, recommendedAction: action };
}

function buildExceptions({ lead, preview, revenue, fulfillment, site, client, maintenanceRequests = [], deployment, websiteEvents = [], qc }) {
  const exceptions = [];
  if (lead && !preview.previewExists && ["preview_ready", "contacted", "replied", "won"].includes(lead.pipelineStage)) {
    exceptions.push(exception("high", "preview_missing", "Lead is past intake but no preview artifact exists.", "Regenerate the website preview."));
  }
  if (preview.previewExists && !preview.assetsReady) {
    exceptions.push(exception("medium", "missing_assets", "Preview exists but asset manifest is missing.", "Run asset preparation."));
  }
  if (["rendered", "approved"].includes(lead?.previewStatus) && !preview.desktopExists && !preview.mobileExists) {
    exceptions.push(exception("medium", "preview_screenshots_missing", "Preview is marked rendered/approved but screenshots are missing.", "Render preview screenshots."));
  }
  if (lead?.previewStatus === "generated" || lead?.previewStatus === "assets_ready") {
    exceptions.push(exception("medium", "qc_pending", "Generated site has not cleared QC approval.", "Review and approve the preview."));
  }
  if (deployment?.status === "failed") {
    exceptions.push(exception("high", "deployment_failed", "Public preview deployment failed.", "Retry deployment from Website Detail."));
  }
  if (qc?.status === "failed") {
    exceptions.push(exception("high", "qc_failed", "Deterministic QC failed.", "Open Website Detail and resolve QC blockers before deployment."));
  }
  if ((hasEvent(websiteEvents, "qc_approved") || qc?.status === "passed") && !deployment?.deployedUrl) {
    exceptions.push(exception("medium", "deployment_missing", "QC is approved but no public deployment URL exists.", "Deploy the generated preview."));
  }
  if (revenue?.currentStage === "checkout_started") {
    exceptions.push(exception("medium", "checkout_not_completed", "Checkout started but payment completion is not confirmed.", "Follow up or verify Stripe checkout."));
  }
  if (client && ["past_due", "canceled", "not_configured"].includes(client.billingStatus)) {
    exceptions.push(exception("high", "billing_issue", `Client billing status is ${client.billingStatus}.`, "Resolve billing before launch or maintenance escalation."));
  }
  if ((revenue?.currentStage === "activated" || client?.billingStatus === "active") && !site) {
    exceptions.push(exception("high", "missing_site", "Activated website has no Operations site record.", "Create or link a site record."));
  }
  if (fulfillment?.status === "blocked") {
    exceptions.push(exception("high", "fulfillment_blocked", "Fulfillment is blocked.", "Open fulfillment checklist and resolve blocked items."));
  }
  for (const item of fulfillment?.checklist ?? []) {
    if (item.status === "blocked") {
      exceptions.push(exception("high", "fulfillment_checklist_blocked", `${item.label} is blocked.`, item.notes || "Resolve the blocked checklist item."));
    }
  }
  for (const request of maintenanceRequests) {
    if (request.slaRisk === "overdue") {
      exceptions.push(exception("high", "maintenance_overdue", `${request.title} is overdue.`, "Complete or re-triage the maintenance request."));
    } else if (request.slaRisk === "at_risk") {
      exceptions.push(exception("medium", "maintenance_sla_risk", `${request.title} is at SLA risk.`, "Prioritize this request before it becomes overdue."));
    }
  }
  return exceptions;
}

function buildAutomationRuns({ lead, revenue, fulfillment }) {
  const runs = [];
  if (lead?.previewStatus && lead.previewStatus !== "not_generated") {
    runs.push({ type: "preview", status: lead.previewStatus, at: lead.updatedAt || lead.createdAt });
  }
  if (lead?.assetPipelineStatus) {
    runs.push({ type: "assets", status: lead.assetPipelineStatus, at: lead.updatedAt || lead.createdAt });
  }
  if (revenue?.activationEvidence?.length) {
    for (const evidence of revenue.activationEvidence) {
      runs.push({ type: "stripe_activation", status: evidence.billingStatus || "recorded", at: evidence.at, eventId: evidence.eventId });
    }
  }
  if (fulfillment) {
    runs.push({ type: "fulfillment", status: fulfillment.status, at: fulfillment.updatedAt || fulfillment.createdAt });
  }
  return runs.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

function buildWebsiteAutomationRuns({ lead, revenue, fulfillment, deployment, qc, outreach }) {
  const runs = buildAutomationRuns({ lead, revenue, fulfillment });
  if (deployment) {
    runs.push({
      type: "deployment",
      status: deployment.status,
      at: deployment.updatedAt || deployment.createdAt,
      deploymentId: deployment.deploymentId,
    });
  }
  if (qc) {
    runs.push({ type: "qc", status: qc.status, at: qc.updatedAt || qc.createdAt, qcId: qc.qcId });
  }
  if (outreach) {
    runs.push({ type: "outreach", status: outreach.sendStatus, at: outreach.updatedAt || outreach.createdAt, outreachId: outreach.outreachId });
  }
  return runs.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

function conveyorSeverity(exceptions = []) {
  if (exceptions.some((item) => item.severity === "high" || item.severity === "critical")) return "critical";
  if (exceptions.some((item) => item.severity === "medium" || item.severity === "warning")) return "warning";
  return exceptions.length ? "info" : "info";
}

function normalizeExceptionSeverity(severity) {
  if (severity === "high" || severity === "critical") return "critical";
  if (severity === "medium" || severity === "warning") return "warning";
  return "info";
}

function exceptionCategory(type = "") {
  if (type.includes("research")) return "research";
  if (type.includes("preview") || type.includes("asset") || type.includes("screenshot")) return "generation";
  if (type.includes("qc")) return "qc";
  if (type.includes("site") || type.includes("deployment")) return "deployment";
  if (type.includes("billing") || type.includes("checkout")) return "billing";
  if (type.includes("fulfillment")) return "fulfillment";
  if (type.includes("maintenance")) return "maintenance";
  return "factory";
}

function exceptionIdFor(websiteId, type, stage, index) {
  return `${websiteId}_${stage}_${type}_${index}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function resolutionTimeHours(exception) {
  if (!exception.resolvedAt) return null;
  const created = new Date(exception.createdAt);
  const resolved = new Date(exception.resolvedAt);
  if (Number.isNaN(created.getTime()) || Number.isNaN(resolved.getTime())) return null;
  return Math.round(((resolved.getTime() - created.getTime()) / (60 * 60 * 1000)) * 10) / 10;
}

function buildUnifiedExceptions(websites, actionState = []) {
  const actionsById = new Map(actionState.map((action) => [action.exceptionId, action]));
  const exceptions = [];
  for (const website of websites) {
    (website.exceptions ?? []).forEach((item, index) => {
      const category = exceptionCategory(item.type);
      const exceptionId = exceptionIdFor(website.websiteId, item.type, website.currentStage, index);
      const action = actionsById.get(exceptionId) ?? {};
      const createdAt = action.createdAt || website.mapping?.updatedAt || website.timeline?.[0]?.at || nowIso();
      exceptions.push({
        exceptionId,
        websiteId: website.websiteId,
        businessName: website.businessName,
        severity: normalizeExceptionSeverity(item.severity),
        category,
        stage: website.currentStage,
        message: item.message,
        recommendedAction: item.recommendedAction,
        createdAt,
        status: action.status || "open",
        escalated: Boolean(action.escalated),
        manualReview: Boolean(action.manualReview),
        retryCount: Math.max(0, Number(action.retryCount) || 0),
        resolvedAt: action.resolvedAt || "",
        resolutionTimeHours: resolutionTimeHours({ createdAt, resolvedAt: action.resolvedAt }),
      });
    });
  }
  const open = exceptions.filter((item) => item.status !== "resolved");
  const countBy = (key) => Object.fromEntries([...new Set(open.map((item) => item[key]))].sort().map((value) => [
    value,
    open.filter((item) => item[key] === value).length,
  ]));
  const resolved = exceptions.filter((item) => item.resolutionTimeHours !== null);
  return {
    exceptions,
    open,
    metrics: {
      totalExceptions: open.length,
      criticalExceptions: open.filter((item) => item.severity === "critical").length,
      warningExceptions: open.filter((item) => item.severity === "warning").length,
      websitesBlocked: new Set(open.filter((item) => item.severity === "critical").map((item) => item.websiteId)).size,
      byStage: countBy("stage"),
      byCategory: countBy("category"),
      averageResolutionHours: resolved.length
        ? Math.round((resolved.reduce((sum, item) => sum + item.resolutionTimeHours, 0) / resolved.length) * 10) / 10
        : null,
      topRecurringFailures: Object.entries(countBy("category"))
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    },
  };
}

function latestAutomationStatus(automationRuns = []) {
  const latest = [...automationRuns].sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  if (!latest) return "waiting";
  return `${latest.type}:${latest.status}`;
}

function nextActionForWebsite(website) {
  const exceptionTypes = new Set((website.exceptions ?? []).map((item) => item.type));
  if (exceptionTypes.has("billing_issue")) return "Resolve billing issue";
  if (exceptionTypes.has("missing_site")) return "Link site";
  if (exceptionTypes.has("fulfillment_blocked") || exceptionTypes.has("fulfillment_checklist_blocked")) return "Resolve fulfillment blocker";
  if (exceptionTypes.has("maintenance_overdue")) return "Complete maintenance request";
  if (exceptionTypes.has("maintenance_sla_risk")) return "Prioritize maintenance request";
  if (exceptionTypes.has("checkout_not_completed")) return "Verify checkout";
  if (exceptionTypes.has("deployment_failed") || exceptionTypes.has("deployment_missing")) return "Deploy preview";
  if (exceptionTypes.has("missing_assets")) return "Generate assets";
  if (exceptionTypes.has("preview_screenshots_missing")) return "Render screenshots";
  if (exceptionTypes.has("qc_pending")) return "Review QC";
  if (exceptionTypes.has("preview_missing")) return "Generate preview";

  if (website.currentStage === "intake") return "Refresh research";
  if (website.currentStage === "research") return "Approve research";
  if (website.currentStage === "generation") {
    if (!website.preview?.previewExists) return "Generate preview";
    if (!website.preview?.assetsReady) return "Generate assets";
    if (!website.preview?.desktopExists && !website.preview?.mobileExists) return "Render screenshots";
    return "Review QC";
  }
  if (website.currentStage === "qc") return "Approve QC";
  if (website.currentStage === "deployment") {
    if (!website.mapping.siteId) return "Link site";
    if (website.fulfillment?.status !== "launched") return "Complete launch checklist";
    return "Confirm deployment";
  }
  if (website.currentStage === "live") return "Monitor website health";
  if (website.currentStage === "maintenance") return website.maintenance?.open ? "Complete maintenance request" : "Monitor maintenance";
  return "Open Website";
}

function maintenanceSlaRisk(website) {
  if (website.maintenance?.overdue) return "overdue";
  if (website.maintenance?.atRisk) return "at_risk";
  if (website.maintenance?.open) return "on_track";
  return "none";
}

function deploymentStatus(website) {
  if (website.deployment?.status) return website.deployment.status;
  if (website.deployedUrl) return "ready";
  return "not_deployed";
}

function buildConveyor(websites) {
  const cards = websites.map((website) => ({
    websiteId: website.websiteId,
    businessName: website.businessName,
    currentStage: website.currentStage,
    factoryStatus: website.factoryStatus,
    automationStatus: latestAutomationStatus(website.automationRuns),
    exceptionCount: website.exceptionCount,
    exceptionSeverity: conveyorSeverity(website.exceptions),
    primaryExceptionId: website.unifiedExceptions?.[0]?.exceptionId || "",
    nextAction: nextActionForWebsite(website),
    previewUrl: website.previewUrl,
    deployedUrl: website.deployedUrl,
    deploymentStatus: deploymentStatus(website),
    qcStatus: website.qc?.status || "not_run",
    outreachStatus: website.outreach?.sendStatus || "not_queued",
    billingStatus: website.billingStatus,
    clientStatus: website.client?.status || "none",
    clientHealth: website.clientHealth,
    slaRisk: maintenanceSlaRisk(website),
  }));
  const byStage = Object.fromEntries(WEBSITE_LIFECYCLE_STAGES.map((stage) => [
    stage,
    cards.filter((card) => card.currentStage === stage),
  ]));
  const awaitingHumanDecision = cards.filter((card) =>
    card.exceptionCount > 0 ||
    ["Approve research", "Review QC", "Approve QC", "Link site", "Complete launch checklist", "Complete maintenance request"].includes(card.nextAction)
  ).length;
  return {
    stages: WEBSITE_LIFECYCLE_STAGES,
    cards,
    byStage,
    metrics: {
      totalWebsites: cards.length,
      inProduction: cards.filter((card) => !["live", "maintenance"].includes(card.currentStage)).length,
      awaitingHumanDecision,
      blocked: cards.filter((card) => card.exceptionSeverity === "critical").length,
      live: cards.filter((card) => card.currentStage === "live").length,
      maintenanceSlaRisk: cards.filter((card) => ["at_risk", "overdue"].includes(card.slaRisk)).length,
    },
  };
}

export async function buildWebsiteFactoryView({ leads = [], revenueRecords = [], fulfillmentRecords = [], operations = {} } = {}) {
  const clients = operations.clients ?? [];
  const sites = operations.sites ?? [];
  const maintenanceRequests = operations.maintenanceRequests ?? [];
  const deploymentRecords = await listDeploymentRecords();
  const websiteStates = await listWebsiteFactoryStates();
  const qcRecords = await listWebsiteQcRecords();
  const outreachRecords = await listOutreachQueueRecords();
  const mappings = await syncWebsiteMappings({ leads, revenueRecords, fulfillmentRecords, clients, sites });
  const websiteEvents = await listWebsiteEvents();
  const exceptionActions = await listWebsiteExceptionActions();
  const eventsByWebsite = new Map();
  for (const event of websiteEvents) {
    eventsByWebsite.set(event.websiteId, [...(eventsByWebsite.get(event.websiteId) ?? []), event]);
  }
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
  const revenueById = new Map(revenueRecords.map((record) => [record.revenueId, record]));
  const revenueByLead = new Map(revenueRecords.filter((record) => record.leadId).map((record) => [record.leadId, record]));
  const revenueByClient = new Map(revenueRecords.filter((record) => record.clientId).map((record) => [record.clientId, record]));
  const fulfillmentById = new Map(fulfillmentRecords.map((record) => [record.fulfillmentId, record]));
  const fulfillmentByRevenue = new Map(fulfillmentRecords.filter((record) => record.revenueId).map((record) => [record.revenueId, record]));
  const fulfillmentByClient = new Map(fulfillmentRecords.filter((record) => record.clientId).map((record) => [record.clientId, record]));
  const clientsById = new Map(clients.map((client) => [client.clientId, client]));
  const clientsByLead = new Map(clients.filter((client) => client.sourceLeadId).map((client) => [client.sourceLeadId, client]));
  const sitesById = new Map(sites.map((site) => [site.siteId, site]));
  const siteByClient = new Map(sites.filter((site) => site.clientId).map((site) => [site.clientId, site]));
  const deploymentsByWebsite = new Map();
  for (const record of deploymentRecords) {
    deploymentsByWebsite.set(record.websiteId, [
      ...(deploymentsByWebsite.get(record.websiteId) ?? []),
      record,
    ]);
  }
  const statesByWebsite = new Map(websiteStates.map((record) => [record.websiteId, record]));
  const qcByWebsite = new Map();
  for (const record of qcRecords) {
    qcByWebsite.set(record.websiteId, [
      ...(qcByWebsite.get(record.websiteId) ?? []),
      record,
    ]);
  }
  const outreachByWebsite = new Map();
  for (const record of outreachRecords) {
    outreachByWebsite.set(record.websiteId, [
      ...(outreachByWebsite.get(record.websiteId) ?? []),
      record,
    ]);
  }

  const websites = [];
  for (const mapping of mappings) {
    const lead = leadsById.get(mapping.leadId) ?? null;
    const revenue =
      revenueById.get(mapping.revenueId) ??
      (mapping.leadId ? revenueByLead.get(mapping.leadId) : null) ??
      (mapping.clientId ? revenueByClient.get(mapping.clientId) : null) ??
      null;
    const client =
      clientsById.get(mapping.clientId) ??
      (mapping.leadId ? clientsByLead.get(mapping.leadId) : null) ??
      (revenue?.clientId ? clientsById.get(revenue.clientId) : null) ??
      null;
    const site =
      sitesById.get(mapping.siteId) ??
      (client?.clientId ? siteByClient.get(client.clientId) : null) ??
      null;
    const fulfillment =
      fulfillmentById.get(mapping.fulfillmentId) ??
      (revenue?.revenueId ? fulfillmentByRevenue.get(revenue.revenueId) : null) ??
      (client?.clientId ? fulfillmentByClient.get(client.clientId) : null) ??
      null;
    const relatedRequests = maintenanceRequests.filter((request) =>
      request.fulfillmentId === fulfillment?.fulfillmentId ||
      request.siteId === site?.siteId ||
      request.clientId === client?.clientId
    );
    const relatedEvents = eventsByWebsite.get(mapping.websiteId) ?? [];
    const deploymentHistory = (deploymentsByWebsite.get(mapping.websiteId) ?? [])
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const deployment = deploymentHistory[0] ?? null;
    const lastSuccessfulDeployment = deploymentHistory.find((record) => record.deployedUrl && record.status !== "failed") ?? null;
    const factoryState = statesByWebsite.get(mapping.websiteId) ?? null;
    const qcHistory = (qcByWebsite.get(mapping.websiteId) ?? [])
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const qc = qcHistory[0] ?? null;
    const outreachHistory = (outreachByWebsite.get(mapping.websiteId) ?? [])
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const outreach = outreachHistory[0] ?? null;
    const preview = await buildPreview(lead);
    const currentStage = deriveLifecycleStage({ lead, preview, revenue, fulfillment, site, client, maintenanceRequests: relatedRequests, websiteEvents: relatedEvents, deployment });
    const exceptions = buildExceptions({ lead, preview, revenue, fulfillment, site, client, maintenanceRequests: relatedRequests, websiteEvents: relatedEvents, deployment, qc });
    const timeline = buildTimeline({ lead, revenue, fulfillment, maintenanceRequests: relatedRequests, websiteEvents: relatedEvents, deployment });
    const deployedUrl = deployment?.deployedUrl || lastSuccessfulDeployment?.deployedUrl || site?.deploymentUrl || (site?.domain ? `https://${site.domain.replace(/^https?:\/\//, "")}` : "");
    const website = {
      websiteId: mapping.websiteId,
      businessName: lead?.businessName || client?.companyName || site?.domain || mapping.websiteId,
      location: lead?.city || lead?.location || "",
      sourceWebsite: lead?.websiteUrl || site?.domain || "",
      currentStage,
      factoryStatus: factoryState?.factoryStatus || currentStage,
      factoryState,
      status: exceptions.some((item) => item.severity === "high") ? "blocked" : exceptions.length ? "needs_review" : "on_track",
      previewUrl: preview.previewUrl,
      deployedUrl,
      billingStatus: client?.billingStatus || "unknown",
      clientHealth: client?.healthScore ?? null,
      exceptionCount: exceptions.length,
      mapping: {
        ...mapping,
        leadId: mapping.leadId || lead?.id || "",
        revenueId: mapping.revenueId || revenue?.revenueId || "",
        fulfillmentId: mapping.fulfillmentId || fulfillment?.fulfillmentId || "",
        clientId: mapping.clientId || client?.clientId || "",
        siteId: mapping.siteId || site?.siteId || "",
      },
      preview,
      lead,
      revenue,
      fulfillment,
      deployment,
      deploymentHistory,
      qc,
      qcHistory,
      outreach,
      outreachHistory,
      client,
      site,
      maintenance: {
        requests: relatedRequests,
        open: relatedRequests.filter(isOpenRequest).length,
        overdue: relatedRequests.filter((request) => request.slaRisk === "overdue").length,
        atRisk: relatedRequests.filter((request) => request.slaRisk === "at_risk").length,
      },
      exceptions,
      timeline,
      websiteEvents: relatedEvents,
      automationRuns: buildWebsiteAutomationRuns({ lead, revenue, fulfillment, deployment, qc, outreach }),
    };
    websites.push(website);
  }
  websites.sort((a, b) => String(b.mapping.updatedAt).localeCompare(String(a.mapping.updatedAt)));
  const exceptionQueue = buildUnifiedExceptions(websites, exceptionActions);
  const exceptionsByWebsite = new Map();
  for (const exception of exceptionQueue.open) {
    exceptionsByWebsite.set(exception.websiteId, [
      ...(exceptionsByWebsite.get(exception.websiteId) ?? []),
      exception,
    ]);
  }
  for (const website of websites) {
    website.unifiedExceptions = exceptionsByWebsite.get(website.websiteId) ?? [];
  }
  const conveyor = buildConveyor(websites);
  return {
    version: 1,
    stages: WEBSITE_LIFECYCLE_STAGES,
    websites,
    conveyor,
    exceptionQueue,
    summary: {
      total: websites.length,
      byStage: Object.fromEntries(WEBSITE_LIFECYCLE_STAGES.map((stage) => [
        stage,
        websites.filter((website) => website.currentStage === stage).length,
      ])),
      exceptions: websites.reduce((sum, website) => sum + website.exceptionCount, 0),
      blocked: websites.filter((website) => website.status === "blocked").length,
      live: websites.filter((website) => website.currentStage === "live" || website.currentStage === "maintenance").length,
    },
  };
}

export function getWebsiteById(view, websiteId) {
  return view.websites.find((website) => website.websiteId === websiteId) ?? null;
}
