import { cleanText, nowIso } from "../../src/stage1/shared.js";
import { buildAttempt } from "../../src/schema/attempt.js";
import { newAttemptId } from "../../src/schema/ids.js";
import {
  FOCUS_EVENT_TO_ATTEMPT,
  PW_STATUS_TO_ATTEMPT,
  WEBSITE_OUTREACH_TO_ATTEMPT,
} from "./status-maps.js";
import { resolveCampaignFromFocusEvent } from "./load-seeds.js";
import { findLegacyEntries, legacyRecordForCampaign } from "./legacy-lookup.js";

function pickOpportunityForCampaign(opportunities, campaignId, businessId) {
  return opportunities.find(
    (o) => o.campaignId === campaignId && o.businessId === businessId,
  );
}

function buildAttemptRow({
  opportunity,
  campaign,
  offer,
  contactId,
  operatorId,
  outcomeId,
  normalizedOutcome,
  at,
  notes,
  durationSeconds,
  recordingUrl,
  legacySource,
}) {
  return buildAttempt({
    id: newAttemptId(),
    opportunityId: opportunity.id,
    campaignId: opportunity.campaignId,
    businessId: opportunity.businessId,
    contactId,
    operatorId: operatorId || "legacy_migration",
    channel: opportunity.channel,
    outcomeId: outcomeId || "legacy",
    normalizedOutcome: normalizedOutcome || "attempted",
    notes: notes ? `[${legacySource}] ${notes}` : `[${legacySource}]`,
    durationSeconds,
    recordingUrl,
    offerId: offer.id,
    offer: offer.name,
    buyer: campaign.buyer,
    region: opportunity.region,
    campaignChannel: campaign.channel,
    campaignConfigVersion: campaign.configVersion,
    businessIndustry: null,
    at: at || nowIso(),
  });
}

function attemptKey(opportunityId, at, normalizedOutcome) {
  return `${opportunityId}|${at}|${normalizedOutcome}`;
}

export function migrateAttempts({
  opportunities,
  campaigns,
  offerById,
  contacts,
  legacyMeta,
  idMap,
  legacy,
}) {
  const attempts = [];
  const seen = new Set();
  const warnings = [];
  const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]));
  const contactsByBusiness = contacts.reduce((acc, c) => {
    if (!acc[c.businessId]) acc[c.businessId] = [];
    acc[c.businessId].push(c);
    return acc;
  }, {});

  function pushAttempt(row) {
    const key = attemptKey(row.opportunityId, row.at, row.normalizedOutcome);
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push(row);
  }

  for (const opportunity of opportunities) {
    const campaign = campaignById[opportunity.campaignId];
    const offer = offerById[campaign?.offerId];
    if (!campaign || !offer) continue;

    const legacyEntries = findLegacyEntries(opportunity.businessId, idMap, legacyMeta);
    const legacyPick = legacyRecordForCampaign({
      ...legacyEntries,
      campaign,
      offerById,
    });
    const primaryContact =
      (contactsByBusiness[opportunity.businessId] ?? []).find((c) => c.type === "phone") ?? null;

    if (legacyPick?.source === "qualified-businesses" && legacyPick.record) {
      const qb = legacyPick;
      const mapping = WEBSITE_OUTREACH_TO_ATTEMPT[cleanText(qb.record.outreachStatus).toLowerCase()];
      if (mapping) {
        pushAttempt(
          buildAttemptRow({
            opportunity,
            campaign,
            offer,
            contactId: primaryContact?.id ?? null,
            operatorId: qb.record.lastOperatorId ?? null,
            outcomeId: mapping.outcomeId,
            normalizedOutcome: mapping.normalizedOutcome,
            at: qb.record.outreachStatusUpdatedAt ?? qb.record.updatedAt,
            legacySource: "qualified-businesses.outreachStatus",
          }),
        );
      }

      for (const note of qb.record.salesNotes ?? []) {
        pushAttempt(
          buildAttemptRow({
            opportunity,
            campaign,
            offer,
            contactId: primaryContact?.id ?? null,
            operatorId: note.operatorId ?? null,
            outcomeId: "note",
            normalizedOutcome: "conversation",
            at: note.at ?? qb.record.updatedAt,
            notes: note.text,
            legacySource: "qualified-businesses.salesNotes",
          }),
        );
      }

      for (const call of qb.record.salesCalls ?? []) {
        pushAttempt(
          buildAttemptRow({
            opportunity,
            campaign,
            offer,
            contactId: primaryContact?.id ?? null,
            outcomeId: "called",
            normalizedOutcome: call.status === "completed" ? "attempted" : "attempted",
            at: call.completedAt ?? call.startedAt ?? nowIso(),
            durationSeconds: call.durationSec,
            recordingUrl: call.recordingUrl,
            legacySource: "qualified-businesses.salesCalls",
          }),
        );
      }
    }

    if (legacyPick?.source === "pressure-washing" && legacyPick.record) {
      const pw = legacyPick;
      const pwStatus = cleanText(pw.record.status).toLowerCase().replace(/\s+/g, "_");
      const mapping = PW_STATUS_TO_ATTEMPT[pwStatus];
      if (mapping) {
        pushAttempt(
          buildAttemptRow({
            opportunity,
            campaign,
            offer,
            contactId: primaryContact?.id ?? null,
            outcomeId: mapping.outcomeId,
            normalizedOutcome: mapping.normalizedOutcome,
            at: pw.record.lastContactedAt ?? pw.record.updatedAt,
            notes:
              pw.record.callAttempts > 1
                ? `legacy:callAttempts=${pw.record.callAttempts}`
                : null,
            legacySource: "pressure-washing.status",
          }),
        );
      }

      for (const note of pw.record.notes ?? []) {
        const text = typeof note === "string" ? note : note.text;
        const at = typeof note === "object" ? note.at : pw.record.updatedAt;
        pushAttempt(
          buildAttemptRow({
            opportunity,
            campaign,
            offer,
            contactId: primaryContact?.id ?? null,
            outcomeId: "note",
            normalizedOutcome: "conversation",
            at,
            notes: text,
            legacySource: "pressure-washing.notes",
          }),
        );
      }
    }
  }

  for (const event of legacy.outreachFocus?.events ?? []) {
    const legacyLeadId = cleanText(event.leadId);
    const businessId = idMap[legacyLeadId]?.businessId;
    if (!businessId) {
      warnings.push({ type: "focus_event_orphan", eventId: event.id, leadId: legacyLeadId });
      continue;
    }

    const campaign = resolveCampaignFromFocusEvent(event, campaigns);
    if (!campaign) {
      warnings.push({ type: "focus_event_no_campaign", eventId: event.id });
      continue;
    }

    const opportunity = pickOpportunityForCampaign(opportunities, campaign.id, businessId);
    if (!opportunity) {
      warnings.push({ type: "focus_event_no_opportunity", eventId: event.id, businessId });
      continue;
    }

    const mapping = FOCUS_EVENT_TO_ATTEMPT[event.type];
    if (!mapping) continue;

    pushAttempt(
      buildAttemptRow({
        opportunity,
        campaign,
        offer: offerById[campaign.offerId],
        outcomeId: mapping.outcomeId,
        normalizedOutcome: mapping.normalizedOutcome,
        at: event.at,
        notes: event.revenue != null ? `revenue=${event.revenue}` : null,
        legacySource: "outreach-focus.events",
      }),
    );
  }

  for (const session of Object.values(legacy.callSessions ?? {})) {
    const legacyBusinessId = cleanText(session.businessId);
    const businessId = idMap[legacyBusinessId]?.businessId;
    if (!businessId) {
      warnings.push({ type: "call_session_orphan", sessionId: session.id });
      continue;
    }

    const matchingOpps = opportunities.filter((o) => o.businessId === businessId);
    const opportunity = matchingOpps[0];
    if (!opportunity) {
      warnings.push({ type: "call_session_no_opportunity", sessionId: session.id });
      continue;
    }

    const campaign = campaignById[opportunity.campaignId];
    pushAttempt(
      buildAttemptRow({
        opportunity,
        campaign,
        offer: offerById[campaign.offerId],
        outcomeId: "called",
        normalizedOutcome: "attempted",
        at: session.startedAt ?? nowIso(),
        notes: legacyBusinessId.includes("twilio_test") ? "legacy:twilio_test" : null,
        legacySource: "call-sessions",
      }),
    );
  }

  return { attempts, warnings };
}
