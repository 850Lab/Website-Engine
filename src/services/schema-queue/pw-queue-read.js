import { cleanText } from "../../stage1/shared.js";
import { getFocus } from "../../outreach-focus/store.js";
import { filterLeadsToFocus, sortLeadsByFocus } from "../../outreach-focus/store.js";
import { isFollowUpDue } from "../../pressure-washing/queue-state.js";
import {
  getNextPwLeadId,
  mergePwLeadActions,
} from "../../pressure-washing/lead-store.js";
import { buildFocusQueueMeta } from "../../outreach-focus/metrics.js";
import { buildPwQueueHealth } from "../../pressure-washing/lead-store.js";
import { getCampaignByOfferSlug } from "../campaigns.js";
import { listBusinesses } from "../businesses.js";
import { listContacts } from "../contacts.js";
import { listOpportunities } from "../opportunities.js";
import { listQueueItems } from "../queue-items.js";
import { listAttempts } from "../attempts.js";
import { sortPwQueueRowsAsync } from "../queue-sort.js";
import { SCHEMA_TO_PW_QUEUE } from "../dual-read/compare-queues.js";

function mapSchemaStateToPwQueueState(schemaState) {
  return SCHEMA_TO_PW_QUEUE[schemaState] ?? schemaState;
}

function isVisiblePwQueueItem(item, opportunity) {
  const queueState = mapSchemaStateToPwQueueState(item.state);
  if (queueState === "active") return true;
  if (queueState === "follow_up") {
    const dueAt = item.dueAt ?? opportunity?.nextFollowUpAt;
    if (!dueAt) return false;
    return isFollowUpDue({ nextFollowUpAt: dueAt });
  }
  return false;
}

function mapOutreachStatusToPwStatus(outreachStatus) {
  const status = cleanText(outreachStatus).toLowerCase();
  if (!status || status === "not_contacted") return "new";
  return status.replace(/\s+/g, "_");
}

function buildPwLeadShape({ business, contact, opportunity, queueItem, attempts }) {
  const phone = contact?.value ?? "";
  const normalizedPhone = contact?.normalizedValue ?? phone;
  const notes = attempts
    .filter((row) => row.notes)
    .map((row) => ({
      at: row.at,
      text: String(row.notes).replace(/^\[[^\]]+\]\s*/, ""),
    }));

  const queueState = mapSchemaStateToPwQueueState(queueItem.state);

  return {
    id: business.legacyId,
    businessName: business.name,
    industry: business.industry,
    address: business.address,
    city: business.city,
    phone,
    normalizedPhone,
    website: business.website,
    googleMapsUrl: business.source?.legacy?.googleMapsUrl ?? null,
    googleRating: business.signals?.rating ?? 0,
    reviewCount: business.signals?.reviewCount ?? 0,
    pressureWashingAngle: opportunity.recommendedAngle,
    openingLine: opportunity.recommendedScript,
    offer: opportunity.recommendedOffer,
    priorityScore: opportunity.score ?? queueItem.priority ?? 0,
    status: mapOutreachStatusToPwStatus(opportunity.outreachStatus),
    queueState,
    nextFollowUpAt: queueItem.dueAt ?? opportunity.nextFollowUpAt ?? null,
    lastContactedAt: opportunity.lastContactedAt ?? null,
    notes,
    flags: {
      hasDriveThru: business.tags?.includes("hasDriveThru") ?? false,
      hasOutdoorSeating: business.tags?.includes("hasOutdoorSeating") ?? false,
      dumpsterPadLikely: business.tags?.includes("dumpsterPadLikely") ?? true,
      curbAppealIssue: business.tags?.includes("curbAppealIssue") ?? false,
    },
    callable: Boolean(normalizedPhone || phone),
    discoveredAt: business.createdAt,
    createdAt: business.createdAt,
    updatedAt: queueItem.updatedAt,
    batchRank: 0,
  };
}

export async function buildSchemaPwQueueLeads(focus) {
  const campaign = await getCampaignByOfferSlug("pressure-washing");
  if (!campaign) return [];

  const [items, businesses, contacts, opportunities, attempts] = await Promise.all([
    listQueueItems({ campaignId: campaign.id, states: ["active", "follow_up"] }),
    listBusinesses(),
    listContacts(),
    listOpportunities({ campaignId: campaign.id }),
    listAttempts({ campaignId: campaign.id }),
  ]);

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
    if (!isVisiblePwQueueItem(item, opportunity)) continue;

    const primaryPhone =
      (contactsByBusiness[business.id] ?? []).find((c) => c.type === "phone" && c.isPrimary) ??
      (contactsByBusiness[business.id] ?? []).find((c) => c.type === "phone");

    const lead = buildPwLeadShape({
      business,
      contact: primaryPhone,
      opportunity,
      queueItem: item,
      attempts: attemptsByOpportunity[item.opportunityId] ?? [],
    });

    rows.push({
      lead,
      sortMeta: {
        legacyId: business.legacyId,
        status: lead.status,
        nextFollowUpAt: lead.nextFollowUpAt,
        discoveredAt: lead.discoveredAt,
        createdAt: lead.createdAt,
        batchRank: lead.batchRank,
        priorityScore: lead.priorityScore,
        followUpDue: isFollowUpDue(lead),
        isFollowUpDue: isFollowUpDue(lead),
        businessName: lead.businessName,
      },
    });
  }

  const sortedMeta = await sortPwQueueRowsAsync(
    rows.map((row) => row.sortMeta),
    focus,
  );
  const rowByLegacyId = Object.fromEntries(rows.map((row) => [row.lead.id, row.lead]));
  return sortedMeta.map((meta) => rowByLegacyId[meta.legacyId]).filter(Boolean);
}

export async function buildSchemaPwQueueResponse(leadId = null, { view = "" } = {}) {
  const {
    buildPwQueueDailyMetrics,
    buildPwQueueStats,
    filterQueueByView,
    formatPwLeadForQueue,
  } = await import("../../pressure-washing/metrics.js");

  const focus = await getFocus("pressure-washing");
  const fullQueueRaw = await buildSchemaPwQueueLeads(focus);
  const focusedQueue = focus ? filterLeadsToFocus(fullQueueRaw, focus) : fullQueueRaw;
  const fullQueue = focus ? sortLeadsByFocus(focusedQueue, focus) : focusedQueue;
  const queue = filterQueueByView(fullQueue, view);
  const health = await buildPwQueueHealth();
  const nextBestId = queue[0]?.id ?? null;

  let record = null;
  if (leadId) {
    record = queue.find((l) => l.id === cleanText(leadId)) ?? null;
  } else {
    record = queue[0] ?? null;
  }

  if (!record) {
    const focusQueue = await buildFocusQueueMeta("pressure-washing");
    return {
      lead: null,
      nextId: null,
      stats: await buildPwQueueStats(),
      daily: await buildPwQueueDailyMetrics(),
      health,
      view: cleanText(view) || null,
      focus: focusQueue,
    };
  }

  const displayRecord = queue.some((l) => l.id === record.id) ? record : queue[0] ?? record;
  const nextId = getNextPwLeadId(queue, displayRecord.id);
  const focusQueue = await buildFocusQueueMeta("pressure-washing");

  return {
    lead: formatPwLeadForQueue(displayRecord, {
      isNextBestLead: displayRecord.id === nextBestId,
      focus,
    }),
    nextId,
    stats: await buildPwQueueStats(),
    daily: await buildPwQueueDailyMetrics(),
    health,
    view: cleanText(view) || null,
    focus: focusQueue,
  };
}
