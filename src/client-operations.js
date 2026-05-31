import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";

export const CLIENT_OPERATIONS_FILE = join(DATA_DIR, "client-operations.json");

export const CLIENT_STATUSES = ["active", "archived"];
export const BILLING_STATUSES = ["not_configured", "checkout_started", "trial", "active", "past_due", "canceled"];
export const CANCELLATION_STATUSES = ["none", "requested", "cancel_at_period_end", "canceled"];
export const ONBOARDING_STATUSES = ["not_started", "in_progress", "waiting_client", "complete"];
export const SUPPORT_STATUSES = ["normal", "needs_attention", "at_risk", "paused"];
export const SITE_SSL_STATUSES = ["unknown", "pending", "active", "expired", "error"];
export const BACKUP_STATUSES = ["unknown", "not_configured", "current", "stale", "failed"];
export const UPTIME_STATUSES = ["unknown", "up", "degraded", "down"];
export const MAINTENANCE_STATUSES = [
  "submitted",
  "approved",
  "in_progress",
  "waiting_client",
  "completed",
  "cancelled",
];
export const MAINTENANCE_PRIORITIES = ["low", "normal", "high", "urgent"];

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function clamp(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeBillingStatus(value) {
  const status = cleanText(value);
  if (status === "cancelled") return "canceled";
  return clamp(status, BILLING_STATUSES, "not_configured");
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function healthScore(input, fallback = 75) {
  const score = Number(input);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeComparable(value) {
  return cleanText(value).toLowerCase();
}

function normalizePhoneComparable(value) {
  return cleanText(value).replace(/\D/g, "");
}

function defaultState() {
  return {
    version: 1,
    clients: [],
    sites: [],
    maintenanceRequests: [],
  };
}

async function readState() {
  try {
    const parsed = JSON.parse(await readFile(CLIENT_OPERATIONS_FILE, "utf8"));
    return normalizeState(parsed);
  } catch (err) {
    if (err.code === "ENOENT") return defaultState();
    throw err;
  }
}

async function writeState(state) {
  const normalized = normalizeState(state);
  await writeJsonFileSafe(CLIENT_OPERATIONS_FILE, normalized);
  return normalized;
}

function normalizeClient(client = {}) {
  const now = nowIso();
  return {
    clientId: cleanText(client.clientId) || `client_${randomUUID()}`,
    companyName: cleanText(client.companyName),
    primaryContact: cleanText(client.primaryContact),
    email: cleanText(client.email),
    phone: cleanText(client.phone),
    plan: cleanText(client.plan),
    status: clamp(client.status, CLIENT_STATUSES, "active"),
    activationPaid: Boolean(client.activationPaid),
    activationPaidAt: toIsoOrNull(client.activationPaidAt),
    stripeCustomerId: cleanText(client.stripeCustomerId),
    stripeSubscriptionId: cleanText(client.stripeSubscriptionId),
    billingStatus: normalizeBillingStatus(client.billingStatus),
    currentPeriodEnd: toIsoOrNull(client.currentPeriodEnd),
    lastPaymentStatus: cleanText(client.lastPaymentStatus) || "unknown",
    failedPaymentCount: Math.max(0, Number(client.failedPaymentCount) || 0),
    cancellationStatus: clamp(client.cancellationStatus, CANCELLATION_STATUSES, "none"),
    cancellationReason: cleanText(client.cancellationReason),
    onboardingStatus: clamp(client.onboardingStatus, ONBOARDING_STATUSES, "not_started"),
    supportStatus: clamp(client.supportStatus, SUPPORT_STATUSES, "normal"),
    healthScore: healthScore(client.healthScore),
    sourceLeadId: cleanText(client.sourceLeadId),
    archivedAt: toIsoOrNull(client.archivedAt),
    createdAt: toIsoOrNull(client.createdAt) || now,
    updatedAt: toIsoOrNull(client.updatedAt) || now,
  };
}

function normalizeSite(site = {}) {
  const now = nowIso();
  return {
    siteId: cleanText(site.siteId) || `site_${randomUUID()}`,
    clientId: cleanText(site.clientId),
    domain: cleanText(site.domain),
    hostingProvider: cleanText(site.hostingProvider) || "not_configured",
    deploymentUrl: cleanText(site.deploymentUrl),
    sslStatus: clamp(site.sslStatus, SITE_SSL_STATUSES, "unknown"),
    backupStatus: clamp(site.backupStatus, BACKUP_STATUSES, "unknown"),
    uptimeStatus: clamp(site.uptimeStatus, UPTIME_STATUSES, "unknown"),
    lastDeployment: toIsoOrNull(site.lastDeployment),
    createdAt: toIsoOrNull(site.createdAt) || now,
    updatedAt: toIsoOrNull(site.updatedAt) || now,
  };
}

function normalizeMaintenanceRequest(request = {}) {
  const now = nowIso();
  return {
    requestId: cleanText(request.requestId) || `request_${randomUUID()}`,
    clientId: cleanText(request.clientId),
    siteId: cleanText(request.siteId),
    title: cleanText(request.title),
    priority: clamp(request.priority, MAINTENANCE_PRIORITIES, "normal"),
    status: clamp(request.status, MAINTENANCE_STATUSES, "submitted"),
    assignedDate: toIsoOrNull(request.assignedDate) || now,
    completedDate: toIsoOrNull(request.completedDate),
    notes: cleanText(request.notes),
    createdAt: toIsoOrNull(request.createdAt) || now,
    updatedAt: toIsoOrNull(request.updatedAt) || now,
  };
}

function normalizeState(input = {}) {
  return {
    version: 1,
    clients: Array.isArray(input.clients) ? input.clients.map(normalizeClient) : [],
    sites: Array.isArray(input.sites) ? input.sites.map(normalizeSite) : [],
    maintenanceRequests: Array.isArray(input.maintenanceRequests)
      ? input.maintenanceRequests.map(normalizeMaintenanceRequest)
      : [],
  };
}

function isOpenRequest(request) {
  return !["completed", "cancelled"].includes(request.status);
}

function isOverdueRequest(request) {
  if (!isOpenRequest(request)) return false;
  const assigned = new Date(request.assignedDate);
  if (Number.isNaN(assigned.getTime())) return false;
  const ageMs = Date.now() - assigned.getTime();
  const limitMs = request.priority === "urgent"
    ? 24 * 60 * 60 * 1000
    : request.priority === "high"
      ? 3 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;
  return ageMs > limitMs;
}

function buildSummary(state) {
  const activeClients = state.clients.filter((client) => client.status === "active" && client.billingStatus !== "canceled");
  const openRequests = state.maintenanceRequests.filter(isOpenRequest);
  const overdueRequests = openRequests.filter(isOverdueRequest);
  const healthBuckets = {
    healthy: activeClients.filter((client) => client.healthScore >= 75).length,
    watch: activeClients.filter((client) => client.healthScore >= 50 && client.healthScore < 75).length,
    atRisk: activeClients.filter((client) => client.healthScore < 50).length,
  };
  return {
    activeClients: activeClients.length,
    archivedClients: state.clients.filter((client) => client.status === "archived").length,
    sites: state.sites.length,
    openRequests: openRequests.length,
    overdueRequests: overdueRequests.length,
    onboarding: {
      notStarted: activeClients.filter((client) => client.onboardingStatus === "not_started").length,
      inProgress: activeClients.filter((client) => client.onboardingStatus === "in_progress").length,
      waitingClient: activeClients.filter((client) => client.onboardingStatus === "waiting_client").length,
      complete: activeClients.filter((client) => client.onboardingStatus === "complete").length,
    },
    health: healthBuckets,
    billing: {
      notConfigured: activeClients.filter((client) => client.billingStatus === "not_configured").length,
      checkoutStarted: activeClients.filter((client) => client.billingStatus === "checkout_started").length,
      active: activeClients.filter((client) => client.billingStatus === "active").length,
      pastDue: activeClients.filter((client) => client.billingStatus === "past_due").length,
      canceled: activeClients.filter((client) => client.billingStatus === "canceled").length,
      failedPayments: activeClients.reduce((sum, client) => sum + (Number(client.failedPaymentCount) || 0), 0),
    },
  };
}

function buildOperationsHealth(state) {
  const activeClients = state.clients.filter((client) => client.status === "active");
  const sitesByClient = new Map();
  for (const site of state.sites) {
    sitesByClient.set(site.clientId, [...(sitesByClient.get(site.clientId) ?? []), site]);
  }
  const warnings = [];
  for (const client of activeClients) {
    if (!(sitesByClient.get(client.clientId) ?? []).length) {
      warnings.push({
        type: "client_without_site",
        severity: "medium",
        clientId: client.clientId,
        message: `${client.companyName} has no site registered.`,
      });
    }
    if (!client.plan) {
      warnings.push({
        type: "missing_plan",
        severity: "high",
        clientId: client.clientId,
        message: `${client.companyName} is missing a plan.`,
      });
    }
    if (!client.billingStatus || client.billingStatus === "not_configured") {
      warnings.push({
        type: "billing_missing",
        severity: "high",
        clientId: client.clientId,
        message: `${client.companyName} billing status is not configured.`,
      });
    }
    if (client.billingStatus === "past_due" || client.failedPaymentCount > 0) {
      warnings.push({
        type: "failed_payment",
        severity: "high",
        clientId: client.clientId,
        message: `${client.companyName} has billing trouble (${client.failedPaymentCount} failed payment(s)).`,
      });
    }
    if (client.billingStatus === "checkout_started" && !client.stripeSubscriptionId) {
      warnings.push({
        type: "checkout_not_completed",
        severity: "medium",
        clientId: client.clientId,
        message: `${client.companyName} checkout was started but no subscription is confirmed yet.`,
      });
    }
    if (client.cancellationStatus !== "none") {
      warnings.push({
        type: "cancellation_status",
        severity: client.cancellationStatus === "canceled" ? "high" : "medium",
        clientId: client.clientId,
        message: `${client.companyName} cancellation status: ${client.cancellationStatus}.`,
      });
    }
  }
  for (const site of state.sites) {
    if (!site.domain && !site.deploymentUrl) {
      warnings.push({
        type: "site_without_url",
        severity: "high",
        clientId: site.clientId,
        siteId: site.siteId,
        message: `Site ${site.siteId} has no domain or deployment URL.`,
      });
    }
  }
  for (const request of state.maintenanceRequests.filter(isOpenRequest)) {
    const assigned = new Date(request.assignedDate);
    const ageDays = Number.isNaN(assigned.getTime())
      ? 0
      : Math.floor((Date.now() - assigned.getTime()) / (24 * 60 * 60 * 1000));
    if (ageDays > 7) {
      warnings.push({
        type: "stale_open_request",
        severity: request.priority === "urgent" || request.priority === "high" ? "high" : "medium",
        clientId: request.clientId,
        requestId: request.requestId,
        message: `${request.title} has been open for ${ageDays} days.`,
      });
    }
  }
  return warnings;
}

function buildDailyOperatorView(state, healthWarnings = buildOperationsHealth(state)) {
  const activeClients = state.clients.filter((client) => client.status === "active");
  const priorityRequests = state.maintenanceRequests
    .filter((request) => isOpenRequest(request) && ["urgent", "high"].includes(request.priority))
    .sort((a, b) => String(a.assignedDate).localeCompare(String(b.assignedDate)))
    .slice(0, 8);
  return {
    priorityRequests,
    clientsNeedingOnboarding: activeClients
      .filter((client) => client.onboardingStatus !== "complete")
      .slice(0, 8),
    sitesNeedingAttention: state.sites
      .filter((site) =>
        site.sslStatus !== "active" ||
        !["current", "not_configured"].includes(site.backupStatus) ||
        !["up", "unknown"].includes(site.uptimeStatus) ||
        (!site.domain && !site.deploymentUrl)
      )
      .slice(0, 8),
    billingIssues: activeClients
      .filter((client) =>
        !client.billingStatus ||
        ["not_configured", "checkout_started", "past_due", "canceled"].includes(client.billingStatus) ||
        client.failedPaymentCount > 0 ||
        client.cancellationStatus !== "none"
      )
      .slice(0, 8),
    warnings: healthWarnings.slice(0, 12),
  };
}

function validateClientInput(input = {}) {
  if (!cleanText(input.companyName)) throw new Error("Client companyName is required.");
  if (!cleanText(input.plan)) throw new Error("Client plan is required.");
}

function validateSiteInput(input = {}) {
  if (!cleanText(input.clientId)) throw new Error("Site clientId is required.");
  if (!cleanText(input.domain) && !cleanText(input.deploymentUrl)) {
    throw new Error("Site requires either domain or deploymentUrl.");
  }
}

function validateMaintenanceInput(input = {}) {
  if (!cleanText(input.clientId)) throw new Error("Maintenance request clientId is required.");
  if (!cleanText(input.title)) throw new Error("Maintenance request title is required.");
  if (!MAINTENANCE_PRIORITIES.includes(input.priority)) {
    throw new Error(`Maintenance request priority must be one of: ${MAINTENANCE_PRIORITIES.join(", ")}.`);
  }
  if (!MAINTENANCE_STATUSES.includes(input.status)) {
    throw new Error(`Maintenance request status must be one of: ${MAINTENANCE_STATUSES.join(", ")}.`);
  }
}

function findDuplicateClient(clients, input = {}) {
  const companyName = normalizeComparable(input.companyName);
  const email = normalizeComparable(input.email);
  const phone = normalizePhoneComparable(input.phone);
  return clients.find((client) => {
    if (client.status === "archived") return false;
    if (companyName && normalizeComparable(client.companyName) === companyName) return true;
    if (email && normalizeComparable(client.email) === email) return true;
    if (phone && normalizePhoneComparable(client.phone) === phone) return true;
    return false;
  }) ?? null;
}

export async function getClientOperationsView() {
  const state = await readState();
  const healthWarnings = buildOperationsHealth(state);
  return {
    ...state,
    summary: buildSummary(state),
    healthWarnings,
    dailyOperatorView: buildDailyOperatorView(state, healthWarnings),
  };
}

export async function createClient(input = {}) {
  validateClientInput(input);
  const state = await readState();
  const duplicate = input.sourceLeadId
    ? state.clients.find((client) => client.sourceLeadId === input.sourceLeadId)
    : null;
  if (duplicate) return duplicate;
  const matched = findDuplicateClient(state.clients, input);
  if (matched) {
    throw new Error(`Duplicate client already exists: ${matched.companyName}.`);
  }
  const client = normalizeClient(input);
  state.clients.push(client);
  await writeState(state);
  return client;
}

export async function createClientFromLead(lead, input = {}) {
  const client = await createClient({
    companyName: lead.businessName,
    primaryContact: input.primaryContact || lead.primaryContact || "",
    email: input.email || "",
    phone: input.phone || lead.phone || "",
    plan: input.plan || lead.websitePackageType || lead.serviceType || "maintenance",
    billingStatus: input.billingStatus || "not_configured",
    onboardingStatus: input.onboardingStatus || "not_started",
    supportStatus: input.supportStatus || "normal",
    healthScore: input.healthScore ?? 75,
    sourceLeadId: lead.id,
  });
  return client;
}

export async function createSite(input = {}) {
  validateSiteInput(input);
  const state = await readState();
  if (!state.clients.some((client) => client.clientId === input.clientId && client.status === "active")) {
    throw new Error("Client not found for site.");
  }
  const site = normalizeSite(input);
  state.sites.push(site);
  await writeState(state);
  return site;
}

export async function createMaintenanceRequest(input = {}) {
  validateMaintenanceInput({
    ...input,
    priority: input.priority || "normal",
    status: input.status || "submitted",
  });
  const state = await readState();
  if (!state.clients.some((client) => client.clientId === input.clientId && client.status === "active")) {
    throw new Error("Client not found for maintenance request.");
  }
  const request = normalizeMaintenanceRequest({
    ...input,
    priority: input.priority || "normal",
    status: input.status || "submitted",
  });
  state.maintenanceRequests.push(request);
  await writeState(state);
  return request;
}

export async function patchMaintenanceRequest(requestId, patch = {}) {
  const state = await readState();
  const index = state.maintenanceRequests.findIndex((request) => request.requestId === requestId);
  if (index === -1) throw new Error("Maintenance request not found.");
  const current = state.maintenanceRequests[index];
  const next = normalizeMaintenanceRequest({
    ...current,
    ...patch,
    completedDate:
      patch.status === "completed" && !patch.completedDate
        ? nowIso()
        : patch.completedDate !== undefined
          ? patch.completedDate
          : current.completedDate,
    updatedAt: nowIso(),
  });
  state.maintenanceRequests[index] = next;
  await writeState(state);
  return next;
}

export async function archiveClient(clientId) {
  const state = await readState();
  const index = state.clients.findIndex((client) => client.clientId === clientId);
  if (index === -1) throw new Error("Client not found.");
  const current = state.clients[index];
  const archivedAt = current.archivedAt || nowIso();
  state.clients[index] = normalizeClient({
    ...current,
    status: "archived",
    supportStatus: "paused",
    archivedAt,
    updatedAt: nowIso(),
  });
  await writeState(state);
  return state.clients[index];
}

export async function patchClientBilling(clientId, patch = {}) {
  const state = await readState();
  const index = state.clients.findIndex((client) => client.clientId === clientId);
  if (index === -1) throw new Error("Client not found.");
  state.clients[index] = normalizeClient({
    ...state.clients[index],
    ...patch,
    updatedAt: nowIso(),
  });
  await writeState(state);
  return state.clients[index];
}

export async function setManualClientBillingStatus(clientId, billingStatus) {
  return patchClientBilling(clientId, {
    billingStatus,
    lastPaymentStatus: billingStatus === "active" ? "manual_dev_active" : `manual_dev_${billingStatus}`,
  });
}

export async function markClientCheckoutStarted(clientId, patch = {}) {
  return patchClientBilling(clientId, {
    ...patch,
    billingStatus: "checkout_started",
    lastPaymentStatus: "checkout_started",
  });
}

export async function updateClientBillingFromStripe({ clientId = "", customerId = "", subscriptionId = "", patch = {} } = {}) {
  const state = await readState();
  const index = state.clients.findIndex((client) =>
    (clientId && client.clientId === clientId) ||
    (customerId && client.stripeCustomerId === customerId) ||
    (subscriptionId && client.stripeSubscriptionId === subscriptionId)
  );
  // #region agent log
  fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H5',location:'src/client-operations.js:514',message:'stripe client match result',data:{clientId,hasCustomerId:Boolean(customerId),hasSubscriptionId:Boolean(subscriptionId),matched:index !== -1,clientCount:state.clients.length,patchBillingStatus:patch.billingStatus ?? ""},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (index === -1) return null;
  state.clients[index] = normalizeClient({
    ...state.clients[index],
    ...patch,
    updatedAt: nowIso(),
  });
  await writeState(state);
  return state.clients[index];
}
