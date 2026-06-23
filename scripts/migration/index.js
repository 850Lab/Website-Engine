import { setOpportunityOnIdMap } from "./dedup.js";
import { loadLegacyData } from "./load-legacy.js";
import { loadSeedData } from "./load-seeds.js";
import { migrateBusinessesAndContacts, buildWqsIndex } from "./map-businesses.js";
import { migrateOpportunities } from "./map-opportunities.js";
import { migrateQueueItems } from "./map-queue-items.js";
import { migrateAttempts } from "./map-attempts.js";
import { runValidationChecks } from "./validate-migration.js";
import { writeMigrationReport, printReportSummary } from "./report.js";
import { backupSchemaFiles, writeSchemaCollections } from "./write-output.js";

function buildStats({
  legacy,
  idMap,
  matchStats,
  queueItems,
  queueSkipped,
  opportunities,
  businesses,
  angleAnalyses,
  warnings,
}) {
  const opportunitiesByCampaign = Object.fromEntries(
    Object.entries(matchStats).map(([campaignId, stats]) => [campaignId, stats.matched]),
  );

  const qbLegacyIds = new Set(legacy.qualifiedBusinesses.map((r) => r.id));
  const wqsRelevant = legacy.websiteQualityScores.filter((row) => qbLegacyIds.has(row.businessId));
  const wqsRows = wqsRelevant.length;
  const wqsMatched = wqsRelevant.filter((row) => idMap[row.businessId]).length;

  const businessById = Object.fromEntries(businesses.map((b) => [b.id, b]));
  let angleAnalysesApplied = 0;
  for (const opp of opportunities) {
    const biz = businessById[opp.businessId];
    if (biz?.legacyId && angleAnalyses[biz.legacyId]) angleAnalysesApplied += 1;
  }

  const angleOrphans = Object.keys(angleAnalyses).filter((legacyId) => !idMap[legacyId]).length;

  return {
    opportunitiesByCampaign,
    openQueueItems: queueItems.filter((q) =>
      ["available", "active", "follow_up"].includes(q.state),
    ).length,
    crossStoreMerges: warnings.filter((w) => w.type === "cross_store_merge").length,
    skippedQueueNoOpportunity: queueSkipped.length,
    angleAnalysesApplied,
    angleOrphans,
    wqsRows,
    wqsMatched,
  };
}

function enrichIdMapWithOpportunities(idMap, opportunities, legacyMeta) {
  for (const opportunity of opportunities) {
    for (const [legacyId, entry] of Object.entries(idMap)) {
      if (entry.businessId !== opportunity.businessId) continue;
      if (!legacyMeta.qualified[legacyId] && !legacyMeta.pw[legacyId]) continue;
      setOpportunityOnIdMap(idMap, legacyId, opportunity.campaignId, opportunity.id);
    }
  }
}

export async function runMigration(options = {}) {
  const write = Boolean(options.write);
  const backup = Boolean(options.backup);

  const legacy = await loadLegacyData();
  const { offers, campaigns, offerById } = await loadSeedData();
  const wqsByLegacyId = buildWqsIndex(legacy.websiteQualityScores);

  const {
    businesses,
    contacts,
    idMap,
    legacyMeta,
    warnings: businessWarnings,
  } = migrateBusinessesAndContacts(legacy, wqsByLegacyId);

  const {
    opportunities,
    matchStats,
    warnings: opportunityWarnings,
  } = migrateOpportunities({
    businesses,
    campaigns,
    offerById,
    legacyMeta,
    idMap,
    angleAnalyses: legacy.angleAnalyses,
  });

  enrichIdMapWithOpportunities(idMap, opportunities, legacyMeta);

  const { queueItems, skipped: queueSkipped } = migrateQueueItems({
    opportunities,
    legacyMeta,
    idMap,
    campaigns,
    offerById,
  });

  const { attempts, warnings: attemptWarnings } = migrateAttempts({
    opportunities,
    campaigns,
    offerById,
    contacts,
    legacyMeta,
    idMap,
    legacy,
  });

  const migrationWarnings = [...businessWarnings, ...opportunityWarnings, ...attemptWarnings];

  const validation = runValidationChecks({
    legacy,
    offers,
    campaigns,
    businesses,
    contacts,
    opportunities,
    queueItems,
    attempts,
    idMap,
    angleAnalyses: legacy.angleAnalyses,
    matchStats,
    queueSkipped,
    migrationWarnings,
  });

  const stats = buildStats({
    legacy,
    idMap,
    matchStats,
    queueItems,
    queueSkipped,
    opportunities,
    businesses,
    angleAnalyses: legacy.angleAnalyses,
    warnings: migrationWarnings,
  });

  const ctx = {
    offers,
    campaigns,
    businesses,
    contacts,
    opportunities,
    queueItems,
    attempts,
    idMap,
    warnings: migrationWarnings,
    stats,
  };

  if (write) {
    if (backup) {
      const backupDir = await backupSchemaFiles();
      console.log(`Schema backup written to ${backupDir}`);
    }
    await writeSchemaCollections({
      offers,
      campaigns,
      businesses,
      contacts,
      opportunities,
      queueItems,
      attempts,
      idMap,
    });
    console.log("Schema collections written.");
  }

  const { reportPath, idMapPath, report } = await writeMigrationReport(ctx, validation, { write });

  return {
    ctx,
    validation,
    report,
    reportPath,
    idMapPath,
    readyToWrite: validation.summary.readyToWrite,
  };
}

export { printReportSummary };
