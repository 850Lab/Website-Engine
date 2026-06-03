const API_BASE = "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === "string" ? body : body?.error || `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return body;
}

export const api = {
  async devServerHealth() {
    const health = await request("/health", { method: "GET" });
    const routeResponse = await fetch(`${API_BASE}/autonomous-field-test`, {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });
    return {
      health,
      autonomousFieldTest: {
        available: routeResponse.status !== 404,
        status: routeResponse.status,
        contentType: routeResponse.headers.get("content-type") ?? "",
      },
    };
  },
  authStatus() {
    return request("/auth/status", { method: "GET" });
  },
  signup(email, password) {
    return request("/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  login(email, password) {
    return request("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  me() {
    return request("/me", { method: "GET" });
  },
  logout() {
    return request("/logout", { method: "POST" });
  },
  leads() {
    return request("/leads", { method: "GET" });
  },
  createLead(lead) {
    return request("/leads", {
      method: "POST",
      body: JSON.stringify(lead),
    });
  },
  demoProjects() {
    return request("/demo-projects", { method: "GET" });
  },
  websites() {
    return request("/websites", { method: "GET" });
  },
  websiteConveyor() {
    return request("/websites/conveyor", { method: "GET" });
  },
  deploymentStatus() {
    return request("/deployment/status", { method: "GET" });
  },
  automationConfig() {
    return request("/automation/config", { method: "GET" });
  },
  updateAutomationConfig(payload) {
    return request("/automation/config", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  automationWorkers() {
    return request("/automation/workers", { method: "GET" });
  },
  automationJobs() {
    return request("/automation/jobs", { method: "GET" });
  },
  createAutomationJob(payload) {
    return request("/automation/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  previewChainPlan(websiteId) {
    return request(`/automation/preview-chain/${websiteId}/plan`, { method: "GET" });
  },
  enqueuePreviewChain(websiteId, payload = {}) {
    return request(`/automation/preview-chain/${websiteId}/enqueue`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  qcDeploymentChainPlan(websiteId) {
    return request(`/automation/qc-deployment-chain/${websiteId}/plan`, { method: "GET" });
  },
  enqueueQcDeploymentChain(websiteId, payload = {}) {
    return request(`/automation/qc-deployment-chain/${websiteId}/enqueue`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  outreachChainPlan(websiteId) {
    return request(`/automation/outreach-chain/${websiteId}/plan`, { method: "GET" });
  },
  enqueueOutreachChain(websiteId, payload = {}) {
    return request(`/automation/outreach-chain/${websiteId}/enqueue`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createPlaceholderReply(websiteId, payload = {}) {
    return request(`/automation/reply-inbox/${websiteId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  replyRevenueChainPlan(websiteId) {
    return request(`/automation/reply-revenue-chain/${websiteId}/plan`, { method: "GET" });
  },
  enqueueReplyRevenueChain(websiteId, payload = {}) {
    return request(`/automation/reply-revenue-chain/${websiteId}/enqueue`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  runAutomationCycle(payload = {}) {
    return request("/automation/run-cycle", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  automationOrchestratorStatus() {
    return request("/automation/orchestrator/status", { method: "GET" });
  },
  orchestrateWebsite(websiteId, payload = {}) {
    return request(`/automation/orchestrator/website/${websiteId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  runAutomationScheduler(payload = {}) {
    return request("/automation/scheduler/run", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  orchestrationLogs() {
    return request("/automation/orchestration/logs", { method: "GET" });
  },
  automationRuns() {
    return request("/automation/runs", { method: "GET" });
  },
  automationLogs() {
    return request("/automation/logs", { method: "GET" });
  },
  website(websiteId) {
    return request(`/websites/${websiteId}`, { method: "GET" });
  },
  websiteTimeline(websiteId) {
    return request(`/websites/${websiteId}/timeline`, { method: "GET" });
  },
  websiteExceptions(websiteId) {
    return request(`/websites/${websiteId}/exceptions`, { method: "GET" });
  },
  websiteAction(websiteId, action, payload = {}) {
    return request(`/websites/${websiteId}/actions/${action}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  exceptions() {
    return request("/exceptions", { method: "GET" });
  },
  exception(exceptionId) {
    return request(`/exceptions/${exceptionId}`, { method: "GET" });
  },
  exceptionAction(exceptionId, action, payload = {}) {
    return request(`/exceptions/${exceptionId}/actions/${action}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  revenue() {
    return request("/revenue", { method: "GET" });
  },
  addLeadToRevenue(id, payload = {}) {
    return request(`/revenue/from-lead/${id}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  leadRevenue(id) {
    return request(`/revenue/lead/${id}`, { method: "GET" });
  },
  logLeadReply(id, payload) {
    return request(`/revenue/lead/${id}/replies`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  logLeadMeeting(id, payload) {
    return request(`/revenue/lead/${id}/meetings`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  patchRevenueStage(revenueId, payload) {
    return request(`/revenue/${revenueId}/stage`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  logRevenueReply(revenueId, payload) {
    return request(`/revenue/${revenueId}/replies`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  logRevenueMeeting(revenueId, payload) {
    return request(`/revenue/${revenueId}/meetings`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  logRevenueProposal(revenueId, payload) {
    return request(`/revenue/${revenueId}/proposals`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  patchRevenueProposal(revenueId, proposalId, payload) {
    return request(`/revenue/${revenueId}/proposals/${proposalId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  attachRevenueCheckoutUrl(revenueId, payload) {
    return request(`/revenue/${revenueId}/checkout-url`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  attachRevenueClient(revenueId, payload) {
    return request(`/revenue/${revenueId}/client`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  markRevenueLost(revenueId, payload) {
    return request(`/revenue/${revenueId}/lost`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  fulfillment() {
    return request("/fulfillment", { method: "GET" });
  },
  createFulfillmentFromClient(clientId, payload = {}) {
    return request(`/fulfillment/from-client/${clientId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  linkFulfillmentSite(fulfillmentId, payload) {
    return request(`/fulfillment/${fulfillmentId}/site`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  patchFulfillmentChecklist(fulfillmentId, key, payload) {
    return request(`/fulfillment/${fulfillmentId}/checklist/${key}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  createFulfillmentMaintenanceRequest(fulfillmentId, payload) {
    return request(`/fulfillment/${fulfillmentId}/maintenance-requests`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  operations() {
    return request("/operations", { method: "GET" });
  },
  createOperationClient(payload) {
    return request("/operations/clients", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  archiveOperationClient(clientId) {
    return request(`/operations/clients/${clientId}/archive`, { method: "POST" });
  },
  createMaintenanceCheckout(clientId) {
    return request(`/operations/clients/${clientId}/billing/checkout`, { method: "POST" });
  },
  patchClientBilling(clientId, billingStatus) {
    return request(`/operations/clients/${clientId}/billing`, {
      method: "PATCH",
      body: JSON.stringify({ billingStatus }),
    });
  },
  convertLeadToClient(id, payload = {}) {
    return request(`/operations/clients/from-lead/${id}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createOperationSite(payload) {
    return request("/operations/sites", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createMaintenanceRequest(payload) {
    return request("/operations/maintenance-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  patchMaintenanceRequest(requestId, patch) {
    return request(`/operations/maintenance-requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  fieldTest() {
    return request("/field-test", { method: "GET" });
  },
  resetFieldTest() {
    return request("/field-test/reset", { method: "POST" });
  },
  autonomousFieldTest() {
    return request("/autonomous-field-test", { method: "GET" });
  },
  startAutonomousFieldTest(payload) {
    return request("/autonomous-field-test/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  runAutonomousFieldTestCycle() {
    return request("/autonomous-field-test/run-cycle", { method: "POST" });
  },
  refreshAutonomousContactRouting(force = false) {
    return request("/autonomous-field-test/contact-routing", {
      method: "POST",
      body: JSON.stringify({ force }),
    });
  },
  fieldTestCreateLead(slotNumber, payload) {
    return request(`/field-test/slots/${slotNumber}/lead`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  fieldTestAttachLead(slotNumber, leadId) {
    return request(`/field-test/slots/${slotNumber}/attach-lead`, {
      method: "POST",
      body: JSON.stringify({ leadId }),
    });
  },
  fieldTestGenerateDemo(slotNumber, payload = {}) {
    return request(`/field-test/slots/${slotNumber}/demo`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  fieldTestPrepareOutreach(slotNumber) {
    return request(`/field-test/slots/${slotNumber}/outreach-prep`, { method: "POST" });
  },
  fieldTestExecuteOutreach(slotNumber, payload) {
    return request(`/field-test/slots/${slotNumber}/outreach-execution`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  fieldTestRecordOutcome(slotNumber, payload) {
    return request(`/field-test/slots/${slotNumber}/outcome`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  importLeadText(text, targetLeadGroupId = "") {
    return request("/leads/import-text", {
      method: "POST",
      body: JSON.stringify({ text, targetLeadGroupId }),
    });
  },
  lead(id) {
    return request(`/leads/${id}`, { method: "GET" });
  },
  patchLead(id, patch) {
    return request(`/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  enrichLead(id) {
    return request(`/leads/${id}/enrich`, { method: "POST" });
  },
  generatePreview(id) {
    return request(`/leads/${id}/generate-preview-v3`, { method: "POST" });
  },
  prepareAssets(id) {
    return request(`/leads/${id}/prepare-assets`, { method: "POST" });
  },
  uploadCustomImage(id, payload) {
    return request(`/leads/${id}/custom-image`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  renderPreview(id) {
    return request(`/leads/${id}/render-preview-v3`, { method: "POST" });
  },
  outreachDraft(id) {
    return request(`/leads/${id}/generate-outreach-draft`, { method: "POST" });
  },
  generateProposal(id, fields = {}) {
    return request(`/leads/${id}/generate-proposal`, {
      method: "POST",
      body: JSON.stringify(fields),
    });
  },
  salesSupport(id) {
    return request(`/leads/${id}/sales-support`, { method: "GET" });
  },
  saveDemoProject(id) {
    return request(`/leads/${id}/save-demo-project`, { method: "POST" });
  },
  appendOutreach(id, entry) {
    return request(`/leads/${id}/append-outreach`, {
      method: "POST",
      body: JSON.stringify(entry),
    });
  },
  approvePreview(id) {
    return request(`/leads/${id}/approve-preview`, { method: "POST" });
  },
  discover(options) {
    return request("/discover", {
      method: "POST",
      body: JSON.stringify(options),
    });
  },
  discoverRun(runId) {
    return request(`/discover/${runId}`, { method: "GET" });
  },
  leadGenerationWorkload(config) {
    return request("/lead-generation/workload", {
      method: "POST",
      body: JSON.stringify(config),
    });
  },
  leadGenerationRuns(limit = 20) {
    return request(`/lead-generation/runs?limit=${encodeURIComponent(limit)}`, { method: "GET" });
  },
  leadGenerationRun(runId) {
    return request(`/lead-generation/runs/${runId}`, { method: "GET" });
  },
  leadGenerationRunModes() {
    return request("/lead-generation/run-modes", { method: "GET" });
  },
  leadRuns(limit = 100) {
    return request(`/lead-runs?limit=${encodeURIComponent(limit)}`, { method: "GET" });
  },
  leadRun(runId) {
    return request(`/lead-runs/${runId}`, { method: "GET" });
  },
  patchLeadRun(runId, patch) {
    return request(`/lead-runs/${runId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  deleteLeadRun(runId) {
    return request(`/lead-runs/${runId}`, { method: "DELETE" });
  },
  archiveLeadRun(runId, archived = true) {
    return request(`/lead-runs/${runId}/archive`, {
      method: "POST",
      body: JSON.stringify({ archived }),
    });
  },
  reconsiderLead(runId, payload) {
    return request(`/lead-runs/${runId}/reconsider-lead`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  moveToQualified(runId, leadId) {
    return request(`/lead-runs/${runId}/move-to-qualified`, {
      method: "POST",
      body: JSON.stringify({ leadId }),
    });
  },
  dashboardSummary() {
    return request("/dashboard-summary", { method: "GET" });
  },
  autopilotStatus() {
    return request("/autopilot/status", { method: "GET" });
  },
  autopilotConfig() {
    return request("/autopilot/config", { method: "GET" });
  },
  patchAutopilotConfig(patch) {
    return request("/autopilot/config", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  runAutopilotNow() {
    return request("/autopilot/run-now", { method: "POST" });
  },
  pauseAutopilot() {
    return request("/autopilot/pause", { method: "POST" });
  },
  resumeAutopilot() {
    return request("/autopilot/resume", { method: "POST" });
  },
  autopilotRuns(limit = 100) {
    return request(`/autopilot/runs?limit=${encodeURIComponent(limit)}`, { method: "GET" });
  },
  opportunities() {
    return request("/opportunities", { method: "GET" });
  },
  adminSystemStatus() {
    return request("/admin/system-status", { method: "GET" });
  },
  recoveryReport() {
    return request("/recovery-report", { method: "GET" });
  },
  retryRecovery(leadId, action) {
    return request(`/recovery/${leadId}/${action}`, { method: "POST" });
  },
  cleanupTestRecords({ dryRun = true, confirm = "" } = {}) {
    return request("/admin/cleanup-test-records", {
      method: "POST",
      body: JSON.stringify({ dryRun, confirm }),
    });
  },
};
