import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { getSensor, registerSensor, runSensor } from "../index.js";

export const WEBSITE_SCAN_BRIDGE_SENSOR_ID = "legacy_website_scan_bridge";
export const WEBSITE_AGENCY_MISSION_ID = "mission_website_agency_local_services";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const QUALIFIED_BUSINESSES_PATH = join(ROOT, "data/qualified-businesses.json");
const WEBSITE_QUALITY_SCORES_PATH = join(ROOT, "data/website-quality-scores.json");
const ANGLE_ANALYSES_PATH = join(ROOT, "data/angle-analyses.json");
const DEFAULT_LIMIT = 25;

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function normalizeScore(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toBusinessMap(qualifiedBusinesses = {}) {
  return new Map(asArray(qualifiedBusinesses.records).map((record) => [record.id, record]));
}

function toAngleMap(angleAnalyses = {}) {
  return isObject(angleAnalyses.analyses) ? angleAnalyses.analyses : {};
}

function isWebsiteOpportunity(row, angle = {}) {
  const status = collapseWhitespace(row.websiteStatus || angle.signal_summary?.websiteStatus).toLowerCase();
  const score = normalizeScore(row.websiteScore ?? angle.signal_summary?.websiteScore);
  const folder = collapseWhitespace(angle.folder).toLowerCase();
  return (
    status === "no_website" ||
    status === "poor_website" ||
    status === "unknown" ||
    (score != null && score < 70) ||
    ["no_website", "weak_conversion", "booking_appointment", "local_landing"].includes(folder)
  );
}

function websiteProblemLabel(row, angle = {}) {
  const status = collapseWhitespace(row.websiteStatus || angle.signal_summary?.websiteStatus).toLowerCase();
  const score = normalizeScore(row.websiteScore ?? angle.signal_summary?.websiteScore);
  if (status === "no_website") return "no owned website";
  if (status === "unknown") return "unverified website presence";
  if (status === "poor_website" || (score != null && score < 70)) return "weak website conversion signals";
  return collapseWhitespace(angle.detected_problem || "website growth opportunity").toLowerCase();
}

function buildLocation(business = {}, angle = {}) {
  return {
    city: collapseWhitespace(business.city || angle.city) || null,
    county: null,
    state: collapseWhitespace(business.state || "TX") || null,
    country: "US",
    address: collapseWhitespace(business.address) || null,
    facilityName: collapseWhitespace(business.businessName || angle.business_name) || null,
  };
}

function buildWebsiteScanObservation(scoreRow, business = {}, angle = {}) {
  const businessId = collapseWhitespace(scoreRow.businessId || business.id || angle.businessId);
  const businessName = collapseWhitespace(scoreRow.businessName || business.businessName || angle.business_name || "Unknown business");
  const websiteUrl = collapseWhitespace(scoreRow.websiteUrl || business.websiteUrl || angle.website_url);
  const score = normalizeScore(scoreRow.websiteScore ?? business.websiteScore ?? angle.signal_summary?.websiteScore);
  const status = collapseWhitespace(scoreRow.websiteStatus || business.websiteStatus || angle.signal_summary?.websiteStatus || "unknown");
  const reasons = asArray(scoreRow.reasons || business.websiteScoreReasons).map(collapseWhitespace).filter(Boolean);
  const detectedProblem = collapseWhitespace(angle.detected_problem || websiteProblemLabel({ ...scoreRow, websiteScore: score, websiteStatus: status }, angle));
  const primaryAngle = collapseWhitespace(angle.primary_angle);
  const observedAt = scoreRow.scoredAt || business.dateScored || angle.analyzedAt || nowIso();
  const problemLabel = websiteProblemLabel({ ...scoreRow, websiteScore: score, websiteStatus: status }, angle);
  const headline = `${businessName} website scan indicates ${problemLabel}`;
  const summaryParts = [
    `Legacy website scan status: ${status}`,
    score == null ? null : `score ${score}`,
    reasons.length ? `reasons: ${reasons.join("; ")}` : null,
    detectedProblem ? `detected problem: ${detectedProblem}` : null,
    primaryAngle ? `angle: ${primaryAngle}` : null,
  ].filter(Boolean);
  const metadata = {
    legacyWebsiteScan: true,
    businessId,
    businessIdentityId: collapseWhitespace(business.businessIdentityId) || null,
    websiteStatus: status,
    websiteScore: score,
    websiteUrl: websiteUrl || null,
    reasons,
    detectedProblem,
    primaryAngle,
    sourceLabel: "Legacy website scan data",
    candidateMissionIds: [WEBSITE_AGENCY_MISSION_ID],
    missionHints: ["website_agency", "website_growth", "legacy_website_scan"],
  };

  return {
    capturedAt: new Date(observedAt).toISOString(),
    source: "legacy_website_scan_bridge",
    originalText: `${headline}. ${summaryParts.join(". ")}.`,
    headline,
    summary: summaryParts.join(". "),
    signalType: "company_news",
    url: websiteUrl || business.googleMapsUrl || angle.google_profile_url || null,
    location: buildLocation(business, angle),
    geo: { lat: null, lng: null },
    metadata: {
      ...metadata,
      contentHash: stableHash(metadata),
    },
  };
}

export async function loadLegacyWebsiteScanDocuments(options = {}) {
  if (options.documents) return options.documents;
  const [qualifiedBusinesses, websiteQualityScores, angleAnalyses] = await Promise.all([
    readJson(options.qualifiedBusinessesPath || QUALIFIED_BUSINESSES_PATH),
    readJson(options.websiteQualityScoresPath || WEBSITE_QUALITY_SCORES_PATH),
    readJson(options.angleAnalysesPath || ANGLE_ANALYSES_PATH),
  ]);
  return { qualifiedBusinesses, websiteQualityScores, angleAnalyses };
}

export async function collectLegacyWebsiteScanObservations(options = {}) {
  const documents = await loadLegacyWebsiteScanDocuments(options);
  const businessById = toBusinessMap(documents.qualifiedBusinesses);
  const anglesById = toAngleMap(documents.angleAnalyses);
  const limit = Number.isInteger(options.limit) ? options.limit : DEFAULT_LIMIT;
  const observations = [];
  const errors = [];

  for (const scoreRow of asArray(documents.websiteQualityScores?.scores)) {
    const businessId = collapseWhitespace(scoreRow.businessId);
    if (!businessId) {
      errors.push("Website score row missing businessId");
      continue;
    }

    const business = businessById.get(businessId) || {};
    const angle = anglesById[businessId] || {};
    if (!isWebsiteOpportunity(scoreRow, angle)) {
      continue;
    }

    try {
      observations.push(buildWebsiteScanObservation(scoreRow, business, angle));
    } catch (error) {
      errors.push(`${businessId}: ${error.message}`);
    }

    if (observations.length >= limit) {
      break;
    }
  }

  return { observations, errors };
}

export const websiteScanBridgeSensor = {
  id: WEBSITE_SCAN_BRIDGE_SENSOR_ID,
  name: "Legacy Website Scan Bridge",
  description: "Maps tracked legacy website scan records into OS observations only.",
  domain: "web",
  sourceTypes: ["connector"],
  capabilities: ["observe_legacy_website_scans"],
  async collect(context = {}) {
    if (context.__websiteScanCache?.observations) {
      return context.__websiteScanCache.observations;
    }
    const collected = await collectLegacyWebsiteScanObservations(context);
    return collected.observations;
  },
  async healthCheck(context = {}) {
    try {
      const collected = context.__websiteScanCache || (await collectLegacyWebsiteScanObservations({ ...context, limit: 1 }));
      if (collected.errors?.length) {
        return { ok: false, message: collected.errors.join("; ") };
      }
      return { ok: true, message: "Legacy website scan data is readable." };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  },
  validate(observation) {
    if (!observation.originalText) throw new Error("Missing originalText");
    if (!observation.headline) throw new Error("Missing headline");
    if (!observation.summary) throw new Error("Missing summary");
    if (!observation.source) throw new Error("Missing source");
    if (!observation.metadata?.legacyWebsiteScan) throw new Error("Missing legacy website scan metadata");
    return true;
  },
  mapToObservation(observation) {
    return {
      source: observation.source,
      sourceType: "connector",
      signalType: observation.signalType,
      headline: observation.headline,
      summary: observation.summary,
      url: observation.url,
      location: observation.location,
      geo: observation.geo,
      observedAt: observation.capturedAt,
      provenance: {
        sensorId: WEBSITE_SCAN_BRIDGE_SENSOR_ID,
        ingestChannel: "legacy_website_scan_bridge",
        legacySource: "data/website-quality-scores.json",
        businessId: observation.metadata?.businessId || null,
        businessIdentityId: observation.metadata?.businessIdentityId || null,
        contentHash: observation.metadata?.contentHash || null,
        candidateMissionIds: asArray(observation.metadata?.candidateMissionIds),
        missionHints: asArray(observation.metadata?.missionHints),
        sourceLabel: observation.metadata?.sourceLabel || "Legacy website scan data",
        websiteStatus: observation.metadata?.websiteStatus || null,
        websiteScore: observation.metadata?.websiteScore ?? null,
      },
    };
  },
};

export function registerWebsiteScanBridgeSensor() {
  if (getSensor(WEBSITE_SCAN_BRIDGE_SENSOR_ID)) {
    return getSensor(WEBSITE_SCAN_BRIDGE_SENSOR_ID);
  }
  return registerSensor(websiteScanBridgeSensor);
}

export async function runWebsiteScanBridgeSensor(options = {}) {
  registerWebsiteScanBridgeSensor();
  const collected = await collectLegacyWebsiteScanObservations(options);
  const result = {
    sensorId: WEBSITE_SCAN_BRIDGE_SENSOR_ID,
    observationsFound: collected.observations.length,
    observationsIngested: 0,
    signalsCreated: [],
    errors: [...collected.errors],
  };

  if (!collected.observations.length || collected.errors.length) {
    return result;
  }

  const runResult = await runSensor(
    WEBSITE_SCAN_BRIDGE_SENSOR_ID,
    {
      ...options,
      __websiteScanCache: collected,
    },
    { publish: true, ...(options.ingestOptions || {}) },
  );
  const ingested = runResult.ingested || [];
  result.observationsIngested = ingested.length;
  result.signalsCreated = ingested.map((row) => row.signal.id);
  return result;
}
