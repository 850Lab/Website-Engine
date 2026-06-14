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
export const MAINTENANCE_REQUEST_TYPES = [
  "text_update",
  "image_update",
  "service_update",
  "hours_update",
  "bug_fix",
  "new_section",
  "other",
];

export const MAINTENANCE_SLA_TARGETS = {
  urgent: { hours: 24, label: "24 hours" },
  high: { hours: 48, label: "48 hours" },
  normal: { businessDays: 5, label: "5 business days" },
  low: { businessDays: 10, label: "10 business days" },
};

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

function addBusinessDays(start, businessDays) {
  const date = new Date(start);
  let remaining = Math.max(0, Number(businessDays) || 0);
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date;
}

function calculateMaintenanceDueDate(priority, start = new Date()) {
  const rule = MAINTENANCE_SLA_TARGETS[priority] ?? MAINTENANCE_SLA_TARGETS.normal;
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return null;
  if (rule.hours) return new Date(startDate.getTime() + rule.hours * 60 * 60 * 1000).toISOString();
  return addBusinessDays(startDate, rule.businessDays).toISOString();
}

function maintenanceSlaRisk(request = {}, now = Date.now()) {
  if (!isOpenRequest(request)) return "on_track";
  const due = new Date(request.dueDate);
  if (Number.isNaN(due.getTime())) return "on_track";
  if (due.getTime() < now) return "overdue";
  const assigned = new Date(request.assignedDate || request.createdAt);
  const startTime = Number.isNaN(assigned.getTime()) ? now : assigned.getTime();
  const totalWindow = due.getTime() - startTime;
  const remaining = due.getTime() - now;
  if (remaining <= 24 * 60 * 60 * 1000) return "at_risk";
  if (totalWindow > 0 && (now - startTime) / totalWindow >= 0.75) return "at_risk";
  return "on_track";
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
  const priority = clamp(request.priority, MAINTENANCE_PRIORITIES, "normal");
  const assignedDate = toIsoOrNull(request.assignedDate) || now;
  const dueDate = toIsoOrNull(request.dueDate) || calculateMaintenanceDueDate(priority, assignedDate);
  const status = clamp(request.status, MAINTENANCE_STATUSES, "submitted");
  return {
    requestId: cleanText(request.requestId) || `request_${randomUUID()}`,
    clientId: cleanText(request.clientId),
    siteId: cleanText(request.siteId),
    fulfillmentId: cleanText(request.fulfillmentId),
    title: cleanText(request.title),
    description: cleanText(request.description),
    priority,
    requestedBy: cleanText(request.requestedBy),
    requestType: clamp(request.requestType, MAINTENANCE_REQUEST_TYPES, "other"),
    dueDate,
    status,
    slaTarget: MAINTENANCE_SLA_TARGETS[priority]?.label ?? MAINTENANCE_SLA_TARGETS.normal.label,
    slaRisk: maintenanceSlaRisk({ ...request, priority, assignedDate, dueDate, status }),
    overdue: maintenanceSlaRisk({ ...request, priority, assignedDate, dueDate, status }) === "overdue",
    assignedDate,
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
  return maintenanceSlaRisk(request) === "overdue";
}

function isDueSoonRequest(request) {
  if (!isOpenRequest(request)) return false;
  const due = new Date(request.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const msUntilDue = due.getTime() - Date.now();
  return msUntilDue >= 0 && msUntilDue <= 48 * 60 * 60 * 1000;
}

function isCompletedThisWeek(request) {
  if (request.status !== "completed" || !request.completedDate) return false;
  const completed = new Date(request.completedDate);
  if (Number.isNaN(completed.getTime())) return false;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return completed.getTime() >= start.getTime();
}

function buildMaintenanceSlaQueues(state) {
  const requests = state.maintenanceRequests.map(normalizeMaintenanceRequest);
  const openRequests = requests.filter(isOpenRequest);
  const byDueDate = (a, b) => String(a.dueDate).localeCompare(String(b.dueDate));
  return {
    urgentRequests: openRequests
      .filter((request) => request.priority === "urgent")
      .sort(byDueDate),
    overdueRequests: openRequests
      .filter(isOverdueRequest)
      .sort(byDueDate),
    requestsDueSoon: openRequests
      .filter(isDueSoonRequest)
      .sort(byDueDate),
    requestsWaitingOnClient: openRequests
      .filter((request) => request.status === "waiting_client")
      .sort(byDueDate),
    completedThisWeek: requests
      .filter(isCompletedThisWeek)
      .sort((a, b) => String(b.completedDate).localeCompare(String(a.completedDate))),
  };
}

function calculateClientHealthScore(client, { sitesByClient = new Map(), requestsByClient = new Map(), fulfillmentByClient = new Map() } = {}) {
  let score = healthScore(client.healthScore);
  const openRequests = (requestsByClient.get(client.clientId) ?? []).filter(isOpenRequest);
  const overdueRequests = openRequests.filter(isOverdueRequest);
  const fulfillment = fulfillmentByClient.get(client.clientId);
  if (overdueRequests.length) score -= Math.min(30, overdueRequests.length * 15);
  if (fulfillment?.status === "blocked") score -= 20;
  if (["past_due", "canceled", "not_configured"].includes(client.billingStatus) || client.failedPaymentCount > 0) score -= 20;
  if (!(sitesByClient.get(client.clientId) ?? []).length) score -= 15;
  return healthScore(score);
}

function buildClientHealthContext(state, fulfillmentRecords = []) {
  const sitesByClient = new Map();
  const requestsByClient = new Map();
  const fulfillmentByClient = new Map();
  for (const site of state.sites) {
    sitesByClient.set(site.clientId, [...(sitesByClient.get(site.clientId) ?? []), site]);
  }
  for (const request of state.maintenanceRequests) {
    requestsByClient.set(request.clientId, [...(requestsByClient.get(request.clientId) ?? []), request]);
  }
  for (const record of fulfillmentRecords) {
    if (record.clientId && !fulfillmentByClient.has(record.clientId)) fulfillmentByClient.set(record.clientId, record);
  }
  return { sitesByClient, requestsByClient, fulfillmentByClient };
}

function buildEnrichedClients(state, fulfillmentRecords = []) {
  const context = buildClientHealthContext(state, fulfillmentRecords);
  return state.clients.map((client) => ({
    ...client,
    healthScore: calculateClientHealthScore(client, context),
  }));
}

function buildSummary(state, fulfillmentRecords = []) {
  const clients = buildEnrichedClients(state, fulfillmentRecords);
  const activeClients = clients.filter((client) => client.status === "active" && client.billingStatus !== "canceled");
  const openRequests = state.maintenanceRequests.filter(isOpenRequest);
  const overdueRequests = openRequests.filter(isOverdueRequest);
  const slaQueues = buildMaintenanceSlaQueues(state);
  const healthBuckets = {
    healthy: activeClients.filter((client) => client.healthScore >= 75).length,
    watch: activeClients.filter((client) => client.healthScore >= 50 && client.healthScore < 75).length,
    atRisk: activeClients.filter((client) => client.healthScore < 50).length,
  };
  return {
    activeClients: activeClients.length,
    archivedClients: clients.filter((client) => client.status === "archived").length,
    sites: state.sites.length,
    openRequests: openRequests.length,
    overdueRequests: overdueRequests.length,
    urgentRequests: slaQueues.urgentRequests.length,
    requestsDueSoon: slaQueues.requestsDueSoon.length,
    requestsWaitingOnClient: slaQueues.requestsWaitingOnClient.length,
    completedThisWeek: slaQueues.completedThisWeek.length,
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

function buildOperationsHealth(state, fulfillmentRecords = []) {
  const activeClients = buildEnrichedClients(state, fulfillmentRecords).filter((client) => client.status === "active");
  const sitesByClient = new Map();
  for (const site of state.sites) {
    sitesByClient.set(site.clientId, [...(sitesByClient.get(site.clientId) ?? []), site]);
  }
  const fulfillmentByClient = new Map(fulfillmentRecords.map((record) => [record.clientId, record]));
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
    if (fulfillmentByClient.get(client.clientId)?.status === "blocked") {
      warnings.push({
        type: "blocked_fulfillment",
        severity: "high",
        clientId: client.clientId,
        message: `${client.companyName} has blocked fulfillment work.`,
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
    if (isOverdueRequest(request)) {
      warnings.push({
        type: "overdue_maintenance_request",
        severity: request.priority === "urgent" || request.priority === "high" ? "high" : "medium",
        clientId: request.clientId,
        requestId: request.requestId,
        message: `${request.title} is overdue against SLA.`,
      });
    }
  }
  return warnings;
}

function buildDailyOperatorView(state, healthWarnings = buildOperationsHealth(state)) {
  const activeClients = state.clients.filter((client) => client.status === "active");
  const slaQueues = buildMaintenanceSlaQueues(state);
  const priorityRequests = [
    ...slaQueues.urgentRequests,
    ...state.maintenanceRequests.filter((request) => isOpenRequest(request) && request.priority === "high"),
  ].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 8);
  return {
    priorityRequests,
    maintenanceSlaQueues: {
      urgentRequests: slaQueues.urgentRequests.slice(0, 12),
      overdueRequests: slaQueues.overdueRequests.slice(0, 12),
      requestsDueSoon: slaQueues.requestsDueSoon.slice(0, 12),
      requestsWaitingOnClient: slaQueues.requestsWaitingOnClient.slice(0, 12),
      completedThisWeek: slaQueues.completedThisWeek.slice(0, 12),
    },
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
  if (input.requestType && !MAINTENANCE_REQUEST_TYPES.includes(input.requestType)) {
    throw new Error(`Maintenance request type must be one of: ${MAINTENANCE_REQUEST_TYPES.join(", ")}.`);
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

export async function getClientOperationsView({ fulfillmentRecords = [] } = {}) {
  const state = await readState();
  const healthWarnings = buildOperationsHealth(state, fulfillmentRecords);
  return {
    ...state,
    clients: buildEnrichedClients(state, fulfillmentRecords),
    maintenanceSlaQueues: buildMaintenanceSlaQueues(state),
    summary: buildSummary(state, fulfillmentRecords),
    healthWarnings,
    dailyOperatorView: buildDailyOperatorView(state, healthWarnings),
    maintenanceRequestTypes: MAINTENANCE_REQUEST_TYPES,
    maintenanceSlaTargets: MAINTENANCE_SLA_TARGETS,
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
