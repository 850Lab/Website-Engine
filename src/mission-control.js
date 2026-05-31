import { loadLeads, saveLeads } from "./storage.js";
import { statusFromScore } from "./scoring.js";
import { generateOutreachAngle } from "./outreach.js";
import { generateBrief } from "./brief.js";
import { analyzeChainSignals, computeLeadVelocity } from "./lead-intelligence.js";

export const PIPELINE_STAGES = [
  "new",
  "preview_ready",
  "contacted",
  "replied",
  "won",
  "lost",
];

export const PREVIEW_STATUSES = [
  "not_generated",
  "generated",
  "assets_ready",
  "rendered",
  "approved",
];

export const REPLY_STATUSES = [
  "not_contacted",
  "contacted",
  "replied",
  "no_response",
  "won",
  "lost",
];

export const DEAL_STAGES = [
  "discovery",
  "contacted",
  "replied",
  "interested",
  "quoting",
  "negotiating",
  "won",
  "onboarding",
  "fulfilled",
  "retained",
  "lost",
];

export const PROPOSAL_STATUSES = [
  "not_generated",
  "draft",
  "sent",
  "accepted",
  "rejected",
];

export const PHONE_TYPES = [
  "mobile",
  "landline",
  "fixed_voip",
  "non_fixed_voip",
  "toll_free",
  "unknown",
];

export const CONSENT_STATUSES = ["unknown", "consented", "opted_out"];

export const CONTACT_RISKS = ["low", "medium", "high"];

const CONTACT_CHANNELS = [
  "email",
  "phone",
  "facebook",
  "instagram",
  "in-person",
];

function toIsoOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function clampPipelineStage(stage) {
  return PIPELINE_STAGES.includes(stage) ? stage : "new";
}

function clampPreviewStatus(status) {
  return PREVIEW_STATUSES.includes(status) ? status : "not_generated";
}

function clampReplyStatus(status) {
  return REPLY_STATUSES.includes(status) ? status : "not_contacted";
}

function clampManualStatus(status) {
  return ["TARGET", "HOLD", "SKIP"].includes(status) ? status : null;
}

function clampContactChannel(channel) {
  return CONTACT_CHANNELS.includes(channel) ? channel : null;
}

function clampDealStage(stage, lead = {}) {
  if (DEAL_STAGES.includes(stage)) return stage;
  if (lead.pipelineStage === "won" || lead.replyStatus === "won") return "won";
  if (lead.pipelineStage === "lost" || lead.replyStatus === "lost") return "lost";
  if (lead.pipelineStage === "replied" || lead.replyStatus === "replied") return "replied";
  if (lead.pipelineStage === "contacted" || lead.replyStatus === "contacted") return "contacted";
  return "discovery";
}

function clampProposalStatus(status) {
  return PROPOSAL_STATUSES.includes(status) ? status : "not_generated";
}

function clampPhoneType(type) {
  return PHONE_TYPES.includes(type) ? type : "unknown";
}

function clampConsentStatus(status) {
  return CONSENT_STATUSES.includes(status) ? status : "unknown";
}

function clampContactRisk(risk) {
  return CONTACT_RISKS.includes(risk) ? risk : "medium";
}

function ensureOutreachHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object");
}

function ensureObjectArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object");
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeLeadMeta(lead) {
  const updated = { ...lead };
  updated.pipelineStage = clampPipelineStage(updated.pipelineStage);
  updated.previewStatus = clampPreviewStatus(updated.previewStatus);
  updated.replyStatus = clampReplyStatus(updated.replyStatus);
  updated.contactedAt = toIsoOrNull(updated.contactedAt);
  updated.lastContactChannel = clampContactChannel(updated.lastContactChannel);
  updated.followUpNeeded = Boolean(updated.followUpNeeded);
  updated.nextFollowUpAt = toIsoOrNull(updated.nextFollowUpAt);
  updated.followUpCount = Math.max(0, Number(updated.followUpCount) || 0);
  updated.lastFollowUpAt = toIsoOrNull(updated.lastFollowUpAt);
  updated.previewApprovedAt = toIsoOrNull(updated.previewApprovedAt);
  updated.lastContactedAt = toIsoOrNull(updated.lastContactedAt);
  updated.outreachHistory = ensureOutreachHistory(updated.outreachHistory);
  updated.dealStage = clampDealStage(updated.dealStage, updated);
  updated.dealNotes = cleanText(updated.dealNotes);
  updated.estimatedDealValue = Math.max(0, Number(updated.estimatedDealValue) || 0);
  updated.expectedCloseDate = toIsoOrNull(updated.expectedCloseDate);
  updated.closeProbability = Math.max(0, Math.min(100, Number(updated.closeProbability) || 0));
  updated.serviceType = cleanText(updated.serviceType);
  updated.websitePackageType = cleanText(updated.websitePackageType);
  updated.proposalStatus = clampProposalStatus(updated.proposalStatus);
  updated.proposalHistory = ensureObjectArray(updated.proposalHistory);
  updated.currentProposal =
    updated.currentProposal && typeof updated.currentProposal === "object"
      ? updated.currentProposal
      : null;
  updated.assignedTo = cleanText(updated.assignedTo);
  updated.ownedBy = cleanText(updated.ownedBy);
  updated.lastUpdatedBy = cleanText(updated.lastUpdatedBy);
  updated.operatorActivityLog = ensureObjectArray(updated.operatorActivityLog);
  updated.interactionSummary = cleanText(updated.interactionSummary);
  updated.objections = cleanText(updated.objections);
  updated.preferredContactMethod = cleanText(updated.preferredContactMethod);
  updated.bestOutreachAngle = cleanText(updated.bestOutreachAngle);
  updated.closeBlockers = cleanText(updated.closeBlockers);
  updated.phoneType = clampPhoneType(updated.phoneType);
  updated.phoneClassificationStatus = cleanText(updated.phoneClassificationStatus);
  updated.phoneClassificationProvider = cleanText(updated.phoneClassificationProvider);
  updated.phoneClassificationCheckedAt = toIsoOrNull(updated.phoneClassificationCheckedAt);
  updated.phoneClassificationError = cleanText(updated.phoneClassificationError);
  updated.consentStatus = clampConsentStatus(updated.consentStatus);
  updated.contactAllowed = updated.consentStatus === "opted_out" ? false : updated.contactAllowed !== false;
  updated.contactRisk = clampContactRisk(updated.contactRisk);
  updated.recommendedAction = cleanText(updated.recommendedAction);
  updated.recommendedChannel = cleanText(updated.recommendedChannel);
  updated.optOutNotes = cleanText(updated.optOutNotes);
  updated.optOutLanguage = cleanText(updated.optOutLanguage);
  updated.lastContactAttemptAt = toIsoOrNull(updated.lastContactAttemptAt);
  updated.automatedOutreachAllowed = false;
  updated.complianceWarning = cleanText(updated.complianceWarning);
  return updated;
}

function recomputeLeadBasics(lead) {
  const normalized = normalizeLeadMeta(lead);
  const computedStatus = statusFromScore(Number(normalized.score) || 0);
  const status = normalized.manualStatus ?? computedStatus;
  const angle = generateOutreachAngle(normalized);
  const chain = analyzeChainSignals(normalized);
  const velocity = computeLeadVelocity({ ...normalized, ...chain });
  const operatorMemorySummary = buildOperatorMemorySummary({
    ...normalized,
    outreachAngle: angle.label,
    outreachKey: angle.key,
    outreachPitch: angle.pitch,
  });
  return {
    ...normalized,
    ...chain,
    ...velocity,
    computedStatus,
    status,
    outreachAngle: angle.label,
    outreachKey: angle.key,
    outreachPitch: angle.pitch,
    operatorMemorySummary,
    updatedAt: new Date().toISOString(),
  };
}

export async function listLeadsWithMeta() {
  const leads = await loadLeads();
  return leads.map((lead) => recomputeLeadBasics(lead));
}

export async function findLeadWithMeta(id) {
  const leads = await listLeadsWithMeta();
  return leads.find((lead) => lead.id === id) ?? null;
}

export async function updateLeadMissionControl(id, patch) {
  const leads = await loadLeads();
  const index = leads.findIndex((lead) => lead.id === id);
  if (index === -1) {
    throw new Error(`Lead not found: ${id}`);
  }

  const current = recomputeLeadBasics(leads[index]);
  const next = { ...current };

  if (typeof patch.notes === "string") next.notes = patch.notes;
  if (typeof patch.manualStatus === "string") {
    next.manualStatus = clampManualStatus(patch.manualStatus);
  }
  if (typeof patch.pipelineStage === "string") {
    next.pipelineStage = clampPipelineStage(patch.pipelineStage);
  }
  if (typeof patch.previewStatus === "string") {
    next.previewStatus = clampPreviewStatus(patch.previewStatus);
  }
  if (typeof patch.replyStatus === "string") {
    next.replyStatus = clampReplyStatus(patch.replyStatus);
  }
  if (patch.contactedAt !== undefined) {
    next.contactedAt = toIsoOrNull(patch.contactedAt);
  }
  if (patch.lastContactedAt !== undefined) {
    next.lastContactedAt = toIsoOrNull(patch.lastContactedAt);
  }
  if (patch.lastContactChannel !== undefined) {
    next.lastContactChannel = clampContactChannel(patch.lastContactChannel);
  }
  if (patch.followUpNeeded !== undefined) {
    next.followUpNeeded = Boolean(patch.followUpNeeded);
  }
  if (patch.nextFollowUpAt !== undefined) {
    next.nextFollowUpAt = toIsoOrNull(patch.nextFollowUpAt);
  }
  if (patch.followUpCount !== undefined) {
    next.followUpCount = Math.max(0, Number(patch.followUpCount) || 0);
  }
  if (patch.lastFollowUpAt !== undefined) {
    next.lastFollowUpAt = toIsoOrNull(patch.lastFollowUpAt);
  }
  if (patch.previewApprovedAt !== undefined) {
    next.previewApprovedAt = toIsoOrNull(patch.previewApprovedAt);
  }
  if (Array.isArray(patch.outreachHistory)) {
    next.outreachHistory = ensureOutreachHistory(patch.outreachHistory);
  }
  if (typeof patch.dealStage === "string") next.dealStage = clampDealStage(patch.dealStage, next);
  if (typeof patch.dealNotes === "string") next.dealNotes = patch.dealNotes;
  if (patch.estimatedDealValue !== undefined) {
    next.estimatedDealValue = Math.max(0, Number(patch.estimatedDealValue) || 0);
  }
  if (patch.expectedCloseDate !== undefined) next.expectedCloseDate = toIsoOrNull(patch.expectedCloseDate);
  if (patch.closeProbability !== undefined) {
    next.closeProbability = Math.max(0, Math.min(100, Number(patch.closeProbability) || 0));
  }
  if (typeof patch.serviceType === "string") next.serviceType = patch.serviceType;
  if (typeof patch.websitePackageType === "string") next.websitePackageType = patch.websitePackageType;
  if (typeof patch.proposalStatus === "string") {
    next.proposalStatus = clampProposalStatus(patch.proposalStatus);
  }
  if (Array.isArray(patch.proposalHistory)) next.proposalHistory = ensureObjectArray(patch.proposalHistory);
  if (patch.currentProposal !== undefined) {
    next.currentProposal =
      patch.currentProposal && typeof patch.currentProposal === "object" ? patch.currentProposal : null;
  }
  if (typeof patch.assignedTo === "string") next.assignedTo = patch.assignedTo;
  if (typeof patch.ownedBy === "string") next.ownedBy = patch.ownedBy;
  if (typeof patch.lastUpdatedBy === "string") next.lastUpdatedBy = patch.lastUpdatedBy;
  if (Array.isArray(patch.operatorActivityLog)) {
    next.operatorActivityLog = ensureObjectArray(patch.operatorActivityLog);
  }
  if (typeof patch.interactionSummary === "string") next.interactionSummary = patch.interactionSummary;
  if (typeof patch.objections === "string") next.objections = patch.objections;
  if (typeof patch.preferredContactMethod === "string") {
    next.preferredContactMethod = patch.preferredContactMethod;
  }
  if (typeof patch.bestOutreachAngle === "string") next.bestOutreachAngle = patch.bestOutreachAngle;
  if (typeof patch.closeBlockers === "string") next.closeBlockers = patch.closeBlockers;
  if (typeof patch.phoneType === "string") next.phoneType = clampPhoneType(patch.phoneType);
  if (typeof patch.phoneClassificationStatus === "string") {
    next.phoneClassificationStatus = patch.phoneClassificationStatus;
  }
  if (typeof patch.phoneClassificationProvider === "string") {
    next.phoneClassificationProvider = patch.phoneClassificationProvider;
  }
  if (patch.phoneClassificationCheckedAt !== undefined) {
    next.phoneClassificationCheckedAt = toIsoOrNull(patch.phoneClassificationCheckedAt);
  }
  if (typeof patch.phoneClassificationError === "string") {
    next.phoneClassificationError = patch.phoneClassificationError;
  }
  if (typeof patch.consentStatus === "string") next.consentStatus = clampConsentStatus(patch.consentStatus);
  if (patch.contactAllowed !== undefined) next.contactAllowed = Boolean(patch.contactAllowed);
  if (typeof patch.contactRisk === "string") next.contactRisk = clampContactRisk(patch.contactRisk);
  if (typeof patch.recommendedAction === "string") next.recommendedAction = patch.recommendedAction;
  if (typeof patch.recommendedChannel === "string") next.recommendedChannel = patch.recommendedChannel;
  if (typeof patch.optOutNotes === "string") next.optOutNotes = patch.optOutNotes;
  if (typeof patch.optOutLanguage === "string") next.optOutLanguage = patch.optOutLanguage;
  if (patch.lastContactAttemptAt !== undefined) {
    next.lastContactAttemptAt = toIsoOrNull(patch.lastContactAttemptAt);
  }
  if (typeof patch.complianceWarning === "string") next.complianceWarning = patch.complianceWarning;
  next.automatedOutreachAllowed = false;

  if (next.pipelineStage === "contacted" && !next.contactedAt) {
    next.contactedAt = new Date().toISOString();
  }

  const activity =
    patch.activity && typeof patch.activity === "object"
      ? {
          at: toIsoOrNull(patch.activity.at) ?? new Date().toISOString(),
          type: cleanText(patch.activity.type) || "update",
          summary: cleanText(patch.activity.summary),
          by: cleanText(patch.lastUpdatedBy || patch.activity.by || "operator"),
        }
      : null;
  if (activity) {
    next.operatorActivityLog = [...ensureObjectArray(next.operatorActivityLog), activity].slice(-100);
  }

  leads[index] = recomputeLeadBasics(next);
  await saveLeads(leads);
  return leads[index];
}

export async function appendOutreachHistory(id, entry) {
  const lead = await findLeadWithMeta(id);
  if (!lead) {
    throw new Error(`Lead not found: ${id}`);
  }

  const outreachEntry = {
    at: toIsoOrNull(entry.at) ?? new Date().toISOString(),
    subject: String(entry.subject ?? "").trim(),
    body: String(entry.body ?? "").trim(),
    channel: clampContactChannel(entry.channel) ?? "email",
    replyStatus: clampReplyStatus(entry.replyStatus),
    followUpNeeded: Boolean(entry.followUpNeeded),
    nextFollowUpAt: toIsoOrNull(entry.nextFollowUpAt),
    action: String(entry.action ?? "contact").trim(),
    notes: String(entry.notes ?? "").trim(),
  };

  const nextHistory = [...ensureOutreachHistory(lead.outreachHistory), outreachEntry];
  return updateLeadMissionControl(id, {
    outreachHistory: nextHistory,
    lastContactChannel: outreachEntry.channel,
    replyStatus: outreachEntry.replyStatus,
    followUpNeeded: outreachEntry.followUpNeeded,
    nextFollowUpAt: outreachEntry.nextFollowUpAt,
    lastFollowUpAt: outreachEntry.action === "follow_up" ? outreachEntry.at : lead.lastFollowUpAt,
    followUpCount:
      outreachEntry.action === "follow_up"
        ? (Number(lead.followUpCount) || 0) + 1
        : Number(lead.followUpCount) || 0,
    contactedAt: outreachEntry.at,
    lastContactedAt: outreachEntry.at,
    pipelineStage:
      outreachEntry.replyStatus === "won"
        ? "won"
        : outreachEntry.replyStatus === "lost"
          ? "lost"
          : outreachEntry.replyStatus === "replied"
            ? "replied"
            : "contacted",
    dealStage:
      outreachEntry.replyStatus === "won"
        ? "won"
        : outreachEntry.replyStatus === "lost"
          ? "lost"
          : outreachEntry.replyStatus === "replied"
            ? "replied"
            : "contacted",
    activity: {
      type: outreachEntry.action,
      summary: outreachEntry.notes || `${outreachEntry.channel} ${outreachEntry.replyStatus}`,
      at: outreachEntry.at,
    },
  });
}

export function buildOperatorMemorySummary(lead) {
  const parts = [];
  if (lead.interactionSummary) parts.push(lead.interactionSummary);
  if (lead.objections) parts.push(`Objections: ${lead.objections}`);
  if (lead.preferredContactMethod) parts.push(`Prefers ${lead.preferredContactMethod}`);
  if (lead.bestOutreachAngle) parts.push(`Best angle: ${lead.bestOutreachAngle}`);
  else if (lead.outreachAngle) parts.push(`Angle: ${lead.outreachAngle}`);
  if (lead.closeBlockers) parts.push(`Blockers: ${lead.closeBlockers}`);
  if (!parts.length) {
    return `${lead.outreachPitch || "No operator history yet."}`;
  }
  return parts.join("; ");
}

function estimateProposalPrice(lead) {
  const packageType = cleanText(lead.websitePackageType).toLowerCase();
  const score = Number(lead.score) || 0;
  if (packageType.includes("landing")) return 900;
  if (packageType.includes("premium")) return 2800;
  if (packageType.includes("standard")) return 1800;
  return score >= 14 ? 2200 : score >= 10 ? 1600 : 1200;
}

export function generateProposalForLead(lead) {
  const price = estimateProposalPrice(lead);
  const packageType = lead.websitePackageType || (price >= 2200 ? "Premium local service site" : "Standard local service site");
  const services = [
    "Mobile-first homepage redesign",
    "Clear call/request CTA sections",
    "Trust and review proof blocks",
    "Service area and service highlights",
    "Basic technical SEO structure",
  ];
  if (lead.previewStatus === "approved") services.unshift("Approved preview used as visual direction");
  if (!lead.websiteUrl) services.push("New domain/site launch guidance");
  if (lead.websiteQuality === "weak") services.push("Conversion-focused rebuild of existing weak site");
  const proposal = {
    id: `proposal_${Date.now()}`,
    generatedAt: new Date().toISOString(),
    status: "draft",
    summary: `${packageType} for ${lead.businessName} focused on turning local search demand into calls and quote requests.`,
    servicesIncluded: services,
    pricingEstimate: price,
    turnaround: price >= 2200 ? "7-10 business days" : "5-7 business days",
    deliverables: [
      "Homepage/site preview refinement",
      "Responsive production-ready pages",
      "CTA/contact sections",
      "Launch handoff checklist",
    ],
    optionalAddOns: [
      "Google Business Profile cleanup",
      "Monthly content/SEO support",
      "Additional service pages",
      "Before/after gallery buildout",
    ],
  };
  return proposal;
}

export function buildOutreachDraft(lead) {
  const brief = generateBrief(lead);
  const businessName = lead.businessName;
  const city = lead.city;
  const services = (brief.servicesToHighlight ?? []).slice(0, 3).join(", ");
  const pain =
    lead.outreachKey === "no_website"
      ? "you are likely losing calls from people who cannot quickly find a credible website"
      : lead.outreachKey === "weak_website"
        ? "your current site may be costing you conversions on mobile"
        : "you likely have room to convert more of your existing traffic";

  const subject = `${businessName}: quick website preview for ${city}`;
  const body = [
    `Hi ${businessName} team,`,
    "",
    `I put together a quick homepage preview for your ${lead.category} business in ${city}.`,
    `Based on your online presence, ${pain}.`,
    "",
    `I focused on: ${services || "clear service sections, proof, and stronger CTAs"}.`,
    "",
    "If you want, I can send the preview link and walk through a practical next step plan.",
    "",
    "- Website Outreach Engine",
  ].join("\n");

  return { subject, body };
}

function isDateThisWeek(value, now = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);
  return date >= now && date <= weekEnd;
}

function dateDiffDays(start, end) {
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function addMetric(map, key, lead) {
  const normalizedKey = cleanText(key) || "Unknown";
  const metric = map.get(normalizedKey) ?? {
    name: normalizedKey,
    leads: 0,
    contacted: 0,
    replied: 0,
    won: 0,
  };
  metric.leads += 1;
  if (["contacted", "replied", "won", "lost"].includes(lead.pipelineStage) || lead.replyStatus !== "not_contacted") {
    metric.contacted += 1;
  }
  if (lead.replyStatus === "replied" || lead.pipelineStage === "replied") metric.replied += 1;
  if (lead.replyStatus === "won" || lead.pipelineStage === "won") metric.won += 1;
  map.set(normalizedKey, metric);
}

function finalizeMetricMap(map) {
  return [...map.values()]
    .map((item) => ({
      ...item,
      replyRate: item.contacted ? Math.round((item.replied / item.contacted) * 100) : 0,
      closeRate: item.replied ? Math.round((item.won / item.replied) * 100) : 0,
    }))
    .sort((a, b) => b.won - a.won || b.replyRate - a.replyRate || b.leads - a.leads)
    .slice(0, 5);
}

export function buildDashboardSummary(leads) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const summary = {
    totalLeads: leads.length,
    targetLeads: 0,
    holdLeads: 0,
    skipLeads: 0,
    leadsContacted: 0,
    leadsReplied: 0,
    leadsWon: 0,
    leadsLost: 0,
    latestGeneratedPreviews: [],
    outreachDueToday: 0,
    overdueFollowUps: 0,
    leadsNeedingPreviews: 0,
    approvedAwaitingContact: 0,
    recentReplies: [],
    recentWins: [],
    nextBestActions: [],
    dailyMission: {
      generatedAt: new Date().toISOString(),
      progress: {
        completedToday: 0,
        totalToday: 0,
        percent: 0,
      },
      cards: [],
    },
    dealPipeline: {
      activeDeals: 0,
      estimatedValue: 0,
      weightedValue: 0,
      likelyClosesThisWeek: [],
      byStage: {},
    },
    performanceIntelligence: {
      bestNiches: [],
      bestCities: [],
      outreachToReplyConversion: 0,
      replyToCloseConversion: 0,
      previewApprovalRate: 0,
      followUpEffectiveness: 0,
      averageTouchesBeforeReply: 0,
      averageTimeToCloseDays: 0,
      operatorThroughputPerDay: 0,
      trendCards: [],
      topCampaigns: [],
      weakCampaigns: [],
      stalledCampaigns: [],
    },
    reactivationQueue: [],
    operatorAnalytics: {
      contactedToday: 0,
      repliesToday: 0,
      followUpsCompletedToday: 0,
      winRate: 0,
      outreachConversion: 0,
      previewsApprovedRate: 0,
      outreachBacklogCount: 0,
      totalContacted: 0,
      totalReplies: 0,
      totalWon: 0,
      totalApprovedPreviews: 0,
      totalGeneratedPreviews: 0,
    },
  };
  const nicheMetrics = new Map();
  const cityMetrics = new Map();
  let firstOutreachNeeded = 0;
  let hotReplies = 0;
  let touchedToday = 0;
  let touchesBeforeReplyTotal = 0;
  let repliedWithTouchCount = 0;
  let timeToCloseTotal = 0;
  let closedWithTimeCount = 0;
  let followUpsWithReply = 0;
  let followUpsTotal = 0;
  const activeDealStages = ["interested", "quoting", "negotiating", "onboarding"];

  for (const lead of leads) {
    if (lead.status === "TARGET") summary.targetLeads += 1;
    if (lead.status === "HOLD") summary.holdLeads += 1;
    if (lead.status === "SKIP") summary.skipLeads += 1;
    if (
      ["contacted", "replied", "won", "lost"].includes(lead.pipelineStage) ||
      ["contacted", "replied", "no_response", "won", "lost"].includes(lead.replyStatus)
    ) {
      summary.leadsContacted += 1;
    }
    if (lead.replyStatus === "replied" || lead.pipelineStage === "replied") summary.leadsReplied += 1;
    if (lead.replyStatus === "won" || lead.pipelineStage === "won") summary.leadsWon += 1;
    if (lead.replyStatus === "lost" || lead.pipelineStage === "lost") summary.leadsLost += 1;
    if (lead.followUpDue) summary.outreachDueToday += 1;
    if (lead.followUpOverdue) summary.overdueFollowUps += 1;
    if (lead.previewStatus === "not_generated" && lead.status !== "SKIP") summary.leadsNeedingPreviews += 1;
    if (lead.approvedNeverContacted) summary.approvedAwaitingContact += 1;
    if (lead.approvedNeverContacted) firstOutreachNeeded += 1;
    if (lead.replyStatus === "replied") {
      summary.recentReplies.push({ id: lead.id, businessName: lead.businessName, updatedAt: lead.latestTouchAt ?? lead.updatedAt });
      if (lead.latestTouchAt && new Date(lead.latestTouchAt) >= todayStart) hotReplies += 1;
    }
    if (lead.replyStatus === "won" || lead.pipelineStage === "won") {
      summary.recentWins.push({ id: lead.id, businessName: lead.businessName, updatedAt: lead.latestTouchAt ?? lead.updatedAt });
    }
    if (lead.contactedAt && new Date(lead.contactedAt) >= todayStart && new Date(lead.contactedAt) <= todayEnd) {
      summary.operatorAnalytics.contactedToday += 1;
    }
    if (lead.replyStatus === "replied" && lead.latestTouchAt && new Date(lead.latestTouchAt) >= todayStart) {
      summary.operatorAnalytics.repliesToday += 1;
    }
    for (const item of lead.outreachHistory ?? []) {
      if (item.action === "follow_up" && item.at && new Date(item.at) >= todayStart) {
        summary.operatorAnalytics.followUpsCompletedToday += 1;
      }
      if (item.at && new Date(item.at) >= todayStart) touchedToday += 1;
      if (item.action === "follow_up") {
        followUpsTotal += 1;
        if (["replied", "won"].includes(item.replyStatus)) followUpsWithReply += 1;
      }
    }
    if (lead.replyStatus === "replied" || lead.pipelineStage === "replied") {
      const touches = (lead.outreachHistory ?? []).length || (lead.contactedAt ? 1 : 0);
      if (touches > 0) {
        touchesBeforeReplyTotal += touches;
        repliedWithTouchCount += 1;
      }
    }
    if (lead.replyStatus === "won" || lead.pipelineStage === "won") {
      const days = dateDiffDays(lead.contactedAt || lead.createdAt, lead.latestTouchAt || lead.updatedAt);
      if (days !== null) {
        timeToCloseTotal += days;
        closedWithTimeCount += 1;
      }
    }
    if (lead.previewStatus === "approved") summary.operatorAnalytics.totalApprovedPreviews += 1;
    if (lead.previewStatus !== "not_generated") summary.operatorAnalytics.totalGeneratedPreviews += 1;
    if (
      lead.approvedNeverContacted ||
      lead.followUpDue ||
      lead.followUpOverdue ||
      lead.replyStatus === "contacted" ||
      lead.replyStatus === "no_response"
    ) {
      summary.operatorAnalytics.outreachBacklogCount += 1;
    }
    if (lead.previewStatus !== "not_generated") {
      summary.latestGeneratedPreviews.push({
        id: lead.id,
        businessName: lead.businessName,
        previewStatus: lead.previewStatus,
        updatedAt: lead.updatedAt,
      });
    }
    addMetric(nicheMetrics, lead.category || lead.niche || lead.searchTerm, lead);
    addMetric(cityMetrics, lead.city, lead);

    const dealStage = clampDealStage(lead.dealStage, lead);
    summary.dealPipeline.byStage[dealStage] = (summary.dealPipeline.byStage[dealStage] ?? 0) + 1;
    if (activeDealStages.includes(dealStage)) {
      const value = Number(lead.estimatedDealValue) || 0;
      const probability = Number(lead.closeProbability) || (dealStage === "negotiating" ? 70 : dealStage === "quoting" ? 55 : 35);
      summary.dealPipeline.activeDeals += 1;
      summary.dealPipeline.estimatedValue += value;
      summary.dealPipeline.weightedValue += Math.round(value * (probability / 100));
      if (isDateThisWeek(lead.expectedCloseDate)) {
        summary.dealPipeline.likelyClosesThisWeek.push({
          id: lead.id,
          businessName: lead.businessName,
          estimatedDealValue: value,
          closeProbability: probability,
          expectedCloseDate: lead.expectedCloseDate,
        });
      }
    }

    if (lead.approvedNeverContacted || lead.staleLead || (lead.replyStatus === "contacted" && (lead.daysSinceLastTouch ?? 0) >= 7)) {
      const reason = lead.approvedNeverContacted
        ? "Approved preview never contacted"
        : lead.replyStatus === "contacted"
          ? "Contacted but stale"
          : "Lead untouched for too long";
      const action = lead.approvedNeverContacted
        ? "Send the approved preview"
        : lead.replyStatus === "contacted"
          ? "Try a second touch or phone outreach"
          : "Re-open with a fresh preview angle";
      summary.reactivationQueue.push({
        id: lead.id,
        businessName: lead.businessName,
        reason,
        suggestedAction: action,
        daysSinceLastTouch: lead.daysSinceLastTouch,
      });
    }
  }

  summary.latestGeneratedPreviews.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  summary.latestGeneratedPreviews = summary.latestGeneratedPreviews.slice(0, 10);
  summary.recentReplies.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  summary.recentReplies = summary.recentReplies.slice(0, 5);
  summary.recentWins.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  summary.recentWins = summary.recentWins.slice(0, 5);
  summary.operatorAnalytics.totalContacted = summary.leadsContacted;
  summary.operatorAnalytics.totalReplies = summary.leadsReplied;
  summary.operatorAnalytics.totalWon = summary.leadsWon;
  summary.operatorAnalytics.winRate = summary.leadsContacted
    ? Math.round((summary.leadsWon / summary.leadsContacted) * 100)
    : 0;
  summary.operatorAnalytics.outreachConversion = summary.leadsContacted
    ? Math.round((summary.leadsReplied / summary.leadsContacted) * 100)
    : 0;
  summary.operatorAnalytics.previewsApprovedRate = summary.operatorAnalytics.totalGeneratedPreviews
    ? Math.round(
        (summary.operatorAnalytics.totalApprovedPreviews /
          summary.operatorAnalytics.totalGeneratedPreviews) *
          100
      )
    : 0;
  summary.performanceIntelligence.bestNiches = finalizeMetricMap(nicheMetrics);
  summary.performanceIntelligence.bestCities = finalizeMetricMap(cityMetrics);
  summary.performanceIntelligence.outreachToReplyConversion = summary.operatorAnalytics.outreachConversion;
  summary.performanceIntelligence.replyToCloseConversion = summary.leadsReplied
    ? Math.round((summary.leadsWon / summary.leadsReplied) * 100)
    : 0;
  summary.performanceIntelligence.previewApprovalRate = summary.operatorAnalytics.previewsApprovedRate;
  summary.performanceIntelligence.followUpEffectiveness = followUpsTotal
    ? Math.round((followUpsWithReply / followUpsTotal) * 100)
    : 0;
  summary.performanceIntelligence.averageTouchesBeforeReply = repliedWithTouchCount
    ? Math.round((touchesBeforeReplyTotal / repliedWithTouchCount) * 10) / 10
    : 0;
  summary.performanceIntelligence.averageTimeToCloseDays = closedWithTimeCount
    ? Math.round((timeToCloseTotal / closedWithTimeCount) * 10) / 10
    : 0;
  summary.performanceIntelligence.operatorThroughputPerDay = touchedToday;
  summary.performanceIntelligence.trendCards = [
    { label: "Reply Rate", value: `${summary.performanceIntelligence.outreachToReplyConversion}%` },
    { label: "Close Rate After Reply", value: `${summary.performanceIntelligence.replyToCloseConversion}%` },
    { label: "Follow-Up Effectiveness", value: `${summary.performanceIntelligence.followUpEffectiveness}%` },
    { label: "Throughput Today", value: touchedToday },
  ];
  summary.dealPipeline.likelyClosesThisWeek.sort(
    (a, b) => (b.closeProbability ?? 0) - (a.closeProbability ?? 0)
  );
  summary.dealPipeline.likelyClosesThisWeek = summary.dealPipeline.likelyClosesThisWeek.slice(0, 5);
  summary.reactivationQueue.sort(
    (a, b) => (Number(b.daysSinceLastTouch) || 0) - (Number(a.daysSinceLastTouch) || 0)
  );
  summary.reactivationQueue = summary.reactivationQueue.slice(0, 12);

  const actionCandidates = [
    {
      label: `${summary.approvedAwaitingContact} approved previews need outreach`,
      count: summary.approvedAwaitingContact,
      route: "/outreach",
    },
    {
      label: `${summary.overdueFollowUps} follow-ups overdue`,
      count: summary.overdueFollowUps,
      route: "/outreach",
    },
    {
      label: `${summary.outreachDueToday} follow-ups due today`,
      count: summary.outreachDueToday,
      route: "/outreach",
    },
    {
      label: `${summary.recentReplies.length} hot leads replied recently`,
      count: summary.recentReplies.length,
      route: "/outreach",
    },
    {
      label: `${summary.leadsNeedingPreviews} leads need previews`,
      count: summary.leadsNeedingPreviews,
      route: "/mission-control",
    },
  ];
  summary.nextBestActions = actionCandidates.filter((item) => item.count > 0).slice(0, 6);
  const missionCards = [
    {
      id: "first-outreach",
      title: `${firstOutreachNeeded} leads need first outreach`,
      count: firstOutreachNeeded,
      urgency: firstOutreachNeeded >= 10 ? "critical" : firstOutreachNeeded > 0 ? "high" : "clear",
      route: "/outreach",
      actionLabel: "Work Ready Now",
    },
    {
      id: "overdue-followups",
      title: `${summary.overdueFollowUps} follow-ups overdue`,
      count: summary.overdueFollowUps,
      urgency: summary.overdueFollowUps > 0 ? "critical" : "clear",
      route: "/outreach",
      actionLabel: "Open Follow-Ups",
    },
    {
      id: "hot-replies",
      title: `${hotReplies} hot leads replied today`,
      count: hotReplies,
      urgency: hotReplies > 0 ? "high" : "clear",
      route: "/outreach",
      actionLabel: "Open Hot Leads",
    },
    {
      id: "previews-needed",
      title: `${summary.leadsNeedingPreviews} leads need previews`,
      count: summary.leadsNeedingPreviews,
      urgency: summary.leadsNeedingPreviews > 5 ? "medium" : "low",
      route: "/mission-control",
      actionLabel: "Build Previews",
    },
  ];
  summary.dailyMission.cards = missionCards;
  summary.dailyMission.progress.totalToday = missionCards.reduce((total, card) => total + card.count, 0);
  summary.dailyMission.progress.completedToday =
    summary.operatorAnalytics.contactedToday + summary.operatorAnalytics.followUpsCompletedToday;
  summary.dailyMission.progress.percent = summary.dailyMission.progress.totalToday
    ? Math.min(
        100,
        Math.round(
          (summary.dailyMission.progress.completedToday / summary.dailyMission.progress.totalToday) * 100
        )
      )
    : 100;
  return summary;
}
