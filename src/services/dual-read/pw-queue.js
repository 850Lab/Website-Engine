import { cleanText } from "../../stage1/shared.js";
import { getActiveQueueLeads } from "../../pressure-washing/lead-store.js";
import { getFocus } from "../../outreach-focus/store.js";
import { filterLeadsToFocus, sortLeadsByFocus } from "../../outreach-focus/routes.js";
import { getCampaignByOfferSlug } from "../campaigns.js";
import { listBusinesses } from "../businesses.js";
import { listOpportunities } from "../opportunities.js";
import { listQueueItems } from "../queue-items.js";
import { compareQueueSnapshots, SCHEMA_TO_PW_QUEUE } from "./compare-queues.js";
import { sortPwQueueRowsAsync } from "../queue-sort.js";
import { isFollowUpDue } from "../../pressure-washing/queue-state.js";

export async function readLegacyPwQueue() {
  const focus = await getFocus("pressure-washing").catch(() => null);
  const raw = await getActiveQueueLeads(focus);
  const focused = focus ? filterLeadsToFocus(raw, focus) : raw;
  const queue = focus ? sortLeadsByFocus(focused, focus) : focused;

  return {
    focus: focus
      ? {
          mode: focus.mode,
          industry: focus.industry,
          city: focus.city,
          offer: focus.offer,
        }
      : null,
    entries: queue.map((lead) => ({
      legacyId: lead.id,
      queueState: cleanText(lead.queueState) || "active",
      status: cleanText(lead.status) || "new",
      priorityScore: lead.priorityScore,
    })),
  };
}

export async function readSchemaPwQueue() {
  const campaign = await getCampaignByOfferSlug("pressure-washing");
  if (!campaign) {
    return { campaignId: null, entries: [] };
  }

  const [items, businesses, opportunities] = await Promise.all([
    listQueueItems({ campaignId: campaign.id, states: ["active", "follow_up"] }),
    listBusinesses(),
    listOpportunities({ campaignId: campaign.id }),
  ]);
  const businessById = Object.fromEntries(businesses.map((row) => [row.id, row]));
  const opportunityById = Object.fromEntries(opportunities.map((row) => [row.id, row]));

  const entries = items
    .map((item) => {
      const business = businessById[item.businessId];
      const opportunity = opportunityById[item.opportunityId];
      const nextFollowUpAt = item.dueAt ?? opportunity?.nextFollowUpAt ?? null;
      const status = cleanText(opportunity?.outreachStatus).toLowerCase().replace(/\s+/g, "_") || "new";
      return {
        schemaQueueItemId: item.id,
        legacyId: business?.legacyId ?? null,
        businessId: item.businessId,
        queueState: SCHEMA_TO_PW_QUEUE[item.state] ?? item.state,
        schemaState: item.state,
        priorityLabel: item.priorityLabel ?? opportunity?.priorityLabel,
        priorityScore: opportunity?.score ?? item.priority ?? 0,
        priority: opportunity?.score ?? item.priority ?? 0,
        status: status === "not_contacted" ? "new" : status,
        nextFollowUpAt,
        discoveredAt: business?.createdAt ?? null,
        createdAt: business?.createdAt ?? null,
        batchRank: 0,
        followUpDue: isFollowUpDue({ nextFollowUpAt }),
        isFollowUpDue: isFollowUpDue({ nextFollowUpAt }),
        businessName: business?.name ?? null,
      };
    })
    .filter((row) => row.legacyId);

  const focus = await getFocus("pressure-washing").catch(() => null);
  const sorted = await sortPwQueueRowsAsync(entries, focus);

  return {
    campaignId: campaign.id,
    entries: sorted,
  };
}

export async function comparePwQueues() {
  const [legacy, schema] = await Promise.all([readLegacyPwQueue(), readSchemaPwQueue()]);
  const focus = legacy.focus ? await getFocus("pressure-washing").catch(() => null) : null;
  const sortedSchemaEntries = await sortPwQueueRowsAsync(schema.entries, focus);
  const comparison = compareQueueSnapshots({
    label: "pressure-washing-queue",
    legacyEntries: legacy.entries,
    schemaEntries: sortedSchemaEntries,
    sortSchemaEntries: (rows) => rows,
  });

  return {
    queue: "pressure-washing",
    campaignId: schema.campaignId,
    focus: legacy.focus,
    legacy,
    schema,
    comparison,
  };
}
