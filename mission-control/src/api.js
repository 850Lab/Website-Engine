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
  adminSystemStatus() {
    return request("/admin/system-status", { method: "GET" });
  },
  stage1Summary() {
    return request("/stage1/summary", { method: "GET" });
  },
  stage1Businesses(query = "") {
    const suffix = query ? `?${query}` : "";
    return request(`/stage1/businesses${suffix}`, { method: "GET" });
  },
  stage1Business(id) {
    return request(`/stage1/businesses/${encodeURIComponent(id)}`, { method: "GET" });
  },
  stage1CreateBusinessProject(id) {
    return request(`/stage1/businesses/${encodeURIComponent(id)}/project`, { method: "POST" });
  },
  stage1GenerateProjects(input) {
    return request("/stage1/projects/generate", {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    });
  },
  stage1GenerateFounderTestQueue() {
    return request("/stage1/projects/generate-founder-test-queue", { method: "POST" });
  },
  stage1FounderTestQueue(status = "") {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
    return request(`/stage1/founder-test-queue${suffix}`, { method: "GET" });
  },
  stage1VerifyPreview(businessId) {
    return request(`/stage1/projects/${encodeURIComponent(businessId)}/verify-preview`, {
      method: "POST",
    });
  },
  stage1MarkReady(id) {
    return request(`/stage1/businesses/${encodeURIComponent(id)}/mark-ready`, {
      method: "POST",
    });
  },
  stage1Discover(input) {
    return request("/stage1/discover", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  stage1DiscoverRun(runId) {
    return request(`/stage1/discover/${encodeURIComponent(runId)}`, { method: "GET" });
  },
  v7Projects() {
    return request("/v7/projects", { method: "GET" });
  },
  v7Project(id) {
    return request(`/v7/projects/${encodeURIComponent(id)}`, { method: "GET" });
  },
  createV7Project(input) {
    return request("/v7/projects", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  founderTesting() {
    return request("/v7/founder-testing", { method: "GET" });
  },
  saveFounderNotes(projectId, notes) {
    return request(`/v7/founder-testing/${encodeURIComponent(projectId)}/notes`, {
      method: "PUT",
      body: JSON.stringify(notes),
    });
  },
  founderWalk(projectId) {
    return request(`/v7/founder-testing/${encodeURIComponent(projectId)}/walk`, { method: "GET" });
  },
  founderWalkSimulatePurchase(projectId) {
    return request(`/v7/founder-testing/${encodeURIComponent(projectId)}/walk/simulate-purchase`, {
      method: "POST",
    });
  },
  founderWalkActivate(projectId) {
    return request(`/v7/founder-testing/${encodeURIComponent(projectId)}/walk/activate`, {
      method: "POST",
    });
  },
  opportunityEngineConfig() {
    return request("/opportunity-engine/config", { method: "GET" });
  },
  opportunityDashboard() {
    return request("/opportunity-engine/dashboard", { method: "GET" });
  },
  startDiscoveryCampaign(input) {
    return request("/opportunity-engine/campaigns", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  discoveryCampaign(campaignId) {
    return request(`/opportunity-engine/campaigns/${encodeURIComponent(campaignId)}`, {
      method: "GET",
    });
  },
  resumeDiscoveryCampaign(campaignId) {
    const path = campaignId
      ? `/opportunity-engine/campaigns/${encodeURIComponent(campaignId)}/resume`
      : "/opportunity-engine/campaigns/resume";
    return request(path, { method: "POST" });
  },
  opportunityIntelligence() {
    return request("/opportunity-engine/intelligence", { method: "GET" });
  },
  southeastTexasReport() {
    return request("/opportunity-engine/reports/southeast-texas", { method: "GET" });
  },
  contactAuditReport() {
    return request("/opportunity-engine/reports/contact-audit", { method: "GET" });
  },
  coverageReport() {
    return request("/opportunity-engine/reports/coverage", { method: "GET" });
  },
  dataQualityReport() {
    return request("/opportunity-engine/reports/data-quality", { method: "GET" });
  },
  discoveryAdapters() {
    return request("/opportunity-engine/adapters", { method: "GET" });
  },
  identityStatus() {
    return request("/opportunity-engine/identity/status", { method: "GET" });
  },
  founderOsDashboard() {
    return request("/founder-os/dashboard", { method: "GET" });
  },
  founderOsBusinesses(query = "") {
    const suffix = query ? `?${query}` : "";
    return request(`/founder-os/businesses${suffix}`, { method: "GET" });
  },
  founderOsBusiness(id) {
    return request(`/founder-os/businesses/${encodeURIComponent(id)}`, { method: "GET" });
  },
  founderOsUpdateBusiness(id, patch) {
    return request(`/founder-os/businesses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch ?? {}),
    });
  },
  founderOsAddTimeline(id, input) {
    return request(`/founder-os/businesses/${encodeURIComponent(id)}/timeline`, {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    });
  },
  founderOsAddAsset(id, input) {
    return request(`/founder-os/businesses/${encodeURIComponent(id)}/assets`, {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    });
  },
  founderOsTimeline(limit = 200) {
    return request(`/founder-os/timeline?limit=${encodeURIComponent(limit)}`, { method: "GET" });
  },
  founderOsPowerHour(limit = 30) {
    return request(`/founder-os/power-hour?limit=${encodeURIComponent(limit)}`, { method: "GET" });
  },
};
