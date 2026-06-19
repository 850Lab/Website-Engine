import { cleanText } from "../stage1/shared.js";
import { listQualifiedBusinesses, getQualifiedBusiness } from "../stage1/qualified-business-store.js";
import { getAngleAnalysisStore } from "../angle-analysis/store.js";
import { publicBaseUrl } from "../v7/shared.js";
import { defaultFollowUpText } from "../sales-brief/outreach-copy.js";
import { OPENING_LINES, EMERGENCY_QUESTION, FIRST_DEFLECTION_RESPONSES } from "../sales-brief/outreach-copy.js";
import { buildWebsiteDiscoveryQuestions } from "../sales-brief/website-discovery.js";
import { fillTemplate, resolveIndustryRules } from "../sales-brief/industry-rules.js";
import { OUTREACH_STATUS_LABELS } from "../outreach-page.js";
import { canOperatorAccessLead, assignLeadToOperator } from "../operators/lead-assignment.js";
import { isTwilioTestBusiness } from "../twilio-voice/test-lead.js";
import { trulyHasNoWebsite } from "../stage1/website-presence.js";
import { getFocus, sortLeadsByFocus, filterLeadsToFocus } from "../outreach-focus/routes.js";
import { applyWebsiteFocusToLead } from "../outreach-focus/content.js";
import { listWebsiteActiveLeads, replenishWebsiteActiveQueue } from "../outreach-focus/website-queue.js";

const PRIORITY_RANK = { Hot: 0, Warm: 1, Nurture: 2, "Manual Review": 3 };
const OUTCOME_RANK = {
  not_contacted: 0,
  contacted: 1,
  replied: 2,
  asked_price: 3,
  appointment: 4,
  won: 5,
  lost: 6,
};

function normalizePhoneDigits(phone) {
  return cleanText(phone).replace(/[^\d+]/g, "");
}

function encodeSmsBody(text) {
  return encodeURIComponent(cleanText(text));
}

function resolvePreviewUrl(record, baseUrl) {
  const projectId = cleanText(record.opportunityProjectId);
  if (record.previewUrl) return cleanText(record.previewUrl);
  if (projectId) return `${baseUrl.replace(/\/$/, "")}/p/${projectId}`;
  return "";
}

function resolveGoldenQuestion(record, analysis) {
  const stored = cleanText(record.goldenQuestion || analysis?.golden_question);
  if (stored) return stored;
  const rules = resolveIndustryRules(record.industry || record.category);
  return fillTemplate(rules.goldenQuestion, {
    city: record.city || "",
    businessName: record.businessName || "",
    industry: record.industry || record.category || "",
  });
}

function fallbackAnalysis(record) {
  return {
    businessId: record.id,
    business_name: record.businessName,
    industry: record.industry || record.category || "",
    city: record.city || "",
    detected_problem: cleanText(record.qualificationReason) || "Review before calling.",
    primary_angle: "Learn how they get customers today before pitching anything.",
    recommended_offer: "Match offer to their growth gap after discovery.",
    reason_for_angle: cleanText(record.qualificationReason) || "No angle analysis on file yet.",
    confidence_score: 0,
    folder: "unknown",
    folder_label: "Needs analysis",
    priority_score: 40,
    priority_label: "Manual Review",
    suggested_opening_line: OPENING_LINES.preferred,
    suggested_offer_line: "",
    suggested_deflection_response: FIRST_DEFLECTION_RESPONSES[0],
    emergency_question: EMERGENCY_QUESTION,
    next_action: "Call with discovery opener — ask how they get new business today.",
    golden_question: resolveGoldenQuestion(record, null),
  };
}

export function mergeSalesLead(record, analysis, baseUrl, focus = null) {
  const angle = analysis ?? fallbackAnalysis(record);
  const phone = normalizePhoneDigits(record.phone || record.normalizedPhone);
  const previewUrl = resolvePreviewUrl(record, baseUrl);
  const website = cleanText(record.websiteUrl);
  const smsBody = defaultFollowUpText(
    { businessName: record.businessName, previewUrl, website },
    previewUrl || website,
  );
  const outreachStatus = cleanText(record.outreachStatus) || "not_contacted";
  const salesNotes = Array.isArray(record.salesNotes) ? record.salesNotes : [];

  const lead = {
    id: record.id,
    businessName: record.businessName,
    industry: record.industry || record.category || "",
    city: record.city || "",
    state: record.state || "",
    phone: record.phone || record.normalizedPhone || "",
    website,
    googleMapsUrl: cleanText(record.googleMapsUrl),
    outreachStatus,
    outreachStatusLabel: OUTREACH_STATUS_LABELS[outreachStatus] || outreachStatus,
    hasPhone: Boolean(phone),
    previewUrl,
    problem: angle.detected_problem,
    primaryAngle: angle.primary_angle,
    recommendedOffer: angle.recommended_offer,
    reasonForAngle: angle.reason_for_angle,
    folderLabel: angle.folder_label,
    priorityLabel: angle.priority_label || "Nurture",
    priorityScore: Number(angle.priority_score) || 0,
    confidenceScore: Number(angle.confidence_score) || 0,
    openingLine: angle.suggested_opening_line,
    discoveryQuestions: buildWebsiteDiscoveryQuestions(record, angle),
    goldenQuestion: resolveGoldenQuestion(record, angle),
    deflectionLine: angle.suggested_deflection_response,
    emergencyQuestion: angle.emergency_question,
    nextAction: angle.next_action,
    assignedOperatorId: cleanText(record.assignedOperatorId) || null,
    assignedOperatorName: cleanText(record.assignedOperatorName) || null,
    salesNotes: salesNotes.slice(-5).reverse(),
    actions: {
      call: phone ? `tel:${phone}` : "",
      text: phone ? `sms:${phone}?body=${encodeSmsBody(smsBody)}` : "",
    },
  };

  return focus ? applyWebsiteFocusToLead(lead, focus) : lead;
}

export function sortSalesQueue(leads, focus = null) {
  const sorted = [...leads].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priorityLabel] ?? 9;
    const pb = PRIORITY_RANK[b.priorityLabel] ?? 9;
    if (pa !== pb) return pa - pb;
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    const oa = OUTCOME_RANK[a.outreachStatus] ?? 9;
    const ob = OUTCOME_RANK[b.outreachStatus] ?? 9;
    if (oa !== ob) return oa - ob;
    return String(a.businessName).localeCompare(String(b.businessName));
  });
  return focus ? sortLeadsByFocus(sorted, focus) : sorted;
}

export async function buildSalesQueue(req, filters = {}, operator = null) {
  const baseUrl = publicBaseUrl(req);
  const [store, focus] = await Promise.all([
    getAngleAnalysisStore(),
    getFocus("website").catch(() => null),
  ]);
  const analysisMap = store.analyses ?? {};

  let sourceRecords;
  if (filters.focusOnly !== false && focus) {
    await replenishWebsiteActiveQueue(focus);
    sourceRecords = await listWebsiteActiveLeads(focus);
  } else {
    sourceRecords = await listQualifiedBusinesses();
  }

  let leads = sourceRecords
    .filter((record) => {
      if (operator && !canOperatorAccessLead(record, operator)) return false;
      const phone = normalizePhoneDigits(record.phone || record.normalizedPhone);
      if (filters.phoneOnly !== false && !phone) return false;
      if (filters.qualifiedOnly && record.qualificationStatus !== "qualified") return false;
      if (cleanText(filters.folder)) {
        const analysis = analysisMap[record.id];
        const folder = analysis?.folder ?? "unknown";
        if (folder !== cleanText(filters.folder)) return false;
        if (folder === "no_website" && !trulyHasNoWebsite(record)) return false;
      }
      if (cleanText(filters.priority)) {
        const analysis = analysisMap[record.id];
        const label = analysis?.priority_label ?? "Manual Review";
        if (label !== cleanText(filters.priority)) return false;
      }
      if (filters.excludeClosed) {
        const status = cleanText(record.outreachStatus);
        if (status === "won" || status === "lost") return false;
      }
      if (filters.excludeTwilioTest !== false && isTwilioTestBusiness(record.id)) {
        return false;
      }
      return true;
    })
    .map((record) => mergeSalesLead(record, analysisMap[record.id], baseUrl, focus));

  if (filters.focusOnly !== false && focus) {
    leads = filterLeadsToFocus(leads, focus);
  }
  leads = sortSalesQueue(leads, focus);
  return leads;
}

export async function getSalesLeadById(req, businessId, operator = null, { claim = false } = {}) {
  let record = await getQualifiedBusiness(businessId);
  if (!record) return null;
  if (operator && !canOperatorAccessLead(record, operator)) return null;

  if (claim && operator) {
    record = await assignLeadToOperator(businessId, operator);
  }

  const store = await getAngleAnalysisStore();
  const focus = await getFocus("website").catch(() => null);
  return mergeSalesLead(record, store.analyses?.[businessId], publicBaseUrl(req), focus);
}

export function getNextLeadId(queue, currentId) {
  if (!queue.length) return null;
  if (!currentId) return queue[0].id;
  const index = queue.findIndex((row) => row.id === currentId);
  if (index === -1) return queue[0].id;
  if (index + 1 < queue.length) return queue[index + 1].id;
  return queue[0].id;
}

export function getQueueStats(queue) {
  return {
    total: queue.length,
    hot: queue.filter((row) => row.priorityLabel === "Hot").length,
    notContacted: queue.filter((row) => row.outreachStatus === "not_contacted").length,
  };
}
