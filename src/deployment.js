import { access, readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, relative, sep } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";

export const WEBSITE_DEPLOYMENTS_FILE = join(DATA_DIR, "website-deployments.json");

const VERCEL_API_BASE = "https://api.vercel.com";
const DEPLOYMENT_STATUSES = ["pending", "ready", "failed"];

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function clamp(value, allowed, fallback) {
  const next = cleanText(value);
  return allowed.includes(next) ? next : fallback;
}

function toIsoOrNow(value) {
  if (!value) return nowIso();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString();
}

function normalizeDeployment(record = {}) {
  const createdAt = toIsoOrNow(record.createdAt);
  return {
    deploymentRecordId: cleanText(record.deploymentRecordId) || `deployment_${randomUUID()}`,
    websiteId: cleanText(record.websiteId),
    leadId: cleanText(record.leadId),
    provider: cleanText(record.provider) || "vercel",
    deploymentId: cleanText(record.deploymentId),
    deployedUrl: cleanText(record.deployedUrl),
    status: clamp(record.status, DEPLOYMENT_STATUSES, "pending"),
    logs: Array.isArray(record.logs) ? record.logs.map(cleanText).filter(Boolean) : [],
    providerResponse: record.providerResponse && typeof record.providerResponse === "object" ? record.providerResponse : {},
    verifiedAt: cleanText(record.verifiedAt),
    createdAt,
    updatedAt: toIsoOrNow(record.updatedAt || createdAt),
  };
}

function normalizeState(input = {}) {
  return {
    version: 1,
    records: Array.isArray(input.records) ? input.records.map(normalizeDeployment) : [],
  };
}

async function readState() {
  try {
    return normalizeState(JSON.parse(await readFile(WEBSITE_DEPLOYMENTS_FILE, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return { version: 1, records: [] };
    throw err;
  }
}

async function writeState(state) {
  const normalized = normalizeState(state);
  await writeJsonFileSafe(WEBSITE_DEPLOYMENTS_FILE, normalized);
  return normalized;
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectStaticFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectStaticFiles(rootDir, absolute));
      continue;
    }
    if (!entry.isFile()) continue;
    const file = relative(rootDir, absolute).split(sep).join("/");
    const data = await readFile(absolute, "base64");
    files.push({ file, data, encoding: "base64" });
  }
  return files;
}

function vercelDeploymentUrl(path = "") {
  const teamId = cleanText(process.env.VERCEL_TEAM_ID);
  const url = new URL(`${VERCEL_API_BASE}${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  return url;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getVercelProviderStatus() {
  const missing = [];
  if (!cleanText(process.env.VERCEL_TOKEN)) missing.push("VERCEL_TOKEN");
  return {
    providerName: "vercel",
    configured: missing.length === 0,
    missing,
    optional: ["VERCEL_TEAM_ID"],
  };
}

function vercelProtectionBypassSecret() {
  return cleanText(process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
}

function publicVerificationHeaders() {
  const bypassSecret = vercelProtectionBypassSecret();
  return bypassSecret
    ? { "x-vercel-protection-bypass": bypassSecret }
    : {};
}

function safeVerificationHeaders(headers) {
  const safeNames = [
    "content-type",
    "location",
    "server",
    "www-authenticate",
    "x-vercel-cache",
    "x-vercel-id",
  ];
  const result = {};
  for (const name of safeNames) {
    const value = headers.get(name);
    if (value) result[name] = value;
  }
  return result;
}

async function verifyPublicDeploymentUrl(deployedUrl, { readyState = "" } = {}) {
  if (!deployedUrl) {
    return {
      ok: false,
      status: 0,
      protected: false,
      verificationMethod: "none",
      finalUrl: "",
      headers: {},
      bypassHeaderUsed: false,
    };
  }
  const bypassHeaderUsed = Boolean(vercelProtectionBypassSecret());
  const response = await fetch(deployedUrl, {
    method: "GET",
    redirect: "follow",
    headers: publicVerificationHeaders(),
  });
  const protectedByVercel = response.status === 401 || response.status === 403;
  return {
    ok: response.ok || (readyState === "READY" && protectedByVercel),
    status: response.status,
    protected: protectedByVercel && !response.ok,
    verificationMethod: response.ok
      ? "public_url"
      : readyState === "READY" && protectedByVercel
        ? "vercel_api_ready_protected_public_url"
        : "public_url_failed",
    finalUrl: response.url || deployedUrl,
    headers: safeVerificationHeaders(response.headers),
    bypassHeaderUsed,
  };
}

function buildDeploymentResult({ deploymentId, deployedUrl, latest, verification }) {
  const ready = latest.readyState === "READY";
  return {
    deploymentId,
    deployedUrl,
    status: ready ? "ready" : "pending",
    logs: [
      `Vercel deployment created: ${deploymentId || "unknown"}`,
      latest.readyState ? `readyState: ${latest.readyState}` : "",
      verification?.verificationMethod ? `verification: ${verification.verificationMethod}` : "",
      verification?.protected ? "public URL is protected; verified by Vercel API readiness." : "",
    ].filter(Boolean),
    providerResponse: {
      readyState: latest.readyState,
      url: latest.url,
      id: deploymentId,
      verification,
    },
    verifiedAt: ready && deployedUrl && verification?.ok ? nowIso() : "",
  };
}

async function deployToVercel(sitePath, metadata = {}) {
  const status = getVercelProviderStatus();
  if (!status.configured) {
    throw new Error(`Vercel deployment is not configured. Missing: ${status.missing.join(", ")}.`);
  }
  if (!await pathExists(sitePath)) {
    throw new Error("Preview artifact folder does not exist.");
  }
  const files = await collectStaticFiles(sitePath);
  if (!files.some((file) => file.file === "index.html")) {
    throw new Error("Preview artifact must include index.html.");
  }
  const name = cleanText(metadata.name) || `website-${cleanText(metadata.websiteId) || randomUUID()}`;
  const response = await fetch(vercelDeploymentUrl("/v13/deployments"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 52) || "website-preview",
      target: "production",
      projectSettings: { framework: null },
      meta: {
        websiteId: cleanText(metadata.websiteId),
        leadId: cleanText(metadata.leadId),
        source: "website-outreach-engine",
      },
      files,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || `Vercel deployment failed with ${response.status}.`);
  }
  let latest = body;
  const deploymentId = cleanText(body.id || body.uid);
  for (let attempt = 0; attempt < 5 && deploymentId && latest.readyState !== "READY"; attempt += 1) {
    await sleep(2000);
    const statusResponse = await fetch(vercelDeploymentUrl(`/v13/deployments/${deploymentId}`), {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    const statusBody = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) break;
    latest = statusBody;
  }
  const deployedUrl = latest.url ? `https://${String(latest.url).replace(/^https?:\/\//, "")}` : "";
  let verification = null;
  if (latest.readyState === "READY" && deployedUrl) {
    verification = await verifyPublicDeploymentUrl(deployedUrl, { readyState: latest.readyState });
    if (!verification.ok) {
      const result = buildDeploymentResult({ deploymentId, deployedUrl, latest, verification });
      const err = new Error(`Deployment URL verification failed with ${verification.status}.`);
      err.deploymentResult = result;
      throw err;
    }
  }
  return buildDeploymentResult({ deploymentId, deployedUrl, latest, verification });
}

async function fetchVercelDeploymentStatus(deploymentId) {
  const status = getVercelProviderStatus();
  if (!status.configured) {
    throw new Error(`Vercel deployment is not configured. Missing: ${status.missing.join(", ")}.`);
  }
  const cleanDeploymentId = cleanText(deploymentId);
  if (!cleanDeploymentId) throw new Error("Deployment ID is required to refresh deployment status.");
  const response = await fetch(vercelDeploymentUrl(`/v13/deployments/${cleanDeploymentId}`), {
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || `Vercel deployment refresh failed with ${response.status}.`);
  }
  const deployedUrl = body.url ? `https://${String(body.url).replace(/^https?:\/\//, "")}` : "";
  let verification = null;
  if (body.readyState === "READY" && deployedUrl) {
    verification = await verifyPublicDeploymentUrl(deployedUrl, { readyState: body.readyState });
    if (!verification.ok) {
      throw new Error(`Deployment URL verification failed with ${verification.status}.`);
    }
  }
  return {
    deploymentId: cleanDeploymentId,
    deployedUrl,
    status: body.readyState === "READY" ? "ready" : body.readyState === "ERROR" ? "failed" : "pending",
    logs: [
      `Vercel deployment refreshed: ${cleanDeploymentId}`,
      body.readyState ? `readyState: ${body.readyState}` : "",
    ].filter(Boolean),
    providerResponse: {
      readyState: body.readyState,
      url: body.url,
      id: cleanDeploymentId,
      verification,
    },
    verifiedAt: body.readyState === "READY" && deployedUrl && verification?.ok ? nowIso() : "",
  };
}

export function getDeploymentProvider() {
  const status = getVercelProviderStatus();
  return {
    providerName: status.providerName,
    configured: status.configured,
    deploy: deployToVercel,
  };
}

export function getDeploymentProviderStatus() {
  const vercel = getVercelProviderStatus();
  return {
    providerName: vercel.providerName,
    configured: vercel.configured,
    missing: vercel.missing,
    optional: vercel.optional,
    required: ["VERCEL_TOKEN"],
  };
}

export async function verifyDeploymentProviderConnection() {
  const status = getDeploymentProviderStatus();
  if (!status.configured) {
    return {
      ...status,
      reachable: false,
      authenticated: false,
      verifiedAt: nowIso(),
      message: `Deployment provider is not configured. Missing: ${status.missing.join(", ")}.`,
    };
  }
  try {
    const response = await fetch(vercelDeploymentUrl("/v2/user"), {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    const body = await response.json().catch(() => ({}));
    return {
      ...status,
      reachable: true,
      authenticated: response.ok,
      statusCode: response.status,
      verifiedAt: nowIso(),
      account: response.ok
        ? {
          id: cleanText(body.user?.id || body.id),
          username: cleanText(body.user?.username || body.username),
          email: cleanText(body.user?.email || body.email),
        }
        : null,
      message: response.ok
        ? "Vercel API authentication verified."
        : body?.error?.message || body?.message || `Vercel authentication failed with ${response.status}.`,
    };
  } catch (err) {
    return {
      ...status,
      reachable: false,
      authenticated: false,
      verifiedAt: nowIso(),
      message: err.message,
    };
  }
}

export async function listDeploymentRecords() {
  return (await readState()).records;
}

export async function latestDeploymentForWebsite(websiteId) {
  const records = await listDeploymentRecords();
  return records
    .filter((record) => record.websiteId === websiteId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] ?? null;
}

export async function createDeploymentRecord(input = {}) {
  const state = await readState();
  const record = normalizeDeployment(input);
  state.records.push(record);
  await writeState(state);
  return record;
}

export async function updateDeploymentRecord(deploymentRecordId, patch = {}) {
  const state = await readState();
  const index = state.records.findIndex((record) => record.deploymentRecordId === deploymentRecordId);
  if (index === -1) throw new Error(`Deployment record not found: ${deploymentRecordId}`);
  state.records[index] = normalizeDeployment({
    ...state.records[index],
    ...patch,
    updatedAt: nowIso(),
  });
  await writeState(state);
  return state.records[index];
}

export async function refreshDeploymentRecord(deploymentRecordId) {
  const records = await listDeploymentRecords();
  const record = records.find((item) => item.deploymentRecordId === deploymentRecordId);
  if (!record) throw new Error(`Deployment record not found: ${deploymentRecordId}`);
  if (record.status !== "pending") throw new Error("Only pending deployment records can be refreshed.");
  if (!record.deploymentId) throw new Error("Pending deployment record has no provider deployment ID.");
  const result = await fetchVercelDeploymentStatus(record.deploymentId);
  return updateDeploymentRecord(deploymentRecordId, {
    deploymentId: result.deploymentId,
    deployedUrl: result.deployedUrl,
    status: result.status,
    logs: [...(record.logs ?? []), ...result.logs].slice(-20),
    providerResponse: result.providerResponse,
    verifiedAt: result.verifiedAt || record.verifiedAt,
  });
}

export async function deployStaticPreview({ websiteId, leadId, sitePath, metadata = {} } = {}) {
  const provider = getDeploymentProviderStatus();
  const startedAt = nowIso();
  const pendingRecord = await createDeploymentRecord({
    websiteId,
    leadId,
    provider: provider.providerName,
    status: "pending",
    logs: ["Deployment started."],
    createdAt: startedAt,
    updatedAt: startedAt,
  });
  try {
    const result = await deployToVercel(sitePath, {
      ...metadata,
      websiteId,
      leadId,
    });
    return updateDeploymentRecord(pendingRecord.deploymentRecordId, {
      deploymentId: result.deploymentId,
      deployedUrl: result.deployedUrl,
      status: result.status,
      logs: result.logs,
      providerResponse: result.providerResponse,
      verifiedAt: result.verifiedAt,
    });
  } catch (err) {
    if (err.deploymentResult) {
      await updateDeploymentRecord(pendingRecord.deploymentRecordId, {
        deploymentId: err.deploymentResult.deploymentId,
        deployedUrl: err.deploymentResult.deployedUrl,
        status: "failed",
        logs: [...err.deploymentResult.logs, err.message],
        providerResponse: err.deploymentResult.providerResponse,
        verifiedAt: err.deploymentResult.verifiedAt,
      });
      throw err;
    }
    await updateDeploymentRecord(pendingRecord.deploymentRecordId, {
      status: "failed",
      logs: [err.message],
    });
    throw err;
  }
}
