import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "data", "qualified-businesses.json");
const FOUNDER_OS = join(ROOT, "data", "founder-os.json");
const OUTPUT = join(ROOT, "data", "outreach-top-50.csv");

async function loadEnv() {
  try {
    const text = await readFile(join(ROOT, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

async function loadRecords() {
  const raw = JSON.parse(await readFile(SOURCE, "utf8"));
  return Array.isArray(raw) ? raw : raw.records || [];
}

async function loadFounderOsStatusMap() {
  try {
    const raw = JSON.parse(await readFile(FOUNDER_OS, "utf8"));
    const map = new Map();
    for (const row of raw.businesses ?? []) {
      if (row.sourceRecordId) map.set(row.sourceRecordId, row.outreachStatus || "new");
    }
    return map;
  } catch {
    return new Map();
  }
}

function hasPhone(record) {
  return Boolean(String(record.phone || record.normalizedPhone || "").trim());
}

function hasWebsite(record) {
  const website = String(record.websiteUrl || "").trim();
  return Boolean(website && website !== "[EXISTS]");
}

function hasPreview(record) {
  return Boolean(String(record.previewUrl || "").trim() || String(record.opportunityProjectId || "").trim());
}

function hasIndustry(record) {
  return Boolean(String(record.industry || record.category || "").trim());
}

function hasCity(record) {
  return Boolean(String(record.city || "").trim());
}

function resolveOutreachStatus(record, founderOsMap) {
  if (record.outreachStatus) return record.outreachStatus;
  const legacy = founderOsMap.get(record.id);
  if (legacy === "contacted") return "contacted";
  return "not_contacted";
}

function resolvePreviewUrl(record, publicBase) {
  if (record.opportunityProjectId) {
    return `${publicBase.replace(/\/$/, "")}/p/${record.opportunityProjectId}`;
  }
  const stored = String(record.previewUrl || "").trim();
  if (!stored) return "";
  if (stored.startsWith("http")) {
    try {
      const url = new URL(stored);
      if (url.pathname.includes("/p/")) {
        return `${publicBase.replace(/\/$/, "")}${url.pathname}`;
      }
    } catch {
      return stored;
    }
  }
  if (stored.startsWith("/p/")) {
    return `${publicBase.replace(/\/$/, "")}${stored}`;
  }
  return stored.startsWith("http") ? stored : `${publicBase.replace(/\/$/, "")}${stored}`;
}

function outreachScore(record) {
  let score = 0;
  if (hasPhone(record)) score += 5;
  if (hasPreview(record)) score += 4;
  if (record.qualificationStatus === "qualified") score += 3;
  if (hasWebsite(record)) score += 1;
  if (hasIndustry(record)) score += 1;
  if (hasCity(record)) score += 1;
  if (Number(record.googleReviewCount) > 0) score += 1;
  return score;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toRow(record, founderOsMap, publicBase) {
  return {
    businessName: record.businessName || "",
    industry: record.industry || record.category || "",
    city: [record.city, record.state].filter(Boolean).join(", "),
    phone: record.phone || record.normalizedPhone || "",
    website: hasWebsite(record) ? record.websiteUrl : "",
    previewUrl: resolvePreviewUrl(record, publicBase),
    outreachStatus: resolveOutreachStatus(record, founderOsMap),
  };
}

async function main() {
  await loadEnv();
  const publicBase = process.env.PUBLIC_BASE_URL?.trim() || "https://www.pivotalwebsites.com";
  const records = await loadRecords();
  const founderOsMap = await loadFounderOsStatusMap();

  const stats = {
    sourceFile: SOURCE,
    total: records.length,
    withPhone: records.filter(hasPhone).length,
    withWebsite: records.filter(hasWebsite).length,
    withPreview: records.filter(hasPreview).length,
    withIndustry: records.filter(hasIndustry).length,
    withCity: records.filter(hasCity).length,
    qualified: records.filter((r) => r.qualificationStatus === "qualified").length,
  };

  const ranked = records
    .filter((record) => hasPhone(record) && hasCity(record) && hasIndustry(record))
    .sort((a, b) => {
      const scoreDiff = outreachScore(b) - outreachScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return String(b.dateFound || "").localeCompare(String(a.dateFound || ""));
    })
    .slice(0, 50)
    .map((record) => toRow(record, founderOsMap, publicBase));

  const headers = [
    "Business Name",
    "Industry",
    "City",
    "Phone",
    "Website",
    "Preview URL",
    "Outreach Status",
  ];

  const csv = [
    headers.join(","),
    ...ranked.map((row) =>
      [
        row.businessName,
        row.industry,
        row.city,
        row.phone,
        row.website,
        row.previewUrl,
        row.outreachStatus,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");

  await writeFile(OUTPUT, `${csv}\n`, "utf8");

  console.log(JSON.stringify({ stats, exported: ranked.length, outputFile: OUTPUT }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
