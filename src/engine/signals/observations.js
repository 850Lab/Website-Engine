import { mkdir, writeFile, access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const RAW_ROOT = join(ROOT, "engine-data", "signals", "raw");

function nowIso() {
  return new Date().toISOString();
}

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSourceName(source) {
  return collapseWhitespace(source).toLowerCase().replace(/\s+/g, "_");
}

function parseIsoDate(value, fallback) {
  if (!value) return fallback || nowIso();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback || nowIso();
  return parsed.toISOString();
}

export function parseLocationString(locationText) {
  const text = collapseWhitespace(locationText);
  if (!text) {
    return {
      city: null,
      county: null,
      state: null,
      country: "US",
      address: null,
      facilityName: null,
    };
  }

  const parts = text.split(",").map((part) => collapseWhitespace(part));
  if (parts.length >= 2) {
    const state = parts[parts.length - 1].length <= 3 ? parts[parts.length - 1].toUpperCase() : parts[parts.length - 1];
    const city = parts[parts.length - 2];
    return {
      city,
      county: parts.length > 2 ? parts[0] : null,
      state,
      country: "US",
      address: text,
      facilityName: null,
    };
  }

  return {
    city: text,
    county: null,
    state: null,
    country: "US",
    address: text,
    facilityName: null,
  };
}

export function normalizeObservationInput(input = {}) {
  const capturedAt = parseIsoDate(input.capturedAt, nowIso());
  const observedAt = parseIsoDate(input.observedAt, capturedAt);
  const source = normalizeSourceName(input.source || "manual");
  const headline = collapseWhitespace(input.headline);
  const summary = collapseWhitespace(input.summary || input.headline).slice(0, 500);
  const location =
    typeof input.location === "string"
      ? parseLocationString(input.location)
      : {
          city: input.location?.city ?? null,
          county: input.location?.county ?? null,
          state: input.location?.state ?? null,
          country: input.location?.country ?? "US",
          address: input.location?.address ?? null,
          facilityName: input.location?.facilityName ?? null,
        };

  const lat = input.latitude ?? input.geo?.lat ?? null;
  const lng = input.longitude ?? input.geo?.lng ?? null;

  return {
    source,
    sourceType: source === "manual" ? "manual" : input.sourceType || "file_import",
    observedAt,
    capturedAt,
    headline,
    summary,
    url: input.url ? collapseWhitespace(input.url) : null,
    location,
    geo: {
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      region: input.geo?.region ?? null,
      metro: input.geo?.metro ?? null,
      h3: input.geo?.h3 ?? null,
    },
    originalText: input.originalText ?? summary ?? headline,
    signalType: collapseWhitespace(input.signalType || input.type || "unknown").toLowerCase(),
    provenance: {
      ingestVersion: "2.2.0",
      ingestChannel: "manual_cli",
      ...(input.provenance || {}),
    },
  };
}

function rawRelativePath(absolutePath) {
  const normalized = absolutePath.replace(/\\/g, "/");
  const marker = "engine-data/signals/raw/";
  const index = normalized.indexOf(marker);
  if (index >= 0) return normalized.slice(index);
  return normalized;
}

export async function archiveObservation(input = {}) {
  const observationId = `obs_${randomUUID()}`;
  const capturedAt = parseIsoDate(input.capturedAt, nowIso());
  const date = capturedAt.slice(0, 10);
  const [year, month, day] = date.split("-");
  const directory = join(RAW_ROOT, year, month, day);
  await mkdir(directory, { recursive: true });

  const filename = `${observationId}.json`;
  const absolutePath = join(directory, filename);

  try {
    await access(absolutePath);
    throw new Error(`Raw observation file already exists: ${filename}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const record = {
    observationId,
    capturedAt,
    source: normalizeSourceName(input.source || "manual"),
    url: input.url ? collapseWhitespace(input.url) : null,
    geo: {
      lat: input.geo?.lat ?? input.latitude ?? null,
      lng: input.geo?.lng ?? input.longitude ?? null,
    },
    location:
      typeof input.location === "string"
        ? parseLocationString(input.location)
        : input.location || parseLocationString(""),
    metadata: {
      headline: collapseWhitespace(input.headline),
      summary: collapseWhitespace(input.summary || input.headline),
      signalType: collapseWhitespace(input.signalType || input.type || "unknown"),
      ...(input.metadata || {}),
    },
    originalText: String(input.originalText ?? input.summary ?? input.headline ?? ""),
  };

  await writeFile(absolutePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  return {
    observationId,
    filename,
    absolutePath,
    rawTextRef: rawRelativePath(absolutePath),
    record,
  };
}

export { RAW_ROOT };
