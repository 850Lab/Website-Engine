import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { listLeads, addLead } from "./leads.js";
import { writeJsonFileSafe } from "./storage.js";
import { enrichLead, hasRealWebsiteUrl } from "./enrich.js";
import {
  normalizeBusinessName,
  scrapeGoogleMaps,
  toLeadFields,
} from "./discover.js";
import { scoreLead, statusFromScore } from "./scoring.js";
import { generateOutreachAngle } from "./outreach.js";
import { generatePreviewSiteV3 } from "./preview-v3.js";
import { prepareAssetsForLead } from "./assets/asset-pipeline.js";
import { renderPreviewV3Screenshots } from "./render-preview-v3.js";
import { updateLeadMissionControl } from "./mission-control.js";
import { upsertLeadRun } from "./lead-runs.js";
import { analyzeChainSignals } from "./lead-intelligence.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const RUNS_FILE = join(DATA_DIR, "lead-generation-runs.json");

export const RUN_MODES = [
  "research_only",
  "research_score",
  "research_score_enrich",
  "full_preview_package",
];

export const RUN_MODE_DETAILS = {
  research_only:
    "Discover candidates only. No enrichment and no lead import.",
  research_score:
    "Discover + score from base fields, then qualify/reject and save qualified leads.",
  research_score_enrich:
    "Discover + enrich + score, then qualify/reject and save qualified leads.",
  full_preview_package:
    "Discover + enrich + score + qualify/reject + optional preview generation for qualified leads.",
};

const WEBSITE_STATUSES = [
  "any",
  "missing_only",
  "weak_only",
  "weak_or_missing",
  "exclude_strong",
];

function bool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function toIso(value) {
  const d = new Date(value ?? Date.now());
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function normalizeArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => cleanText(item).toLowerCase())
    .filter(Boolean);
}

function buildRunId() {
  return `run_${Date.now()}_${randomBytes(4).toString("hex")}`;
}

function scoreCandidateLead(fields) {
  const source = {
    ...fields,
    socialEvidence: Boolean(fields.socialEvidence),
    strongProof: Boolean(fields.strongProof),
    weakWebsite: Boolean(fields.weakWebsite),
  };
  const scored = scoreLead(source);
  const score = Number(scored.score) || 0;
  const computedStatus = statusFromScore(score);
  const angle = generateOutreachAngle(source);
  const chain = analyzeChainSignals(fields);
  return {
    id: fields.id ?? `virtual-${randomBytes(5).toString("hex")}`,
    businessName: fields.businessName,
    category: fields.category,
    city: fields.city,
    phone: fields.phone ?? "",
    websiteUrl: fields.websiteUrl ?? "",
    googleReviewCount: Number(fields.googleReviewCount) || 0,
    googleRating: Number(fields.googleRating) || 0,
    notes: fields.notes ?? "",
    weakWebsite: Boolean(fields.weakWebsite),
    serviceBusiness: scored.serviceBusiness,
    socialEvidence: Boolean(fields.socialEvidence),
    strongProof: Boolean(fields.strongProof),
    websiteQuality: fields.websiteQuality ?? "unknown",
    score,
    scoreBreakdown: scored.breakdown,
    computedStatus,
    status: fields.manualStatus ?? computedStatus,
    outreachAngle: angle.label,
    outreachKey: angle.key,
    outreachPitch: angle.pitch,
    createdAt: fields.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...chain,
  };
}

function ensureOpportunitySignals(signals) {
  const s = signals ?? {};
  return {
    missingCTA: bool(s.missingCTA),
    noBookingForm: bool(s.noBookingForm),
    noMobileFriendlySignal: bool(s.noMobileFriendlySignal),
    lowTrustSignals: bool(s.lowTrustSignals),
    weakHomepageCopy: bool(s.weakHomepageCopy),
    noBeforeAfterGallery: bool(s.noBeforeAfterGallery),
    noServiceAreaPage: bool(s.noServiceAreaPage),
    noReviewsTestimonialsShown: bool(s.noReviewsTestimonialsShown),
    noGoogleBusinessProfileWebsiteLink: bool(s.noGoogleBusinessProfileWebsiteLink),
  };
}

function ensureOutreachReadiness(readiness) {
  const r = readiness ?? {};
  return {
    hasPhone: bool(r.hasPhone),
    hasEmail: bool(r.hasEmail),
    hasFacebookPage: bool(r.hasFacebookPage),
    hasInstagramPage: bool(r.hasInstagramPage),
    enoughPublicInfoForPersonalization: bool(r.enoughPublicInfoForPersonalization),
    enoughInfoForPreview: bool(r.enoughInfoForPreview),
  };
}

function ensurePreviewSettings(settings, runMode) {
  const s = settings ?? {};
  const defaultsForMode =
    runMode === "full_preview_package"
      ? {
          autoGeneratePreview: true,
          autoPrepareAssets: true,
          autoRenderScreenshots: true,
        }
      : {
          autoGeneratePreview: false,
          autoPrepareAssets: false,
          autoRenderScreenshots: false,
        };

  return {
    autoGeneratePreview: bool(s.autoGeneratePreview, defaultsForMode.autoGeneratePreview),
    autoPrepareAssets: bool(s.autoPrepareAssets, defaultsForMode.autoPrepareAssets),
    autoRenderScreenshots: bool(s.autoRenderScreenshots, defaultsForMode.autoRenderScreenshots),
    useAIImagesWhenRealImagesLowConfidence: bool(s.useAIImagesWhenRealImagesLowConfidence, true),
    requireApprovalBeforeOutreach: bool(s.requireApprovalBeforeOutreach, true),
  };
}

function ensureFilters(filters) {
  const f = filters ?? {};
  let websiteStatus = cleanText(f.websiteStatus).toLowerCase();
  if (!WEBSITE_STATUSES.includes(websiteStatus)) websiteStatus = "any";

  const minScore = Math.max(0, num(f.minScore, 0));
  const minReviews = Math.max(0, num(f.minReviews, 0));
  const minRating = Math.max(0, Math.min(5, num(f.minRating, 0)));

  return {
    websiteStatus,
    excludeStrongWebsites: bool(f.excludeStrongWebsites),
    minScore,
    minReviews,
    minRating,
    mustHavePhone: bool(f.mustHavePhone),
    mustHaveWebsite: bool(f.mustHaveWebsite),
    mustHaveEmail: bool(f.mustHaveEmail),
    mustHaveSocialPresence: bool(f.mustHaveSocialPresence),
    excludeDuplicates: f.excludeDuplicates === undefined ? true : bool(f.excludeDuplicates),
    excludeChains: f.excludeChains === undefined ? true : bool(f.excludeChains),
    excludedNiches: normalizeArray(f.excludedNiches),
  };
}

export function normalizeLeadGenerationConfig(input) {
  const payload = input ?? {};
  let runMode = cleanText(payload.runMode).toLowerCase();
  if (!RUN_MODES.includes(runMode)) runMode = "research_score_enrich";

  const city = cleanText(payload.city);
  const state = cleanText(payload.state).toUpperCase();
  const zipCode = cleanText(payload.zipCode);
  const searchRadiusMiles =
    payload.searchRadiusMiles === undefined || payload.searchRadiusMiles === null
      ? null
      : Math.max(1, Math.min(500, num(payload.searchRadiusMiles, 0)));

  const config = {
    runTitle: cleanText(payload.runTitle),
    searchTerm: cleanText(payload.searchTerm),
    city,
    state,
    zipCode,
    searchRadiusMiles: Number.isFinite(searchRadiusMiles) ? searchRadiusMiles : null,
    locationQuery: [city, state].filter(Boolean).join(", ") || city,
    maxResults: Math.max(1, Math.min(50, num(payload.maxResults, 10))),
    runMode,
    filters: ensureFilters(payload.filters),
    opportunitySignals: ensureOpportunitySignals(payload.opportunitySignals),
    outreachReadiness: ensureOutreachReadiness(payload.outreachReadiness),
    previewSettings: ensurePreviewSettings(payload.previewSettings, runMode),
  };

  if (!config.runTitle) {
    throw new Error("Run Title is required.");
  }
  if (!config.searchTerm) {
    throw new Error("searchTerm is required.");
  }
  if (!config.city) {
    throw new Error("city is required.");
  }
  return config;
}

function shouldEnrich(runMode) {
  return runMode === "research_score_enrich" || runMode === "full_preview_package";
}

function shouldPersistQualified(runMode) {
  return runMode !== "research_only";
}

function hasLikelyEmail(lead) {
  const text = [lead.notes, lead.websiteUrl].map((v) => String(v ?? "")).join(" ");
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
}

function detectOpportunitySignals(lead, fields) {
  if (lead.opportunitySignals && typeof lead.opportunitySignals === "object") {
    return {
      missingCTA: Boolean(lead.opportunitySignals.missingCTA),
      noBookingForm: Boolean(lead.opportunitySignals.noBookingForm),
      noMobileFriendlySignal: Boolean(lead.opportunitySignals.noMobileFriendlySignal),
      lowTrustSignals: Boolean(lead.opportunitySignals.lowTrustSignals),
      weakHomepageCopy: Boolean(lead.opportunitySignals.weakHomepageCopy),
      noBeforeAfterGallery: Boolean(lead.opportunitySignals.noBeforeAfterGallery),
      noServiceAreaPage: Boolean(lead.opportunitySignals.noServiceAreaPage),
      noReviewsTestimonialsShown: Boolean(lead.opportunitySignals.noReviewsTestimonialsShown),
      noGoogleBusinessProfileWebsiteLink:
        Boolean(lead.opportunitySignals.noGoogleBusinessProfileWebsiteLink) ||
        !hasRealWebsiteUrl(fields.websiteUrl),
    };
  }

  const websiteText = String(fields.websiteHtml ?? "");
  const hasWebsite = hasRealWebsiteUrl(fields.websiteUrl);
  const websiteQuality = String(lead.websiteQuality ?? "unknown");

  const missingCTA = !/(call now|get quote|contact us|schedule|book now|request)/i.test(websiteText);
  const noBookingForm = !/(book|schedule|appointment|form)/i.test(websiteText);
  const noMobileFriendlySignal = !/<meta[^>]+name=["']viewport["'][^>]*>/i.test(websiteText);
  const weakHomepageCopy =
    websiteQuality === "weak" ||
    String(websiteText).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length < 180;
  const noBeforeAfterGallery = !/(before|after|gallery|portfolio)/i.test(websiteText);
  const noServiceAreaPage = !/(service area|areas we serve|locations)/i.test(websiteText);
  const noReviewsTestimonialsShown = !/(review|testimonial|stars?)/i.test(websiteText);
  const lowTrustSignals = !/(licensed|insured|guarantee|trusted|certified)/i.test(websiteText);
  const noGoogleBusinessProfileWebsiteLink = !hasWebsite || fields.websiteUrl === "[EXISTS]";

  return {
    missingCTA,
    noBookingForm,
    noMobileFriendlySignal,
    lowTrustSignals,
    weakHomepageCopy,
    noBeforeAfterGallery,
    noServiceAreaPage,
    noReviewsTestimonialsShown,
    noGoogleBusinessProfileWebsiteLink,
  };
}

function matchAnyNiche(text, excludedNiches) {
  const value = String(text ?? "").toLowerCase();
  return excludedNiches.find((niche) => value.includes(niche)) ?? null;
}

function evaluateLeadAgainstConfig({ config, discoveredRow, leadCandidate, knownNames }) {
  const reasons = [];
  const filters = config.filters;
  const websiteValue = String(leadCandidate.websiteUrl ?? "").trim();
  const hasWebsite = Boolean(websiteValue);
  const websiteQuality = String(leadCandidate.websiteQuality ?? "unknown");
  const normalizedName = normalizeBusinessName(leadCandidate.businessName);

  const matchedExcludedNiche = matchAnyNiche(
    `${leadCandidate.category} ${leadCandidate.businessName}`,
    filters.excludedNiches
  );
  if (matchedExcludedNiche) {
    reasons.push(`Excluded niche matched: ${matchedExcludedNiche}`);
  }

  if (filters.excludeDuplicates && knownNames.has(normalizedName)) {
    reasons.push("Duplicate business already exists.");
  }
  const chain = analyzeChainSignals(leadCandidate);
  leadCandidate.likelyFranchise = chain.likelyFranchise;
  leadCandidate.chainConfidence = chain.chainConfidence;
  leadCandidate.chainReasons = chain.chainReasons;
  if (filters.excludeChains && chain.likelyFranchise) {
    reasons.push(`Likely franchise/chain (${chain.chainConfidence}% confidence).`);
  }

  if (filters.websiteStatus === "missing_only" && hasWebsite) {
    reasons.push("Has website, but filter requires missing website.");
  }
  if (filters.websiteStatus === "weak_only" && websiteQuality !== "weak") {
    reasons.push("Website not marked weak.");
  }
  if (filters.websiteStatus === "weak_or_missing") {
    const missing = !hasWebsite;
    const weak = websiteQuality === "weak";
    if (!missing && !weak) {
      reasons.push("Website is not weak/missing.");
    }
  }
  if (filters.websiteStatus === "exclude_strong" && websiteQuality === "strong") {
    reasons.push("Strong website excluded.");
  }
  if (filters.excludeStrongWebsites && websiteQuality === "strong") {
    reasons.push("Strong website excluded by filter.");
  }

  if ((leadCandidate.score ?? 0) < filters.minScore) {
    reasons.push(`Score below minimum (${leadCandidate.score} < ${filters.minScore}).`);
  }
  if ((leadCandidate.googleReviewCount ?? 0) < filters.minReviews) {
    reasons.push(
      `Review count below minimum (${leadCandidate.googleReviewCount} < ${filters.minReviews}).`
    );
  }
  if ((leadCandidate.googleRating ?? 0) < filters.minRating) {
    reasons.push(`Rating below minimum (${leadCandidate.googleRating} < ${filters.minRating}).`);
  }
  if (filters.mustHavePhone && !cleanText(leadCandidate.phone)) {
    reasons.push("Phone required.");
  }
  if (filters.mustHaveWebsite && !hasWebsite) {
    reasons.push("Website required.");
  }
  if (filters.mustHaveEmail && !hasLikelyEmail(leadCandidate)) {
    reasons.push("Email required but not detected.");
  }
  if (filters.mustHaveSocialPresence && !leadCandidate.socialEvidence) {
    reasons.push("Social presence required.");
  }

  const opportunityDetected = detectOpportunitySignals(leadCandidate, {
    websiteUrl: discoveredRow.websiteUrl,
    websiteHtml: discoveredRow.websiteHtml ?? "",
    notes: leadCandidate.notes,
  });
  const requestedSignals = config.opportunitySignals;
  for (const key of Object.keys(requestedSignals)) {
    if (!requestedSignals[key]) continue;
    if (!opportunityDetected[key]) {
      reasons.push(`Missing requested opportunity signal: ${key}`);
    }
  }

  const readiness = config.outreachReadiness;
  if (readiness.hasPhone && !cleanText(leadCandidate.phone)) {
    reasons.push("Outreach readiness requires phone.");
  }
  if (readiness.hasEmail && !hasLikelyEmail(leadCandidate)) {
    reasons.push("Outreach readiness requires email.");
  }
  if (readiness.hasFacebookPage && !/facebook/i.test(String(leadCandidate.notes ?? ""))) {
    reasons.push("Outreach readiness requires Facebook page evidence.");
  }
  if (readiness.hasInstagramPage && !/instagram/i.test(String(leadCandidate.notes ?? ""))) {
    reasons.push("Outreach readiness requires Instagram page evidence.");
  }
  if (
    readiness.enoughPublicInfoForPersonalization &&
    (!cleanText(leadCandidate.businessName) ||
      !cleanText(leadCandidate.category) ||
      !cleanText(leadCandidate.city))
  ) {
    reasons.push("Not enough public info to personalize outreach.");
  }
  if (
    readiness.enoughInfoForPreview &&
    (!cleanText(leadCandidate.businessName) || !cleanText(leadCandidate.category))
  ) {
    reasons.push("Not enough info to generate preview.");
  }

  return {
    qualified: reasons.length === 0,
    reasons,
    detectedSignals: opportunityDetected,
  };
}

async function readRunHistory() {
  try {
    const raw = await readFile(RUNS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeRunHistory(runs) {
  await writeJsonFileSafe(RUNS_FILE, runs);
}

function buildLeadViewForRun(lead, detectedSignals = null) {
  return {
    id: lead.id ?? null,
    businessName: lead.businessName,
    category: lead.category,
    city: lead.city,
    phone: lead.phone,
    websiteUrl: lead.websiteUrl,
    websiteQuality: lead.websiteQuality ?? "unknown",
    score: Number(lead.score) || 0,
    status: lead.status ?? "SKIP",
    googleReviewCount: Number(lead.googleReviewCount) || 0,
    googleRating: Number(lead.googleRating) || 0,
    pipelineStage: lead.pipelineStage ?? "new",
    previewStatus: lead.previewStatus ?? "not_generated",
    likelyFranchise: Boolean(lead.likelyFranchise),
    chainConfidence: Number(lead.chainConfidence) || 0,
    detectedSignals,
  };
}

export async function listLeadGenerationRuns({ limit = 20 } = {}) {
  const runs = await readRunHistory();
  const sorted = runs
    .slice()
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  return sorted.slice(0, Math.max(1, Math.min(200, Number(limit) || 20)));
}

export async function getLeadGenerationRun(runId) {
  const runs = await readRunHistory();
  return runs.find((run) => run.id === runId) ?? null;
}

function buildTargetLeadGroupPayload(run) {
  return {
    id: run.id,
    title: run.config.runTitle,
    createdAt: run.startedAt,
    searchTerm: run.config.searchTerm,
    city: run.config.city,
    state: run.config.state,
    runMode: run.config.runMode,
    filters: run.config.filters,
    previewSettings: run.config.previewSettings,
    qualifiedLeadIds: run.qualifiedLeads
      .map((lead) => lead.id)
      .filter((id) => id && !String(id).startsWith("virtual-")),
    rejectedLeads: run.rejectedLeads.map((item) => ({
      leadId:
        item.lead?.id && !String(item.lead.id).startsWith("virtual-")
          ? item.lead.id
          : null,
      businessName: item.lead?.businessName ?? "Unknown business",
      score: Number(item.lead?.score) || 0,
      websiteStatus: item.lead?.websiteQuality ?? "unknown",
      reasons: item.reasons ?? [],
    })),
    stats: {
      totalDiscovered: run.summary.discovered,
      qualified: run.summary.qualified,
      rejected: run.summary.rejected,
      previewReady: run.summary.previewsGenerated,
      contacted: 0,
      replied: 0,
      won: 0,
      lost: 0,
    },
  };
}

export async function executeLeadGenerationRun(configInput, onProgress = () => {}, options = {}) {
  const config = normalizeLeadGenerationConfig(configInput);
  const runId = options.runId ?? buildRunId();
  const startedAt = new Date().toISOString();

  const run = {
    id: runId,
    status: "pending",
    startedAt,
    completedAt: null,
    failedAt: null,
    config,
    title: config.runTitle,
    modeDescription: RUN_MODE_DETAILS[config.runMode],
    logs: [],
    qualifiedLeads: [],
    rejectedLeads: [],
    summary: {
      discovered: 0,
      enriched: 0,
      qualified: 0,
      rejected: 0,
      previewsGenerated: 0,
      assetsPrepared: 0,
      screenshotsRendered: 0,
      failed: 0,
    },
    statuses: [
      { step: "pending", at: startedAt },
    ],
  };

  const push = (step, message, extra = {}) => {
    const entry = { at: new Date().toISOString(), step, message, ...extra };
    run.logs.push(entry);
    if (run.logs.length > 500) run.logs = run.logs.slice(-500);
    run.status = step;
    run.statuses.push({ step, at: entry.at });
    onProgress(entry);
  };

  const shouldRunEnrichment = shouldEnrich(config.runMode);
  const shouldSaveLeads = shouldPersistQualified(config.runMode);
  const shouldPreview =
    config.runMode === "full_preview_package" && config.previewSettings.autoGeneratePreview;

  try {
    push("searching", `Searching Google Maps for ${config.searchTerm} in ${config.locationQuery}...`);

    const discovered = await scrapeGoogleMaps({
      searchTerm: config.searchTerm,
      city: config.locationQuery,
      maxResults: config.maxResults,
    });
    run.summary.discovered = discovered.length;
    push("discovered", `Discovered ${discovered.length} candidate businesses.`, {
      discovered: discovered.length,
    });

    const existing = await listLeads();
    const existingByName = new Map(
      existing.map((lead) => [normalizeBusinessName(lead.businessName), lead])
    );
    const knownNames = new Set(existingByName.keys());

    for (const row of discovered) {
      const baseFields = toLeadFields(row, {
        searchTerm: config.searchTerm,
        city: config.locationQuery,
      });
      if (!baseFields.businessName || !baseFields.category || !baseFields.city) {
        run.summary.rejected += 1;
        run.rejectedLeads.push({
          lead: buildLeadViewForRun({ ...baseFields, score: 0, status: "SKIP" }),
          reasons: ["Incomplete discovered record (name/category/city missing)."],
        });
        continue;
      }

      let candidate = baseFields;
      let enriched = false;

      if (shouldRunEnrichment) {
        const enrichment = await enrichLead(baseFields);
        candidate = enrichment.fields;
        enriched = enrichment.enriched;
        if (enriched) run.summary.enriched += 1;
        push("enriched", `${baseFields.businessName}: enrichment ${enriched ? "completed" : "partial"}.`, {
          leadName: baseFields.businessName,
          enriched,
        });
      } else {
        candidate = {
          ...candidate,
          websiteQuality: "unknown",
          weakWebsite: false,
          socialEvidence: false,
          strongProof: false,
        };
      }

      const scoredCandidate = scoreCandidateLead(candidate);
      const normalizedName = normalizeBusinessName(scoredCandidate.businessName);
      const existingLead = existingByName.get(normalizedName);
      if (existingLead) {
        scoredCandidate.id = existingLead.id;
      }
      push(
        shouldRunEnrichment ? "enriched" : "discovered",
        `${scoredCandidate.businessName}: scored ${scoredCandidate.score} (${scoredCandidate.status}).`,
        {
          leadName: scoredCandidate.businessName,
          score: scoredCandidate.score,
          status: scoredCandidate.status,
        }
      );

      const evaluation = evaluateLeadAgainstConfig({
        config,
        discoveredRow: row,
        leadCandidate: scoredCandidate,
        knownNames,
      });

      if (!evaluation.qualified) {
        run.summary.rejected += 1;
        run.rejectedLeads.push({
          lead: buildLeadViewForRun(scoredCandidate, evaluation.detectedSignals),
          reasons: evaluation.reasons,
        });
        push("rejected", `${scoredCandidate.businessName}: rejected (${evaluation.reasons[0]}).`, {
          leadId: scoredCandidate.id ?? null,
          leadName: scoredCandidate.businessName,
          reasons: evaluation.reasons,
        });
        continue;
      }

      let persistedOrScored = scoredCandidate;
      if (shouldSaveLeads) {
        persistedOrScored = existingLead ?? (await addLead(candidate));
        existingByName.set(normalizedName, persistedOrScored);
      }

      run.summary.qualified += 1;
      run.qualifiedLeads.push(buildLeadViewForRun(persistedOrScored, evaluation.detectedSignals));
      knownNames.add(normalizeBusinessName(persistedOrScored.businessName));
      push("qualified", `${persistedOrScored.businessName}: qualified.`, {
        leadId: persistedOrScored.id ?? null,
        leadName: persistedOrScored.businessName,
      });

      if (!shouldSaveLeads) continue;

      if (shouldPreview) {
        try {
          let leadPreviewStatus = "generated";
          await generatePreviewSiteV3(persistedOrScored);
          run.summary.previewsGenerated += 1;
          push("preview_ready", `${persistedOrScored.businessName}: preview generated.`, {
            leadId: persistedOrScored.id,
            leadName: persistedOrScored.businessName,
          });

          if (config.previewSettings.autoPrepareAssets) {
            const originalKey = process.env.OPENAI_API_KEY;
            try {
              if (!config.previewSettings.useAIImagesWhenRealImagesLowConfidence) {
                process.env.OPENAI_API_KEY = "";
              }
              await prepareAssetsForLead(persistedOrScored);
            } finally {
              process.env.OPENAI_API_KEY = originalKey;
            }
            leadPreviewStatus = "assets_ready";
            run.summary.assetsPrepared += 1;
            push("preview_ready", `${persistedOrScored.businessName}: assets prepared.`, {
              leadId: persistedOrScored.id,
            });
          }

          if (config.previewSettings.autoRenderScreenshots) {
            await renderPreviewV3Screenshots(persistedOrScored);
            leadPreviewStatus = "rendered";
            run.summary.screenshotsRendered += 1;
            push("preview_ready", `${persistedOrScored.businessName}: screenshots rendered.`, {
              leadId: persistedOrScored.id,
            });
          }

          await updateLeadMissionControl(persistedOrScored.id, {
            previewStatus: config.previewSettings.requireApprovalBeforeOutreach
              ? leadPreviewStatus
              : "approved",
            previewApprovedAt: config.previewSettings.requireApprovalBeforeOutreach
              ? null
              : new Date().toISOString(),
            pipelineStage: "preview_ready",
          });
        } catch (err) {
          run.summary.failed += 1;
          push("failed", `${persistedOrScored.businessName}: preview pipeline failed (${err.message}).`, {
            leadId: persistedOrScored.id,
            leadName: persistedOrScored.businessName,
            error: err.message,
          });
        }
      }
    }

    run.status = "completed";
    run.completedAt = new Date().toISOString();
    push("completed", "Lead generation run completed.", { summary: run.summary });
  } catch (err) {
    run.status = "failed";
    run.failedAt = new Date().toISOString();
    run.summary.failed += 1;
    push("failed", err.message, { error: err.message });
  }

  const history = await readRunHistory();
  history.push({
    ...run,
    logs: run.logs.slice(-200),
  });
  await writeRunHistory(history.slice(-200));
  const targetLeadGroup = await upsertLeadRun(buildTargetLeadGroupPayload(run));
  run.targetLeadGroup = targetLeadGroup;
  return run;
}

export { RUNS_FILE as LEAD_GENERATION_RUNS_FILE };

export function estimateLeadGenerationWorkload(configInput) {
  const config = normalizeLeadGenerationConfig(configInput);
  const estimatedCandidates = Math.max(1, config.maxResults);
  const enrich = shouldEnrich(config.runMode);
  const preview =
    config.runMode === "full_preview_package" && config.previewSettings.autoGeneratePreview;

  const estimatedSteps = [
    "discover",
    enrich ? "enrich" : null,
    config.runMode === "research_only" ? "qualify-only" : "score+qualify+save",
    preview ? "generate-preview" : null,
    preview && config.previewSettings.autoPrepareAssets ? "prepare-assets" : null,
    preview && config.previewSettings.autoRenderScreenshots ? "render-screenshots" : null,
  ].filter(Boolean);

  return {
    mode: config.runMode,
    modeDescription: RUN_MODE_DETAILS[config.runMode],
    estimatedCandidates,
    estimatedSteps,
    canGeneratePreviews: preview,
    hasStrictFilters:
      config.filters.minScore > 0 ||
      config.filters.minReviews > 0 ||
      config.filters.minRating > 0 ||
      config.filters.websiteStatus !== "any" ||
      config.filters.excludedNiches.length > 0,
  };
}
