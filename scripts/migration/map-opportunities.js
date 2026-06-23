import { cleanText, nowIso } from "../../src/stage1/shared.js";
import { evaluateCampaignMatch } from "../../src/schema/campaign-match.js";
import { buildOpportunity } from "../../src/schema/opportunity.js";
import { newOpportunityId } from "../../src/schema/ids.js";
import { findLegacyEntries, legacyRecordForCampaign } from "./legacy-lookup.js";

function mapQualificationStatus(record) {
  const status = cleanText(record?.qualificationStatus).toLowerCase();
  if (status === "qualified") return "qualified";
  if (status === "rejected") return "rejected";
  return "pending";
}

function applyAngleToOpportunity(opportunity, analysis) {
  if (!analysis) return opportunity;
  return buildOpportunity({
    ...opportunity,
    recommendedAngle: cleanText(analysis.primary_angle)
      ? `${cleanText(analysis.primary_angle)} — ${cleanText(analysis.detected_problem)}`.trim()
      : opportunity.recommendedAngle,
    recommendedScript: cleanText(analysis.suggested_opening_line) || opportunity.recommendedScript,
    recommendedOffer: cleanText(analysis.recommended_offer) || opportunity.recommendedOffer,
    score: analysis.priority_score ?? opportunity.score,
    priorityLabel: cleanText(analysis.priority_label) || opportunity.priorityLabel,
    outreachStatus: cleanText(analysis.current_status) || opportunity.outreachStatus,
  });
}

function outreachFromLegacy(legacy, source) {
  if (source === "pressure-washing") {
    return cleanText(legacy.status) || "new";
  }
  return cleanText(legacy.outreachStatus) || "not_contacted";
}

function closedFieldsFromStatus(outreachStatus) {
  if (outreachStatus === "won") {
    return { status: "closed", closedAt: nowIso(), closedReason: "won" };
  }
  if (outreachStatus === "lost" || outreachStatus === "not_interested") {
    return { status: "closed", closedAt: nowIso(), closedReason: outreachStatus };
  }
  return {};
}

export function migrateOpportunities({
  businesses,
  campaigns,
  offerById,
  legacyMeta,
  idMap,
  angleAnalyses,
}) {
  const opportunities = [];
  const opportunityByPair = new Map();
  const matchStats = {};
  const warnings = [];

  for (const campaign of campaigns) {
    matchStats[campaign.id] = { matched: 0, skipped: 0, campaignBuyer: campaign.buyer };
    const offer = offerById[campaign.offerId];
    if (!offer) {
      warnings.push({ type: "missing_offer", campaignId: campaign.id });
      continue;
    }

    for (const business of businesses) {
      const match = evaluateCampaignMatch(business, campaign);
      if (!match.matches) {
        matchStats[campaign.id].skipped += 1;
        continue;
      }

      matchStats[campaign.id].matched += 1;

      const legacyEntries = findLegacyEntries(business.id, idMap, legacyMeta);
      const legacyPick = legacyRecordForCampaign({
        ...legacyEntries,
        campaign,
        offerById,
      });
      const legacyRecord = legacyPick?.record ?? null;
      const legacySource = legacyPick?.source ?? null;

      let qualificationStatus = "qualified";
      let qualificationReason = null;
      let outreachStatus = "not_contacted";
      let lastContactedAt = null;
      let nextFollowUpAt = null;
      let assignedOperatorId = null;
      let recommendedAngle = campaign.config?.scripts?.offerPitch ?? null;
      let recommendedScript = campaign.config?.scripts?.openingLine ?? null;
      let recommendedOffer = campaign.config?.scripts?.offerPitch ?? null;
      let score = null;
      let priorityLabel = null;

      if (legacyRecord) {
        if (legacySource === "qualified-businesses") {
          qualificationStatus = mapQualificationStatus(legacyRecord);
          qualificationReason = legacyRecord.qualificationReason ?? null;
        } else {
          qualificationStatus = "qualified";
        }
        outreachStatus = outreachFromLegacy(legacyRecord, legacySource);
        lastContactedAt = legacyRecord.lastContactedAt ?? null;
        nextFollowUpAt = legacyRecord.nextFollowUpAt ?? null;
        assignedOperatorId =
          legacyRecord.assignedOperatorId ?? legacyRecord.lastOperatorId ?? null;

        if (legacySource === "pressure-washing") {
          recommendedAngle = legacyRecord.pressureWashingAngle ?? recommendedAngle;
          recommendedScript = legacyRecord.openingLine ?? recommendedScript;
          recommendedOffer = legacyRecord.offer ?? recommendedOffer;
          score = legacyRecord.priorityScore ?? score;
        }
      }

      const angleLegacyId =
        legacyEntries.qb?.legacyId ?? business.legacyId ?? legacyPick?.legacyId ?? null;
      const analysis = angleLegacyId ? angleAnalyses[angleLegacyId] : null;

      let opportunity = buildOpportunity({
        id: newOpportunityId(),
        campaignId: campaign.id,
        businessId: business.id,
        status: qualificationStatus,
        qualificationReason,
        score,
        priorityLabel,
        recommendedAngle,
        recommendedScript,
        recommendedOffer,
        outreachStatus,
        offerId: offer.id,
        offer: offer.name,
        buyer: campaign.buyer,
        region: campaign.region,
        channel: campaign.channel,
        campaignConfigVersion: campaign.configVersion,
        assignedOperatorId,
        lastContactedAt,
        nextFollowUpAt,
        ...closedFieldsFromStatus(outreachStatus),
      });

      if (legacySource === "qualified-businesses") {
        opportunity = applyAngleToOpportunity(opportunity, analysis);
      }

      const pairKey = `${campaign.id}|${business.id}`;
      opportunityByPair.set(pairKey, opportunity);
      opportunities.push(opportunity);
    }
  }

  return { opportunities, opportunityByPair, matchStats, warnings };
}
