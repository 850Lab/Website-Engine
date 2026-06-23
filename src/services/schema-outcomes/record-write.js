import { cleanText, nowIso } from "../../stage1/shared.js";
import { useSchemaOutcomeWrites } from "../feature-flags.js";
import { getCampaignByOfferSlug } from "../campaigns.js";
import { getBusiness } from "../businesses.js";
import { getOpportunity, saveOpportunity } from "../opportunities.js";
import { listContactsForBusiness } from "../contacts.js";
import { saveQueueItem, getOpenQueueItemForOpportunity } from "../queue-items.js";
import { listAttempts, saveAttempt } from "../attempts.js";
import {
  resolveLegacyToBusinessId,
  resolveLegacyToOpportunityId,
} from "../id-bridge.js";
import {
  resolveOutcomeMapping,
  mapWebsiteOutreachToQueueState,
  mapPwLegacyQueueToSchemaState,
  inferPwQueueStateFromPatch,
  mapPwStatusToOutreachStatus,
} from "../outcome-mapping.js";

function formatAttemptNotes(notes, legacySource) {
  const text = cleanText(notes);
  if (!text) return `[${legacySource}]`;
  return `[${legacySource}] ${text}`;
}

async function findDuplicateAttempt({ opportunityId, outcomeId, normalizedOutcome, notes, at }) {
  const attempts = await listAttempts({ opportunityId });
  const stamp = Date.parse(at);
  return (
    attempts.find((row) => {
      if (row.outcomeId !== outcomeId) return false;
      if (row.normalizedOutcome !== normalizedOutcome) return false;
      const rowNotes = cleanText(row.notes);
      const expectedNotes = cleanText(notes);
      if (expectedNotes && rowNotes !== expectedNotes) return false;
      if (!expectedNotes && rowNotes && !rowNotes.startsWith("[")) return false;
      const delta = Math.abs(Date.parse(row.at) - stamp);
      return delta <= 5000;
    }) ?? null
  );
}

async function appendSchemaAttempt({
  opportunity,
  campaign,
  business,
  contactId,
  operator,
  outcomeId,
  normalizedOutcome,
  notes,
  legacySource,
  at,
}) {
  const stamp = at || nowIso();
  const formattedNotes = notes != null ? formatAttemptNotes(notes, legacySource) : formatAttemptNotes("", legacySource);

  const duplicate = await findDuplicateAttempt({
    opportunityId: opportunity.id,
    outcomeId,
    normalizedOutcome,
    notes: formattedNotes,
    at: stamp,
  });
  if (duplicate) return { attempt: duplicate, duplicate: true };

  const attempt = await saveAttempt({
    opportunityId: opportunity.id,
    campaignId: campaign.id,
    businessId: business.id,
    contactId,
    operatorId: operator?.id || "legacy_migration",
    channel: opportunity.channel,
    outcomeId,
    normalizedOutcome,
    notes: formattedNotes,
    offerId: opportunity.offerId,
    offer: opportunity.offer,
    buyer: campaign.buyer,
    region: opportunity.region,
    campaignChannel: campaign.channel,
    campaignConfigVersion: campaign.configVersion,
    at: stamp,
  });

  console.info(
    `[schema-outcome-write] attempt=${attempt.id} opportunity=${opportunity.id} outcome=${outcomeId}`,
  );

  return { attempt, duplicate: false };
}

async function loadWriteContext(legacyId, offerSlug) {
  const campaign = await getCampaignByOfferSlug(offerSlug);
  if (!campaign) {
    throw new Error(`Schema campaign not found for offer slug: ${offerSlug}`);
  }

  const businessId = await resolveLegacyToBusinessId(legacyId);
  if (!businessId) {
    throw new Error(`Schema business not found for legacy id: ${legacyId}`);
  }

  const opportunityId = await resolveLegacyToOpportunityId(legacyId, campaign.id);
  if (!opportunityId) {
    throw new Error(`Schema opportunity not found for legacy id: ${legacyId}`);
  }

  const [business, opportunity, contacts] = await Promise.all([
    getBusiness(businessId),
    getOpportunity(opportunityId),
    listContactsForBusiness(businessId),
  ]);

  if (!business || !opportunity) {
    throw new Error(`Schema context incomplete for legacy id: ${legacyId}`);
  }

  const contact =
    contacts.find((row) => row.type === "phone" && row.isPrimary) ??
    contacts.find((row) => row.type === "phone") ??
    null;

  const queueItem = await getOpenQueueItemForOpportunity(opportunity.id);

  return { campaign, business, opportunity, contact, queueItem };
}

function closedFieldsFromOutreach(outreachStatus) {
  if (outreachStatus === "won") {
    return { status: "closed", closedAt: nowIso(), closedReason: "won" };
  }
  if (outreachStatus === "lost" || outreachStatus === "not_interested") {
    return { status: "closed", closedAt: nowIso(), closedReason: outreachStatus };
  }
  return {};
}

async function updateSchemaOpportunityAndQueue({
  opportunity,
  campaign,
  queueItem,
  outreachStatus,
  queueState,
  nextFollowUpAt,
  assignedOperatorId,
}) {
  const updatedOpportunity = await saveOpportunity({
    ...opportunity,
    outreachStatus,
    lastContactedAt: nowIso(),
    nextFollowUpAt: nextFollowUpAt ?? opportunity.nextFollowUpAt,
    assignedOperatorId: assignedOperatorId ?? opportunity.assignedOperatorId,
    ...closedFieldsFromOutreach(outreachStatus),
  });

  let updatedQueueItem = null;
  if (queueItem && queueState) {
    updatedQueueItem = await saveQueueItem({
      ...queueItem,
      state: queueState,
      dueAt: nextFollowUpAt ?? queueItem.dueAt,
      assignedOperatorId: assignedOperatorId ?? queueItem.assignedOperatorId,
    });
  }

  return { opportunity: updatedOpportunity, queueItem: updatedQueueItem };
}

export async function recordWebsiteOutcomeWrite({ legacyId, status, operator = null }) {
  if (!useSchemaOutcomeWrites()) return null;

  const outreachStatus = cleanText(status).toLowerCase().replace(/\s+/g, "_");
  const ctx = await loadWriteContext(legacyId, "website");
  const mapping = resolveOutcomeMapping(ctx.campaign, {
    outcomeKey: outreachStatus,
    channel: "website",
  });

  let attemptResult = null;
  if (mapping) {
    attemptResult = await appendSchemaAttempt({
      ...ctx,
      contactId: ctx.contact?.id ?? null,
      operator,
      outcomeId: mapping.outcomeId,
      normalizedOutcome: mapping.normalizedOutcome,
      legacySource: "mission-control.sales.outcome",
    });
  }

  const queueState = mapWebsiteOutreachToQueueState(outreachStatus);
  const updated = await updateSchemaOpportunityAndQueue({
    ...ctx,
    outreachStatus,
    queueState,
    assignedOperatorId: operator?.id ?? null,
  });

  return {
    legacyId,
    attempt: attemptResult?.attempt ?? null,
    duplicateAttempt: attemptResult?.duplicate ?? false,
    opportunity: updated.opportunity,
    queueItem: updated.queueItem,
  };
}

export async function recordWebsiteNoteWrite({ legacyId, text, operator = null }) {
  if (!useSchemaOutcomeWrites()) return null;

  const ctx = await loadWriteContext(legacyId, "website");
  const attemptResult = await appendSchemaAttempt({
    ...ctx,
    contactId: ctx.contact?.id ?? null,
    operator,
    outcomeId: "note",
    normalizedOutcome: "conversation",
    notes: text,
    legacySource: "mission-control.sales.note",
  });

  return {
    legacyId,
    attempt: attemptResult.attempt,
    duplicateAttempt: attemptResult.duplicate,
    opportunity: ctx.opportunity,
    queueItem: ctx.queueItem,
  };
}

export async function recordPwStatusWrite({ legacyId, patch = {}, operator = null }) {
  if (!useSchemaOutcomeWrites()) return null;

  const status = cleanText(patch.status).toLowerCase().replace(/\s+/g, "_");
  const actionId = cleanText(patch.actionId).toLowerCase().replace(/\s+/g, "_");
  const outcomeKey = actionId || status;
  const ctx = await loadWriteContext(legacyId, "pressure-washing");

  const mapping = resolveOutcomeMapping(ctx.campaign, {
    outcomeKey,
    channel: "pressure-washing",
  });

  let attemptResult = null;
  if (mapping) {
    attemptResult = await appendSchemaAttempt({
      ...ctx,
      contactId: ctx.contact?.id ?? null,
      operator,
      outcomeId: mapping.outcomeId,
      normalizedOutcome: mapping.normalizedOutcome,
      legacySource: "pressure-washing.status",
    });
  }

  const legacyQueueState = inferPwQueueStateFromPatch({
    actionId,
    status,
    callAttempts: patch.callAttempts ?? 0,
  });
  const queueState = mapPwLegacyQueueToSchemaState(legacyQueueState);
  const outreachStatus = mapPwStatusToOutreachStatus(status);

  const updated = await updateSchemaOpportunityAndQueue({
    ...ctx,
    outreachStatus,
    queueState,
    nextFollowUpAt: patch.nextFollowUpAt ?? null,
    assignedOperatorId: operator?.id ?? null,
  });

  return {
    legacyId,
    attempt: attemptResult?.attempt ?? null,
    duplicateAttempt: attemptResult?.duplicate ?? false,
    opportunity: updated.opportunity,
    queueItem: updated.queueItem,
  };
}

export async function recordPwNoteWrite({ legacyId, text, kind = "notes", operator = null }) {
  if (!useSchemaOutcomeWrites()) return null;

  const ctx = await loadWriteContext(legacyId, "pressure-washing");
  const attemptResult = await appendSchemaAttempt({
    ...ctx,
    contactId: ctx.contact?.id ?? null,
    operator,
    outcomeId: "note",
    normalizedOutcome: "conversation",
    notes: kind === "notes" ? text : `[${kind}] ${text}`,
    legacySource: "pressure-washing.notes",
  });

  return {
    legacyId,
    attempt: attemptResult.attempt,
    duplicateAttempt: attemptResult.duplicate,
    opportunity: ctx.opportunity,
    queueItem: ctx.queueItem,
  };
}

export async function getSchemaWriteSnapshot(legacyId, offerSlug) {
  const ctx = await loadWriteContext(legacyId, offerSlug);
  const attempts = await listAttempts({ opportunityId: ctx.opportunity.id });
  return {
    legacyId,
    campaignId: ctx.campaign.id,
    opportunityId: ctx.opportunity.id,
    queueItemId: ctx.queueItem?.id ?? null,
    outreachStatus: ctx.opportunity.outreachStatus,
    queueState: ctx.queueItem?.state ?? null,
    attemptCount: attempts.length,
  };
}
