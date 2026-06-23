import { nowIso } from "../../src/stage1/shared.js";
import { buildQueueItem } from "../../src/schema/queue-item.js";
import { WEBSITE_QUEUE_TO_STATE, PW_QUEUE_TO_STATE } from "./status-maps.js";
import { findLegacyEntries, legacyRecordForCampaign } from "./legacy-lookup.js";

export function migrateQueueItems({
  opportunities,
  legacyMeta,
  idMap,
  campaigns,
  offerById,
}) {
  const queueItems = [];
  const skipped = [];
  const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]));

  for (const opportunity of opportunities) {
    const campaign = campaignById[opportunity.campaignId];
    if (!campaign) continue;

    const legacyEntries = findLegacyEntries(opportunity.businessId, idMap, legacyMeta);
    const legacyPick = legacyRecordForCampaign({ ...legacyEntries, campaign, offerById });
    if (!legacyPick) continue;

    const record = legacyPick.record;
    let queueState = null;
    let promotedAt = null;
    let dueAt = null;

    if (legacyPick.source === "pressure-washing" && record.queueState) {
      queueState = PW_QUEUE_TO_STATE[record.queueState] ?? null;
      promotedAt = record.addedToQueueAt ?? record.updatedAt ?? null;
      dueAt = record.nextFollowUpAt ?? null;
    } else if (legacyPick.source === "qualified-businesses" && record.websiteQueueState) {
      queueState = WEBSITE_QUEUE_TO_STATE[record.websiteQueueState] ?? null;
      promotedAt = record.websiteQueuePromotedAt ?? null;
      dueAt = record.nextFollowUpAt ?? null;
    }

    if (!queueState) continue;

    queueItems.push(
      buildQueueItem({
        opportunityId: opportunity.id,
        campaignId: opportunity.campaignId,
        businessId: opportunity.businessId,
        state: queueState,
        priority: opportunity.score ?? 0,
        priorityLabel: opportunity.priorityLabel,
        offer: opportunity.offer,
        buyer: opportunity.buyer,
        region: opportunity.region,
        channel: opportunity.channel,
        recommendedAngle: opportunity.recommendedAngle,
        recommendedScript: opportunity.recommendedScript,
        dueAt,
        promotedAt,
        assignedOperatorId: opportunity.assignedOperatorId,
        createdAt: promotedAt ?? nowIso(),
        updatedAt: nowIso(),
      }),
    );
  }

  for (const [legacyId, record] of Object.entries(legacyMeta.qualified)) {
    if (!record.websiteQueueState) continue;
    const businessId = idMap[legacyId]?.businessId;
    if (!businessId) continue;
    const hasOpp = opportunities.some((o) => o.businessId === businessId);
    if (!hasOpp) {
      skipped.push({
        type: "skipped_queue:no_opportunity",
        legacyId,
        websiteQueueState: record.websiteQueueState,
      });
    }
  }

  return { queueItems, skipped };
}
