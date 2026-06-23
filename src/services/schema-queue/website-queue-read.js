import { cleanText } from "../../stage1/shared.js";
import { publicBaseUrl } from "../../v7/shared.js";
import { OUTREACH_STATUS_LABELS } from "../../outreach-page.js";
import { canOperatorAccessLead, assignLeadToOperator } from "../../operators/lead-assignment.js";
import { isTwilioTestBusiness } from "../../twilio-voice/test-lead.js";
import { trulyHasNoWebsite } from "../../stage1/website-presence.js";
import { getFocus } from "../../outreach-focus/store.js";
import { applyWebsiteFocusToLead } from "../../outreach-focus/content.js";
import { filterLeadsToFocus } from "../../outreach-focus/store.js";
import { getAngleAnalysisStore } from "../../angle-analysis/store.js";
import { getCampaignByOfferSlug } from "../campaigns.js";
import { listBusinesses } from "../businesses.js";
import { listContacts } from "../contacts.js";
import { listOpportunities } from "../opportunities.js";
import { listQueueItems } from "../queue-items.js";
import { listAttempts } from "../attempts.js";

function normalizePhoneDigits(phone) {
  return cleanText(phone).replace(/[^\d+]/g, "");
}

function isVisibleWebsiteQueueItem(item, opportunity) {
  const dueAt = item.dueAt ?? opportunity?.nextFollowUpAt;
  if (item.state === "active") return true;
  if (item.state === "follow_up" && dueAt) {
    const t = Date.parse(dueAt);
    return !Number.isNaN(t) && t <= Date.now();
  }
  return false;
}

function notesFromAttempts(attempts = []) {
  return attempts
    .filter((row) => row.notes)
    .map((row) => ({
      at: row.at,
      text: String(row.notes).replace(/^\[[^\]]+\]\s*/, ""),
      operatorId: row.operatorId ?? null,
      operatorName: null,
    }))
    .slice(-5)
    .reverse();
}

function opportunityToAnalysis(opportunity, business) {
  const angleParts = cleanText(opportunity.recommendedAngle).split(" — ");
  return {
    priority_label: opportunity.priorityLabel ?? "Manual Review",
    priority_score: opportunity.score ?? 0,
    primary_angle: angleParts[0] || opportunity.recommendedAngle,
    detected_problem: angleParts[1] || opportunity.qualificationReason || "Review before calling.",
    recommended_offer: opportunity.recommendedOffer,
    reason_for_angle: opportunity.qualificationReason,
    suggested_opening_line: opportunity.recommendedScript,
    suggested_deflection_response: "",
    folder: "unknown",
    folder_label: opportunity.priorityLabel ? `${opportunity.priorityLabel} lead` : "Needs analysis",
    confidence_score: 0,
    emergency_question: "",
    next_action: "Call with discovery opener — ask how they get new business today.",
    golden_question: null,
    businessId: business.legacyId,
    business_name: business.name,
    industry: business.industry,
    city: business.city,
  };
}

function buildQualifiedShape({ business, contact, opportunity, attempts, queueItem }) {
  const phone = contact?.value ?? "";
  return {
    id: business.legacyId,
    businessName: business.name,
    industry: business.industry,
    category: business.industry,
    city: business.city,
    state: business.state,
    phone,
    normalizedPhone: contact?.normalizedValue ?? phone,
    websiteUrl: business.website,
    googleMapsUrl: business.source?.legacy?.googleMapsUrl ?? null,
    outreachStatus: opportunity?.outreachStatus ?? "not_contacted",
    assignedOperatorId: opportunity?.assignedOperatorId ?? queueItem?.assignedOperatorId ?? null,
    assignedOperatorName: null,
    qualificationStatus: opportunity?.status === "rejected" ? "rejected" : "qualified",
    qualificationReason: opportunity?.qualificationReason,
    opportunityProjectId: null,
    previewUrl: null,
    goldenQuestion: null,
    websiteQueueState: queueItem?.state === "follow_up" ? "follow_up" : "active",
    salesNotes: notesFromAttempts(attempts),
  };
}

function passesWebsiteFilters(record, analysis, filters) {
  const phone = normalizePhoneDigits(record.phone || record.normalizedPhone);
  if (filters.phoneOnly !== false && !phone) return false;
  if (filters.qualifiedOnly && record.qualificationStatus !== "qualified") return false;
  if (cleanText(filters.folder)) {
    const folder = analysis?.folder ?? "unknown";
    if (folder !== cleanText(filters.folder)) return false;
    if (folder === "no_website" && !trulyHasNoWebsite(record)) return false;
  }
  if (cleanText(filters.priority)) {
    const label = analysis?.priority_label ?? "Manual Review";
    if (label !== cleanText(filters.priority)) return false;
  }
  if (filters.excludeClosed) {
    const status = cleanText(record.outreachStatus);
    if (status === "won" || status === "lost") return false;
  }
  if (filters.excludeTwilioTest !== false && isTwilioTestBusiness(record.id)) return false;
  return true;
}

export async function buildSchemaSalesQueue(req, filters = {}, operator = null) {
  const baseUrl = publicBaseUrl(req);
  const focus = filters.focusOnly !== false ? await getFocus("website").catch(() => null) : null;
  const campaign = await getCampaignByOfferSlug("website");
  if (!campaign) return [];

  const [items, businesses, contacts, opportunities, attempts, angleStore] = await Promise.all([
    listQueueItems({ campaignId: campaign.id, states: ["active", "follow_up"] }),
    listBusinesses(),
    listContacts(),
    listOpportunities({ campaignId: campaign.id }),
    listAttempts({ campaignId: campaign.id }),
    getAngleAnalysisStore(),
  ]);
  const analysisMap = angleStore.analyses ?? {};

  const businessById = Object.fromEntries(businesses.map((row) => [row.id, row]));
  const opportunityById = Object.fromEntries(opportunities.map((row) => [row.id, row]));
  const contactsByBusiness = contacts.reduce((acc, row) => {
    if (!acc[row.businessId]) acc[row.businessId] = [];
    acc[row.businessId].push(row);
    return acc;
  }, {});
  const attemptsByOpportunity = attempts.reduce((acc, row) => {
    if (!acc[row.opportunityId]) acc[row.opportunityId] = [];
    acc[row.opportunityId].push(row);
    return acc;
  }, {});

  const rows = [];
  for (const item of items) {
    const business = businessById[item.businessId];
    const opportunity = opportunityById[item.opportunityId];
    if (!business?.legacyId || !opportunity) continue;
    if (!isVisibleWebsiteQueueItem(item, opportunity)) continue;

    const primaryPhone =
      (contactsByBusiness[business.id] ?? []).find((c) => c.type === "phone" && c.isPrimary) ??
      (contactsByBusiness[business.id] ?? []).find((c) => c.type === "phone");

    const record = buildQualifiedShape({
      business,
      contact: primaryPhone,
      opportunity,
      attempts: attemptsByOpportunity[item.opportunityId] ?? [],
      queueItem: item,
    });

    if (operator && !canOperatorAccessLead(record, operator)) continue;

    const angleAnalysis = analysisMap[business.legacyId] ?? null;
    const analysisForFilter = angleAnalysis ?? opportunityToAnalysis(opportunity, business);
    if (!passesWebsiteFilters(record, analysisForFilter, filters)) continue;

    rows.push({
      record,
      analysis: angleAnalysis,
    });
  }

  const rowByLegacyId = Object.fromEntries(rows.map((row) => [row.record.id, row]));
  const { mergeSalesLead, sortSalesQueue } = await import("../../mission-control/sales-queue.js");

  let leads = rows.map((row) => mergeSalesLead(row.record, row.analysis, baseUrl, focus));

  if (filters.focusOnly !== false && focus) {
    leads = filterLeadsToFocus(leads, focus);
  }

  leads = sortSalesQueue(leads, focus);

  return leads;
}

export async function getSchemaSalesLeadById(req, businessId, operator = null, { claim = false } = {}) {
  if (claim && operator) {
    await assignLeadToOperator(businessId, operator);
  }

  const queue = await buildSchemaSalesQueue(req, {}, operator);
  const lead = queue.find((row) => row.id === cleanText(businessId)) ?? null;
  return lead;
}

export async function getSchemaSalesQueueHelpers() {
  const { getNextLeadId, getQueueStats } = await import("../../mission-control/sales-queue.js");
  return { getNextLeadId, getQueueStats };
}
