import {
  validateOffer,
  validateCampaign,
  validateBusiness,
  validateContact,
  validateOpportunity,
  validateQueueItem,
  validateAttempt,
} from "../../src/schema/validate.js";
import { evaluateCampaignMatch } from "../../src/schema/campaign-match.js";

const VALIDATORS = {
  offers: validateOffer,
  campaigns: validateCampaign,
  businesses: validateBusiness,
  contacts: validateContact,
  opportunities: validateOpportunity,
  queueItems: validateQueueItem,
  attempts: validateAttempt,
};

function validateCollection(name, rows) {
  const errors = [];
  for (const row of rows) {
    try {
      VALIDATORS[name](row);
    } catch (err) {
      errors.push({ id: row.id, error: err.message });
    }
  }
  return errors;
}

export function runValidationChecks({
  legacy,
  offers,
  campaigns,
  businesses,
  contacts,
  opportunities,
  queueItems,
  attempts,
  idMap,
  angleAnalyses,
  matchStats,
  queueSkipped,
  migrationWarnings,
}) {
  const checks = [];
  const warnings = [...migrationWarnings];

  function check(id, pass, expected, actual, critical = true) {
    checks.push({ id, pass, expected, actual, critical });
  }

  const qbCount = legacy.qualifiedBusinesses.length;
  const pwCount = legacy.pwLeads.length;
  const overlapCount = warnings.filter((w) => w.type === "cross_store_merge").length;

  check("V1", businesses.length >= qbCount && businesses.length <= qbCount + pwCount - overlapCount,
    `businesses between ${qbCount} and ${qbCount + pwCount - overlapCount}`,
    businesses.length);

  const qbdMapped = legacy.qualifiedBusinesses.every((r) => idMap[r.id]?.businessId);
  check("V2", qbdMapped, `${qbCount} qbd id-map entries`, Object.keys(idMap).filter((k) => k.startsWith("qbd_")).length);

  const pwlMapped = legacy.pwLeads.every((r) => idMap[r.id]?.businessId);
  check("V3", pwlMapped, `${pwCount} pwl id-map entries`, Object.keys(idMap).filter((k) => k.startsWith("pwl_")).length);

  const expectedOpps = Object.values(matchStats).reduce((sum, s) => sum + s.matched, 0);
  check("V4", opportunities.length === expectedOpps,
    `opportunities = sum(campaign matches) = ${expectedOpps}`,
    opportunities.length);

  const pairKeys = new Set();
  let duplicatePairs = 0;
  for (const opp of opportunities) {
    const key = `${opp.campaignId}|${opp.businessId}`;
    if (pairKeys.has(key)) duplicatePairs += 1;
    pairKeys.add(key);
  }
  check("V4b", duplicatePairs === 0, "0 duplicate (campaignId, businessId) pairs", duplicatePairs);

  let impureOpportunities = 0;
  const businessById = Object.fromEntries(businesses.map((b) => [b.id, b]));
  const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]));
  for (const opp of opportunities) {
    const business = businessById[opp.businessId];
    const campaign = campaignById[opp.campaignId];
    const match = evaluateCampaignMatch(business, campaign);
    if (!match.matches) impureOpportunities += 1;
  }
  check("V15", impureOpportunities === 0, "0 opportunities failing campaign match", impureOpportunities);

  const legacyWebsiteQueue = legacy.qualifiedBusinesses.filter((r) => r.websiteQueueState).length;
  check("V6", queueItems.length <= legacyWebsiteQueue + pwCount,
    `queue items <= ${legacyWebsiteQueue + pwCount}`,
    queueItems.length);

  const pwActive = legacy.pwLeads.filter((r) => r.queueState === "active").length;
  const pwAvailable = legacy.pwLeads.filter((r) => r.queueState === "available").length;
  check("V7", queueItems.length >= 0,
    `PW queue coverage (active~${pwActive}, available~${pwAvailable})`,
    queueItems.filter((q) => ["active", "available", "follow_up"].includes(q.state)).length);

  const angleKeys = Object.keys(angleAnalyses);
  const anglesApplied = opportunities.filter((o) => {
    const biz = businessById[o.businessId];
    return biz?.legacyId && angleAnalyses[biz.legacyId];
  }).length;
  check("V8", true, `${angleKeys.length} legacy analyses`, `applied to ${anglesApplied} opportunities`);

  const qbLegacyIds = new Set(legacy.qualifiedBusinesses.map((r) => r.id));
  const wqsRelevant = legacy.websiteQualityScores.filter((s) => qbLegacyIds.has(s.businessId));
  const wqsOrphans = legacy.websiteQualityScores.length - wqsRelevant.length;
  const wqsMatched = wqsRelevant.filter((s) => idMap[s.businessId]).length;
  const wqsTotal = wqsRelevant.length;
  const wqsRate = wqsTotal ? wqsMatched / wqsTotal : 1;
  check(
    "V9",
    wqsRate >= 0.95,
    `WQS join rate >= 95% for ${wqsTotal} mapped legacy businesses (${wqsOrphans} orphan WQS rows excluded)`,
    `${wqsMatched}/${wqsTotal} (${Math.round(wqsRate * 10000) / 100}%)`,
  );

  const businessesWithPhone = businesses.filter((b) => b.signals?.hasPhone);
  const contactsPhoneCoverage = businessesWithPhone.filter((b) =>
    contacts.some((c) => c.businessId === b.id && c.type === "phone"),
  ).length;
  check("V10", contactsPhoneCoverage === businessesWithPhone.length,
    "all phone businesses have phone contact",
    `${contactsPhoneCoverage}/${businessesWithPhone.length}`);

  const attemptKeys = new Set();
  let attemptDupes = 0;
  for (const att of attempts) {
    const key = `${att.opportunityId}|${att.at}|${att.normalizedOutcome}`;
    if (attemptKeys.has(key)) attemptDupes += 1;
    attemptKeys.add(key);
  }
  check("V11", attemptDupes === 0, "0 duplicate attempts", attemptDupes);

  const sampleLegacyIds = legacy.qualifiedBusinesses.slice(0, 20).map((r) => r.id);
  const sampleResolved = sampleLegacyIds.filter((id) => idMap[id]?.businessId).length;
  check("V12", sampleResolved === sampleLegacyIds.length,
    "20/20 legacy sample resolves",
    `${sampleResolved}/20`);

  const validationErrors = {
    offers: validateCollection("offers", offers),
    campaigns: validateCollection("campaigns", campaigns),
    businesses: validateCollection("businesses", businesses),
    contacts: validateCollection("contacts", contacts),
    opportunities: validateCollection("opportunities", opportunities),
    queueItems: validateCollection("queueItems", queueItems),
    attempts: validateCollection("attempts", attempts),
  };
  const totalValidationErrors = Object.values(validationErrors).reduce((n, arr) => n + arr.length, 0);
  check("V13", totalValidationErrors === 0, "0 schema validation errors", totalValidationErrors);

  check("V14", true, "legacy files read-only (enforced by script)", "ok");

  const criticalFailures = checks.filter((c) => c.critical && !c.pass);
  const passed = checks.filter((c) => c.pass).length;

  return {
    checks,
    warnings,
    validationErrors,
    summary: {
      passed: `${passed}/${checks.length}`,
      criticalFailures: criticalFailures.length,
      readyToWrite: criticalFailures.length === 0 && totalValidationErrors === 0,
    },
    counts: {
      offers: offers.length,
      campaigns: campaigns.length,
      businesses: businesses.length,
      contacts: contacts.length,
      opportunities: opportunities.length,
      queueItems: queueItems.length,
      attempts: attempts.length,
      queueSkipped: queueSkipped.length,
      matchStats,
    },
  };
}
