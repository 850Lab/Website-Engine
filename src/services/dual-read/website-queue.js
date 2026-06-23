import { cleanText } from "../../stage1/shared.js";
import { buildSalesQueue } from "../../mission-control/sales-queue.js";
import { getFocus } from "../../outreach-focus/store.js";
import { listQualifiedBusinesses } from "../../stage1/qualified-business-store.js";
import { inferWebsiteQueueStateFromRecord } from "./legacy-helpers.js";
import { getCampaignByOfferSlug } from "../campaigns.js";
import { buildSchemaSalesQueue } from "../schema-queue/website-queue-read.js";
import { logWebsiteQueueDualReadDiag } from "../schema-queue/website-queue-diagnostics.js";
import { compareQueueSnapshots, SCHEMA_TO_WEBSITE_QUEUE } from "./compare-queues.js";
import { listQueueItems } from "../queue-items.js";
import { listBusinesses } from "../businesses.js";

function mockRequest() {
  return {
    protocol: "http",
    headers: { host: "localhost" },
    get(name) {
      return name.toLowerCase() === "host" ? "localhost" : undefined;
    },
  };
}

export async function readLegacyWebsiteQueue({ requestId = null } = {}) {
  const focus = await getFocus("website").catch(() => null);
  const req = mockRequest();
  const [leads, records] = await Promise.all([
    buildSalesQueue(
      req,
      {
        focusOnly: true,
        phoneOnly: true,
        excludeTwilioTest: true,
        excludeClosed: false,
      },
      null,
      { forceLegacy: true, requestId, diagRole: "dual-read-parity" },
    ),
    listQualifiedBusinesses(),
  ]);
  const recordById = Object.fromEntries(records.map((row) => [row.id, row]));

  return {
    focus: focus
      ? {
          mode: focus.mode,
          industry: focus.industry,
          city: focus.city,
          offer: focus.offer,
        }
      : null,
    entries: leads.map((lead) => {
      const source = recordById[lead.id] ?? {};
      return {
        legacyId: lead.id,
        id: lead.id,
        queueState: inferWebsiteQueueStateFromRecord(source),
        outreachStatus: cleanText(lead.outreachStatus) || "not_contacted",
        priorityLabel: lead.priorityLabel,
        priorityScore: lead.priorityScore,
        businessName: lead.businessName,
        industry: lead.industry,
        city: lead.city,
      };
    }),
  };
}

export async function readSchemaWebsiteQueue({ requestId = null } = {}) {
  const campaign = await getCampaignByOfferSlug("website");
  if (!campaign) {
    return { campaignId: null, entries: [] };
  }

  const req = mockRequest();
  const [leads, items, businesses, records] = await Promise.all([
    buildSchemaSalesQueue(req, {
      focusOnly: true,
      phoneOnly: true,
      excludeTwilioTest: true,
      excludeClosed: false,
    }),
    listQueueItems({ campaignId: campaign.id, states: ["active", "follow_up"] }),
    listBusinesses(),
    listQualifiedBusinesses(),
  ]);

  logWebsiteQueueDualReadDiag({
    requestId,
    dualReadSource: "schema",
    queueCount: leads.length,
    servedToUser: false,
  });

  const businessById = Object.fromEntries(businesses.map((row) => [row.id, row]));
  const itemByBusinessId = Object.fromEntries(items.map((row) => [row.businessId, row]));
  const recordById = Object.fromEntries(records.map((row) => [row.id, row]));

  const entries = leads.map((lead) => {
    const business = Object.values(businessById).find((row) => row.legacyId === lead.id);
    const item = business ? itemByBusinessId[business.id] : null;
    const legacyRecord = recordById[lead.id] ?? {};
    return {
      legacyId: lead.id,
      id: lead.id,
      queueState: item
        ? SCHEMA_TO_WEBSITE_QUEUE[item.state] ?? item.state
        : inferWebsiteQueueStateFromRecord(legacyRecord),
      outreachStatus: lead.outreachStatus,
      priorityLabel: lead.priorityLabel,
      priorityScore: lead.priorityScore,
      businessName: lead.businessName,
      industry: lead.industry,
      city: lead.city,
      schemaQueueItemId: item?.id ?? null,
    };
  });

  return {
    campaignId: campaign.id,
    entries,
  };
}

export async function compareWebsiteQueues({ requestId = null } = {}) {
  const [legacy, schema] = await Promise.all([
    readLegacyWebsiteQueue({ requestId }),
    readSchemaWebsiteQueue({ requestId }),
  ]);
  const comparison = compareQueueSnapshots({
    label: "website-call-queue",
    legacyEntries: legacy.entries,
    schemaEntries: schema.entries,
    sortSchemaEntries: (rows) => rows,
  });

  return {
    queue: "website",
    campaignId: schema.campaignId,
    focus: legacy.focus,
    legacy,
    schema,
    comparison,
  };
}
