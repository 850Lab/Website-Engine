import { cleanText } from "../stage1/shared.js";
import { listQualifiedBusinesses } from "../stage1/qualified-business-store.js";
import { getAngleAnalysisStore } from "../angle-analysis/store.js";
import { buildSalesQueue, getSalesLeadById } from "../mission-control/sales-queue.js";
import { buildAngleFolderSummary } from "../angle-folders-page.js";
import { FOLDER_BY_KEY } from "../angle-analysis/categories.js";
import { blobPersistenceEnabled, persistenceBackendLabel } from "../persistence/json-document-store.js";
import { TWILIO_TEST_BUSINESS_ID, ensureTwilioTestBusiness } from "../twilio-voice/test-lead.js";

export const DEFAULT_GOALS = {
  calls: 20,
  conversations: 5,
  appointments: 1,
};

export const DEAL_VALUE = 1000;

export const PIPELINE_STAGES = [
  { key: "ready", label: "Ready To Contact", statuses: ["not_contacted"] },
  { key: "follow_up", label: "Follow Up", statuses: ["contacted"] },
  { key: "interested", label: "Interested", statuses: ["replied", "asked_price"] },
  { key: "preview_sent", label: "Preview Sent", previewSent: true },
  { key: "appointment", label: "Appointment Scheduled", statuses: ["appointment"] },
  { key: "won", label: "Won", statuses: ["won"] },
  { key: "lost", label: "Lost", statuses: ["lost"] },
];

export const CALL_QUEUE_OUTCOMES = [
  { id: "no_answer", label: "No Answer", status: "contacted" },
  { id: "voicemail", label: "Voicemail", status: "contacted" },
  { id: "interested", label: "Interested", status: "replied" },
  { id: "call_back", label: "Call Back", status: "contacted" },
  { id: "appointment", label: "Appointment", status: "appointment" },
  { id: "not_interested", label: "Not Interested", status: "lost" },
  { id: "won", label: "Won", status: "won" },
  { id: "lost", label: "Lost", status: "lost" },
];

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function isToday(iso) {
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  return ts >= startOfDay();
}

function normalizePhone(record) {
  return cleanText(record.phone || record.normalizedPhone).replace(/[^\d+]/g, "");
}

function classifyPipelineStage(record) {
  const status = cleanText(record.outreachStatus) || "not_contacted";
  const hasPreview = Boolean(record.previewGenerated || record.previewUrl || record.opportunityProjectId);

  if (status === "won") return "won";
  if (status === "lost") return "lost";
  if (status === "appointment") return "appointment";
  if (hasPreview && !["won", "lost", "appointment"].includes(status)) return "preview_sent";
  if (status === "replied" || status === "asked_price") return "interested";
  if (status === "contacted") return "follow_up";
  return "ready";
}

export async function buildDailyMetrics(records = null, operator = null) {
  const list = records ?? (await listQualifiedBusinesses());
  const callable = list.filter((r) => {
    if (!normalizePhone(r)) return false;
    if (operator && operator.role !== "owner") {
      const assigned = cleanText(r.assignedOperatorId);
      if (assigned && assigned !== operator.id) return false;
    }
    return true;
  });

  let callsToday = 0;
  let conversationsToday = 0;
  let appointmentsToday = 0;

  for (const record of list) {
    if (operator && operator.role !== "owner") {
      const assigned = cleanText(record.assignedOperatorId);
      if (assigned && assigned !== operator.id) continue;
    }
    if (!isToday(record.outreachStatusUpdatedAt)) continue;
    const status = cleanText(record.outreachStatus) || "not_contacted";
    if (status !== "not_contacted") callsToday += 1;
    if (["replied", "asked_price", "appointment", "won"].includes(status)) {
      conversationsToday += 1;
    }
    if (status === "appointment" || status === "won") appointmentsToday += 1;
  }

  const goals = DEFAULT_GOALS;
  const potentialRevenueToday =
    Math.max(0, goals.appointments - appointmentsToday) * DEAL_VALUE +
    conversationsToday * Math.round(DEAL_VALUE * 0.2);

  return {
    goals,
    progress: {
      calls: { target: goals.calls, completed: callsToday },
      conversations: { target: goals.conversations, completed: conversationsToday },
      appointments: { target: goals.appointments, completed: appointmentsToday },
    },
    potentialRevenueToday,
    callableLeads: callable.filter((r) => {
      const s = cleanText(r.outreachStatus);
      return s !== "won" && s !== "lost";
    }).length,
  };
}

export async function buildPipelineMetrics(records = null) {
  const list = records ?? (await listQualifiedBusinesses());
  const stages = PIPELINE_STAGES.map((stage) => ({
    key: stage.key,
    label: stage.label,
    count: 0,
    revenue: 0,
  }));
  const stageMap = Object.fromEntries(stages.map((s) => [s.key, s]));

  for (const record of list) {
    const key = classifyPipelineStage(record);
    if (!stageMap[key]) continue;
    stageMap[key].count += 1;
    if (key === "won") stageMap[key].revenue += DEAL_VALUE;
    else if (key === "appointment" || key === "interested" || key === "preview_sent") {
      stageMap[key].revenue += Math.round(DEAL_VALUE * 0.5);
    } else if (key === "ready" || key === "follow_up") {
      stageMap[key].revenue += Math.round(DEAL_VALUE * 0.15);
    }
  }

  const totalActive = stages
    .filter((s) => !["won", "lost"].includes(s.key))
    .reduce((sum, s) => sum + s.count, 0);
  const won = stageMap.won?.count ?? 0;
  const lost = stageMap.lost?.count ?? 0;
  const closed = won + lost;
  const winRate = closed > 0 ? Math.round((won / closed) * 100) : 0;

  return {
    stages,
    totalActive,
    totalRevenue: stages.reduce((sum, s) => sum + s.revenue, 0),
    wonRevenue: stageMap.won?.revenue ?? 0,
    winRate,
    conversionToAppointment:
      totalActive > 0
        ? Math.round(((stageMap.appointment?.count ?? 0) / totalActive) * 100)
        : 0,
  };
}

export async function buildTwilioTestLead(req) {
  await ensureTwilioTestBusiness();
  const lead = await getSalesLeadById(req, TWILIO_TEST_BUSINESS_ID);
  if (!lead?.hasPhone) return null;

  return {
    id: lead.id,
    businessName: lead.businessName,
    phone: lead.phone,
    city: lead.city,
    callUrl: lead.actions.call,
    callQueueUrl: `/call-queue?lead=${encodeURIComponent(lead.id)}`,
  };
}

export async function buildNextBestOpportunity(req, operator = null) {
  const queue = await buildSalesQueue(req, { phoneOnly: true, excludeClosed: true }, operator);
  if (!queue.length) return null;

  const lead = queue[0];
  return {
    id: lead.id,
    businessName: lead.businessName,
    industry: lead.industry,
    city: lead.city,
    confidenceScore: lead.confidenceScore,
    opportunityType: lead.folderLabel,
    potentialValue: DEAL_VALUE,
    whyItMatters: lead.problem,
    primaryOffer: lead.recommendedOffer,
    phone: lead.phone,
    previewUrl: lead.previewUrl,
    callUrl: lead.actions.call,
  };
}

export async function buildOpportunityFolders(req) {
  const summary = await buildAngleFolderSummary();
  const records = await listQualifiedBusinesses();
  const store = await getAngleAnalysisStore();
  const analysisMap = store.analyses ?? {};

  const phoneMap = new Map(records.map((r) => [r.id, normalizePhone(r)]));
  const statusMap = new Map(
    records.map((r) => [r.id, cleanText(r.outreachStatus) || "not_contacted"]),
  );
  const previewMap = new Map(
    records.map((r) => [r.id, Boolean(r.previewGenerated || r.previewUrl || r.opportunityProjectId)]),
  );

  const readyCountByFolder = {};
  for (const [businessId, analysis] of Object.entries(analysisMap)) {
    const folder = analysis.folder ?? "unknown";
    const phone = phoneMap.get(businessId);
    const status = statusMap.get(businessId);
    if (!phone || status === "won" || status === "lost") continue;
    readyCountByFolder[folder] = (readyCountByFolder[folder] ?? 0) + 1;
  }

  const folders = summary.folders
    .filter((f) => f.count > 0)
    .sort((a, b) => {
      const pa = FOLDER_BY_KEY[a.key]?.outreachPriority ?? 99;
      const pb = FOLDER_BY_KEY[b.key]?.outreachPriority ?? 99;
      return pa - pb || b.count - a.count;
    })
    .map((folder) => {
      const top = folder.topBusinesses[0] ?? null;
      const meta = FOLDER_BY_KEY[folder.key];

      return {
        key: folder.key,
        label: meta?.label ?? folder.label,
        shortLabel: `${(meta?.label ?? folder.label).split("/")[0].trim()} Opportunity`,
        count: folder.count,
        avgConfidence: folder.avgConfidence,
        potentialRevenue: folder.count * DEAL_VALUE,
        readyToCall: readyCountByFolder[folder.key] ?? 0,
        topOpportunity: top
          ? {
              businessId: top.businessId,
              businessName: top.business_name,
              city: top.city,
              confidence: top.confidence_score,
              hasPreview: previewMap.get(top.businessId),
            }
          : null,
        priority: meta?.outreachPriority ?? 99,
      };
    });

  return { folders, totalAnalyzed: summary.totalAnalyzed };
}

export async function buildPivotalDashboard(req, operator = null) {
  const [daily, pipeline, nextOpportunity, twilioTest] = await Promise.all([
    buildDailyMetrics(null, operator),
    buildPipelineMetrics(),
    buildNextBestOpportunity(req, operator),
    buildTwilioTestLead(req),
  ]);

  return {
    daily,
    pipeline,
    nextOpportunity,
    twilioTest,
    operator: operator
      ? { id: operator.id, name: operator.name, email: operator.email, role: operator.role }
      : null,
  };
}

export function buildSettingsSnapshot() {
  return {
    storage: {
      backend: persistenceBackendLabel(),
      outcomesPersist: blobPersistenceEnabled(),
    },
    goals: DEFAULT_GOALS,
    dealValue: DEAL_VALUE,
  };
}
