import { access, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";
import { getDeploymentProviderStatus } from "./deployment.js";

export const WEBSITE_QC_FILE = join(DATA_DIR, "website-qc.json");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PREVIEWS_ROOT = join(ROOT, "previews-v3");
const RENDERS_ROOT = join(ROOT, "renders");

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeCheck(check = {}) {
  return {
    checkId: cleanText(check.checkId) || `qc_check_${randomUUID()}`,
    name: cleanText(check.name) || "Unknown check",
    status: check.status === "pass" ? "pass" : "fail",
    severity: check.severity === "warning" ? "warning" : "blocking",
    message: cleanText(check.message),
    evidence: cleanText(check.evidence),
  };
}

function normalizeRecord(record = {}) {
  const checks = Array.isArray(record.checks) ? record.checks.map(normalizeCheck) : [];
  const passed = checks.every((check) => check.status === "pass" || check.severity === "warning");
  const createdAt = cleanText(record.createdAt) || nowIso();
  return {
    qcId: cleanText(record.qcId) || `qc_${randomUUID()}`,
    websiteId: cleanText(record.websiteId),
    leadId: cleanText(record.leadId),
    status: cleanText(record.status) || (passed ? "passed" : "failed"),
    passed: Boolean(record.passed ?? passed),
    checks,
    createdAt,
    updatedAt: cleanText(record.updatedAt) || createdAt,
  };
}

function normalizeState(input = {}) {
  return {
    version: 1,
    records: Array.isArray(input.records) ? input.records.map(normalizeRecord).filter((record) => record.websiteId) : [],
  };
}

async function readState() {
  try {
    return normalizeState(JSON.parse(await readFile(WEBSITE_QC_FILE, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return { version: 1, records: [] };
    throw err;
  }
}

async function writeState(state) {
  const normalized = normalizeState(state);
  await writeJsonFileSafe(WEBSITE_QC_FILE, normalized);
  return normalized;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function pass(name, evidence = "") {
  return normalizeCheck({ name, status: "pass", message: `${name} passed.`, evidence });
}

function fail(name, message, evidence = "", severity = "blocking") {
  return normalizeCheck({ name, status: "fail", message, evidence, severity });
}

function textIncludesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function internalLinks(html) {
  return [...String(html).matchAll(/href=["']#([^"']*)["']/gi)]
    .map((match) => cleanText(match[1]))
    .filter(Boolean);
}

async function playwrightMobileLoad(indexPath) {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 1200 } });
      const errors = [];
      page.on("pageerror", (err) => errors.push(err.message));
      await page.goto(pathToFileURL(indexPath).href, { waitUntil: "load", timeout: 30_000 });
      return { ok: errors.length === 0, errors };
    } finally {
      await browser.close();
    }
  } catch (err) {
    return { ok: false, errors: [err.message] };
  }
}

export async function listWebsiteQcRecords() {
  return (await readState()).records;
}

export async function latestWebsiteQcRecord(websiteId) {
  return (await listWebsiteQcRecords())
    .filter((record) => record.websiteId === websiteId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] ?? null;
}

export async function runWebsiteQc(website) {
  const checks = [];
  const previewDirBase = website?.preview?.previewDirBase;
  const previewDir = previewDirBase ? join(PREVIEWS_ROOT, previewDirBase) : "";
  const renderDir = previewDirBase ? join(RENDERS_ROOT, previewDirBase) : "";
  const indexPath = previewDir ? join(previewDir, "index.html") : "";
  const stylesPath = previewDir ? join(previewDir, "styles.css") : "";
  const manifestPath = previewDir ? join(previewDir, "assets", "asset-manifest.json") : "";
  const desktopPath = renderDir ? join(renderDir, "desktop.png") : "";
  const mobilePath = renderDir ? join(renderDir, "mobile.png") : "";

  if (!previewDirBase) {
    checks.push(fail("Preview directory", "Website has no preview directory metadata."));
  } else {
    checks.push(pass("Preview directory", previewDirBase));
  }

  const indexExists = indexPath && await exists(indexPath);
  const stylesExists = stylesPath && await exists(stylesPath);
  const manifestExists = manifestPath && await exists(manifestPath);
  const desktopExists = desktopPath && await exists(desktopPath);
  const mobileExists = mobilePath && await exists(mobilePath);

  checks.push(indexExists ? pass("Preview exists", indexPath) : fail("Preview exists", "Generated preview index.html is missing.", indexPath));
  checks.push(stylesExists ? pass("Required styles file", stylesPath) : fail("Required styles file", "Generated preview styles.css is missing.", stylesPath));
  checks.push(manifestExists ? pass("Asset manifest", manifestPath) : fail("Asset manifest", "Asset manifest is missing.", manifestPath, "warning"));
  checks.push(desktopExists ? pass("Desktop screenshot", desktopPath) : fail("Desktop screenshot", "Desktop render screenshot is missing.", desktopPath));
  checks.push(mobileExists ? pass("Mobile screenshot", mobilePath) : fail("Mobile screenshot", "Mobile render screenshot is missing.", mobilePath));

  let html = "";
  if (indexExists) html = await readFile(indexPath, "utf8");
  const lower = html.toLowerCase();

  const sectionRules = [
    ["Hero section", [/class=["'][^"']*hero/i, /<header/i]],
    ["Services section", [/service/i]],
    ["Trust/proof section", [/review/i, /testimonial/i, /trusted/i, /licensed/i, /insured/i]],
    ["CTA/contact section", [/contact/i, /quote/i, /estimate/i, /tel:/i]],
    ["Footer section", [/<footer/i]],
  ];
  for (const [name, patterns] of sectionRules) {
    checks.push(textIncludesAny(html, patterns) ? pass(name) : fail(name, `${name} was not found in preview HTML.`));
  }

  const phoneDigits = cleanText(website?.lead?.phone).replace(/\D/g, "");
  const hasContact = /href=["']tel:/i.test(html) || /contact|quote|estimate/i.test(html) || (phoneDigits.length >= 7 && html.replace(/\D/g, "").includes(phoneDigits.slice(-7)));
  checks.push(hasContact ? pass("Contact info") : fail("Contact info", "No visible contact CTA, tel link, or known phone evidence found."));

  const placeholderPatterns = [/lorem ipsum/i, /\btodo\b/i, /your business/i, /\{\{[^}]+\}\}/, /\[placeholder\]/i];
  checks.push(textIncludesAny(html, placeholderPatterns) ? fail("No placeholder text", "Placeholder or unresolved template text found.") : pass("No placeholder text"));

  const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]));
  const broken = internalLinks(html).filter((target) => target !== "top" && !ids.has(target));
  checks.push(broken.length ? fail("Internal links", `Broken internal anchors: ${broken.join(", ")}`) : pass("Internal links"));

  checks.push(/<meta[^>]+name=["']viewport["'][^>]*>/i.test(html) ? pass("Responsive viewport") : fail("Responsive viewport", "Missing viewport meta tag."));
  if (indexExists) {
    const mobile = await playwrightMobileLoad(indexPath);
    checks.push(mobile.ok ? pass("Mobile load check") : fail("Mobile load check", "Preview failed mobile browser load.", mobile.errors.join(" | ")));
  }

  checks.push(/<title[^>]*>[^<]{4,}<\/title>/i.test(html) ? pass("SEO title") : fail("SEO title", "Missing or empty title tag."));
  checks.push(/<meta[^>]+name=["']description["'][^>]*content=["'][^"']{20,}["']/i.test(html) ? pass("SEO meta description") : fail("SEO meta description", "Missing useful meta description.", "", "warning"));

  const deployment = getDeploymentProviderStatus();
  checks.push(deployment.configured ? pass("Deployment readiness", deployment.providerName) : fail("Deployment readiness", `Deployment provider missing: ${(deployment.missing ?? []).join(", ")}`));

  const blockingFailures = checks.filter((check) => check.status === "fail" && check.severity === "blocking");
  const record = normalizeRecord({
    websiteId: website.websiteId,
    leadId: website.mapping?.leadId,
    status: blockingFailures.length ? "failed" : "passed",
    passed: blockingFailures.length === 0,
    checks,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  const state = await readState();
  state.records.push(record);
  await writeState(state);
  return record;
}
