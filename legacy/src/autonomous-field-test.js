import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";
import { executeLeadGenerationRun } from "./lead-generation-runs.js";
import { listLeadsWithMeta, buildOutreachDraft, updateLeadMissionControl } from "./mission-control.js";
import { saveDemoProjectForLead } from "./demo-projects.js";
import { buildSalesSupportForLead } from "./sales-support.js";
import { buildContactRouting, classifyPhoneNumber } from "./phone-intelligence.js";

export const AUTONOMOUS_FIELD_TEST_FILE = join(DATA_DIR, "autonomous-field-test.json");

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function readNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function defaultMission() {
  return {
    id: "autonomous_field_test_current",
    objective: "",
    location: "",
    targetMeetings: 3,
    searchTerm: "",
    maxProspects: 8,
    status: "not_started",
    createdAt: null,
    updatedAt: null,
    leadIds: [],
    packages: [],
    contactRouting: {},
    runIds: [],
    logs: [],
    lastError: null,
  };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

function normalizeMission(input = {}) {
  return {
    ...defaultMission(),
    ...input,
    targetMeetings: Math.max(1, Math.min(20, readNumber(input.targetMeetings, 3))),
    maxProspects: Math.max(1, Math.min(50, readNumber(input.maxProspects, 8))),
    leadIds: Array.isArray(input.leadIds) ? [...new Set(input.leadIds.map(cleanText).filter(Boolean))] : [],
    packages: Array.isArray(input.packages) ? input.packages : [],
    contactRouting:
      input.contactRouting && typeof input.contactRouting === "object" && !Array.isArray(input.contactRouting)
        ? input.contactRouting
        : {},
    runIds: Array.isArray(input.runIds) ? input.runIds : [],
    logs: Array.isArray(input.logs) ? input.logs.slice(-200) : [],
  };
}

export async function readAutonomousFieldTestMission() {
  return normalizeMission(await readJson(AUTONOMOUS_FIELD_TEST_FILE, defaultMission()));
}

async function writeMission(mission) {
  const next = normalizeMission({ ...mission, updatedAt: nowIso() });
  await writeJsonFileSafe(AUTONOMOUS_FIELD_TEST_FILE, next);
  return next;
}

function deriveTargetMeetings(objective) {
  const match = cleanText(objective).match(/\b(?:book|schedule|set)\s+(\d+)/i);
  return match ? Number(match[1]) : 3;
}

function deriveSearchTerm(objective) {
  let text = cleanText(objective).toLowerCase();
  text = text
    .replace(/\b(book|schedule|set|land|create)\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\b(meetings?|appointments?|calls?|with|local|nearby|businesses|companies|prospects|leads|in)\b/g, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || "local service business";
}

function parseCityState(location) {
  const [city, state] = cleanText(location).split(",").map(cleanText);
  return {
    city: city || cleanText(location),
    state: state || "",
  };
}

function log(mission, step, message, extra = {}) {
  mission.logs = [
    ...(mission.logs ?? []),
    { at: nowIso(), step, message, ...extra },
  ].slice(-200);
}

export async function startAutonomousFieldTestMission(input = {}) {
  const objective = cleanText(input.objective);
  const location = cleanText(input.location);
  if (!objective) throw new Error("Mission objective is required.");
  if (!location) throw new Error("Mission location is required.");
  const mission = normalizeMission({
    ...defaultMission(),
    objective,
    location,
    targetMeetings: input.targetMeetings || deriveTargetMeetings(objective),
    searchTerm: cleanText(input.searchTerm) || deriveSearchTerm(objective),
    maxProspects: input.maxProspects || 8,
    status: "ready",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  log(mission, "mission_created", `Mission created: ${objective} in ${location}`);
  return writeMission(mission);
}

function buildGenerationConfig(mission, runId) {
  const { city, state } = parseCityState(mission.location);
  return {
    runTitle: `Autonomous Field Test: ${mission.objective} - ${new Date().toISOString().slice(0, 16)}`,
    searchTerm: mission.searchTerm,
    city,
    state,
    maxResults: mission.maxProspects,
    runMode: "full_preview_package",
    filters: {
      minScore: 0,
      excludeDuplicates: true,
      excludeChains: true,
      websiteStatus: "any",
      mustHavePhone: false,
    },
    opportunitySignals: {},
    outreachReadiness: {
      enoughPublicInfoForPersonalization: true,
      enoughInfoForPreview: true,
    },
    previewSettings: {
      autoGeneratePreview: true,
      autoPrepareAssets: true,
      autoRenderScreenshots: false,
      useAIImagesWhenRealImagesLowConfidence: true,
      requireApprovalBeforeOutreach: true,
    },
    autonomousMission: {
      id: mission.id,
      runId,
    },
  };
}

async function buildPackagesForMission(mission) {
  const leads = await listLeadsWithMeta();
  const byId = new Map(leads.map((lead) => [lead.id, lead]));
  const packages = [];
  for (const leadId of mission.leadIds) {
    const lead = byId.get(leadId);
    if (!lead) continue;
    const draft = buildOutreachDraft(lead);
    const sales = buildSalesSupportForLead(lead);
    await saveDemoProjectForLead(lead);
    const optOutLanguage =
      lead.optOutLanguage ||
      "If you would rather not hear from me again, reply STOP or tell me and I will not contact you again.";
    const outreachBody = [draft.body, optOutLanguage].filter(Boolean).join("\n\n");
    packages.push({
      leadId,
      businessName: lead.businessName,
      city: lead.city,
      category: lead.category,
      previewStatus: lead.previewStatus,
      outreachSubject: draft.subject,
      outreachBody,
      pitchScript: sales.pitchScript,
      closeCta: sales.closeCta,
      phoneType: lead.phoneType,
      contactRisk: lead.contactRisk,
      recommendedChannel: lead.recommendedChannel,
      recommendedAction: lead.recommendedAction,
      contactAllowed: lead.contactAllowed,
      consentStatus: lead.consentStatus,
      optOutLanguage,
      generatedAt: nowIso(),
    });
  }
  return packages;
}

export async function refreshAutonomousContactRouting({ force = false } = {}) {
  let mission = await readAutonomousFieldTestMission();
  const leads = await listLeadsWithMeta();
  const byId = new Map(leads.map((lead) => [lead.id, lead]));
  const routing = { ...(mission.contactRouting ?? {}) };
  let routed = 0;

  for (const leadId of mission.leadIds) {
    const lead = byId.get(leadId);
    if (!lead || !hasContactPath(lead) || lead.previewStatus === "not_generated") continue;
    const shouldReuse =
      !force &&
      lead.phoneClassificationCheckedAt &&
      lead.phoneType &&
      lead.phoneType !== "unknown" &&
      lead.phoneClassificationStatus === "classified";
    const classification = shouldReuse
      ? {
          phoneType: lead.phoneType,
          provider: lead.phoneClassificationProvider,
          status: lead.phoneClassificationStatus,
          checkedAt: lead.phoneClassificationCheckedAt,
          error: lead.phoneClassificationError,
        }
      : await classifyPhoneNumber(lead.phone);
    const route = buildContactRouting(lead, classification);
    const updated = await updateLeadMissionControl(lead.id, {
      phoneType: classification.phoneType,
      phoneClassificationStatus: classification.status,
      phoneClassificationProvider: classification.provider,
      phoneClassificationCheckedAt: classification.checkedAt,
      phoneClassificationError: classification.error ?? "",
      consentStatus: lead.consentStatus ?? "unknown",
      contactAllowed: route.contactAllowed,
      contactRisk: route.contactRisk,
      recommendedAction: route.recommendedAction,
      recommendedChannel: route.recommendedChannel,
      optOutLanguage: route.optOutLanguage,
      automatedOutreachAllowed: false,
      complianceWarning: route.complianceWarning,
      activity: {
        type: "contact_routing_updated",
        summary: `Contact route: ${route.recommendedChannel} (${route.contactRisk} risk).`,
      },
    });
    routing[lead.id] = {
      leadId: lead.id,
      businessName: lead.businessName,
      phoneType: updated.phoneType,
      consentStatus: updated.consentStatus,
      contactAllowed: updated.contactAllowed,
      contactRisk: updated.contactRisk,
      recommendedChannel: updated.recommendedChannel,
      recommendedAction: updated.recommendedAction,
      complianceWarning: updated.complianceWarning,
      optOutLanguage: updated.optOutLanguage,
      classifiedAt: updated.phoneClassificationCheckedAt,
      provider: updated.phoneClassificationProvider,
      status: updated.phoneClassificationStatus,
      error: updated.phoneClassificationError,
    };
    routed += 1;
  }

  mission = await readAutonomousFieldTestMission();
  mission.contactRouting = routing;
  log(mission, "contact_routing", `Compliance routing refreshed for ${routed} ready lead(s).`);
  return writeMission(mission);
}

export async function runAutonomousMissionCycle() {
  let mission = await readAutonomousFieldTestMission();
  if (!mission.objective || !mission.location) {
    throw new Error("Create a mission before running the autonomous cycle.");
  }
  mission.status = "running";
  mission.lastError = null;
  log(mission, "cycle_started", "Running autonomous discovery, research, demo, and outreach-package cycle.");
  await writeMission(mission);

  const runId = `mission_${Date.now()}_${randomBytes(4).toString("hex")}`;
  try {
    const result = await executeLeadGenerationRun(buildGenerationConfig(mission, runId), (entry) => {
      log(mission, entry.step, entry.message, {
        leadId: entry.leadId,
        error: entry.error,
      });
    }, { runId });
    if (result.status === "failed") {
      const lastError = [...(result.logs ?? [])].reverse().find((entry) => entry.error || entry.step === "failed");
      throw new Error(lastError?.error || lastError?.message || "Lead generation run failed.");
    }
    const newLeadIds = result.qualifiedLeads.map((lead) => lead.id).filter(Boolean);
    mission = await readAutonomousFieldTestMission();
    mission.leadIds = [...new Set([...(mission.leadIds ?? []), ...newLeadIds])];
    mission.runIds = [...(mission.runIds ?? []), runId].slice(-20);
    mission = await writeMission(mission);
    mission = await refreshAutonomousContactRouting();
    mission.packages = await buildPackagesForMission(mission);
    mission.status = "ready_for_execution";
    log(
      mission,
      "cycle_completed",
      `Cycle complete: ${result.summary.discovered} discovered, ${result.summary.qualified} qualified, ${result.summary.previewsGenerated} demos generated.`
    );
    return buildAutonomousMissionView(await writeMission(mission));
  } catch (err) {
    mission = await readAutonomousFieldTestMission();
    mission.status = "failed";
    mission.lastError = err.message;
    log(mission, "cycle_failed", err.message, { error: err.message });
    await writeMission(mission);
    throw err;
  }
}

function hasContactPath(lead) {
  return Boolean(lead.phone || lead.websiteUrl || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(lead.notes ?? ""));
}

function analyzeMissionBottleneck({ mission, leads, stats }) {
  const evidence = [];
  const counts = { Traffic: 0, System: 0, Skill: 0 };
  if (!mission.leadIds.length) {
    counts.Traffic += 2;
    evidence.push("No qualified prospects are attached to the mission yet.");
  }
  const noContact = leads.filter((lead) => !hasContactPath(lead));
  if (noContact.length) {
    counts.Traffic += noContact.length;
    evidence.push(`${noContact.length} mission lead(s) have no obvious contact path.`);
  }
  const noDemo = leads.filter((lead) => lead.previewStatus === "not_generated");
  if (noDemo.length) {
    counts.System += noDemo.length;
    evidence.push(`${noDemo.length} mission lead(s) do not have generated demos.`);
  }
  if (stats.demosGenerated > 0 && stats.outreachCompleted < stats.demosGenerated) {
    counts.Skill += stats.demosGenerated - stats.outreachCompleted;
    evidence.push("Some demos are ready, but outreach has not been completed.");
  }
  if (stats.outreachCompleted > 0 && stats.replies === 0) {
    counts.Traffic += 1;
    evidence.push("Outreach has started, but no replies are recorded yet.");
  }
  if (stats.replies > 0 && stats.meetingsBooked === 0) {
    counts.Skill += 2;
    evidence.push("Replies exist, but no meetings have been booked.");
  }
  const [primary, score] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const selected = score > 0 ? primary : "None";
  const suggestions = {
    Traffic: "Find more reachable prospects or improve contact-path quality.",
    System: "Stabilize demo generation and asset quality before scaling outreach.",
    Skill: "Work the execution queue: send outreach, handle objections, and ask for meetings.",
    None: "Run the next mission cycle or continue working the execution queue.",
  };
  return {
    primary: selected,
    evidence: evidence.slice(0, 8),
    suggestedNextImprovement: suggestions[selected],
  };
}

export async function buildAutonomousMissionView(inputMission = null) {
  const mission = normalizeMission(inputMission ?? (await readAutonomousFieldTestMission()));
  const leads = await listLeadsWithMeta();
  const missionLeads = mission.leadIds
    .map((id) => leads.find((lead) => lead.id === id))
    .filter(Boolean);
  const stats = {
    prospectsFound: missionLeads.length,
    demosGenerated: missionLeads.filter((lead) => lead.previewStatus !== "not_generated").length,
    outreachCompleted: missionLeads.filter((lead) =>
      ["contacted", "replied", "won", "lost"].includes(lead.pipelineStage) ||
      ["contacted", "replied", "no_response", "won", "lost"].includes(lead.replyStatus)
    ).length,
    replies: missionLeads.filter((lead) => ["replied", "won"].includes(lead.replyStatus) || ["replied", "won"].includes(lead.pipelineStage)).length,
    meetingsBooked: missionLeads.filter((lead) => lead.dealStage === "interested" || lead.dealStage === "negotiating").length,
  };
  const bottleneck = analyzeMissionBottleneck({ mission, leads: missionLeads, stats });
  const confidenceInputs = mission.objective
    ? [
        stats.prospectsFound >= mission.targetMeetings,
        stats.demosGenerated >= Math.min(stats.prospectsFound, mission.targetMeetings),
        mission.packages.length >= Math.min(stats.prospectsFound, mission.targetMeetings),
        stats.outreachCompleted > 0,
        stats.meetingsBooked > 0,
      ]
    : [];
  const confidenceScore = confidenceInputs.length
    ? Math.round((confidenceInputs.filter(Boolean).length / confidenceInputs.length) * 100)
    : 0;
  const executionQueue = missionLeads.map((lead) => ({
    id: lead.id,
    businessName: lead.businessName,
    city: lead.city,
    category: lead.category,
    score: lead.score,
    priority: lead.outreachPriority,
    previewStatus: lead.previewStatus,
    replyStatus: lead.replyStatus,
    pipelineStage: lead.pipelineStage,
    contactPaths: [
      lead.phone ? "phone" : null,
      lead.websiteUrl ? "website" : null,
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(lead.notes ?? "") ? "email" : null,
    ].filter(Boolean),
    phoneType: lead.phoneType,
    consentStatus: lead.consentStatus,
    contactAllowed: lead.contactAllowed,
    contactRisk: lead.contactRisk,
    recommendedChannel: lead.recommendedChannel,
    recommendedAction: lead.recommendedAction,
    complianceWarning: lead.complianceWarning,
    phoneClassificationStatus: lead.phoneClassificationStatus,
    phoneClassificationProvider: lead.phoneClassificationProvider,
    phoneClassificationCheckedAt: lead.phoneClassificationCheckedAt,
    optOutNotes: lead.optOutNotes,
    lastContactAttemptAt: lead.lastContactAttemptAt,
    readyToContact: lead.previewStatus !== "not_generated" && hasContactPath(lead) && lead.contactAllowed !== false,
  }));
  const nextRecommendedAction =
    stats.prospectsFound < mission.targetMeetings
      ? "Run mission cycle to find more prospects."
      : stats.demosGenerated < stats.prospectsFound
        ? "Generate demos for mission prospects."
        : stats.outreachCompleted < stats.demosGenerated
          ? "Work the execution queue and contact ready businesses."
          : stats.meetingsBooked < mission.targetMeetings
            ? "Track replies, follow up, and ask for meetings."
            : "Mission target reached. Review outcomes and repeat the playbook.";

  return {
    mission,
    stats,
    bottleneck,
    confidenceScore,
    nextRecommendedAction,
    executionQueue,
  };
}
