import { compareWebsiteQueues } from "./website-queue.js";
import { comparePwQueues } from "./pw-queue.js";
import { useSchemaQueueReads } from "../feature-flags.js";
import {
  WEBSITE_QUEUE_SORT_KEYS,
  PW_QUEUE_SORT_KEYS,
} from "../queue-sort.js";

function collectMismatches(results) {
  const mismatches = [];

  for (const result of results) {
    const { comparison } = result;
    if (!comparison.parity.countMatch) {
      mismatches.push({
        type: "count_mismatch",
        queue: result.queue,
        legacy: comparison.counts.legacy,
        schema: comparison.counts.schema,
      });
    }
    if (comparison.onlyLegacy.length) {
      mismatches.push({
        type: "legacy_only_ids",
        queue: result.queue,
        count: comparison.onlyLegacy.length,
        sample: comparison.onlyLegacy.slice(0, 25),
      });
    }
    if (comparison.onlySchema.length) {
      mismatches.push({
        type: "schema_only_ids",
        queue: result.queue,
        count: comparison.onlySchema.length,
        sample: comparison.onlySchema.slice(0, 25),
      });
    }
    if (comparison.stateMismatches.length) {
      mismatches.push({
        type: "state_mismatch",
        queue: result.queue,
        count: comparison.stateMismatches.length,
        sample: comparison.stateMismatches.slice(0, 25),
      });
    }
    if (!comparison.parity.orderingMatch) {
      mismatches.push({
        type: "ordering_mismatch",
        queue: result.queue,
        count: comparison.orderMismatches.length,
        sample: comparison.orderMismatches.slice(0, 25),
      });
    }
  }

  return mismatches;
}

export async function runDualReadValidation() {
  const [website, pw] = await Promise.all([compareWebsiteQueues(), comparePwQueues()]);
  const queues = [website, pw];
  const mismatches = collectMismatches(queues);

  const validationReport = {
    generatedAt: new Date().toISOString(),
    mode: "dual-read",
    useSchemaQueueReads: useSchemaQueueReads(),
    productionBehavior: useSchemaQueueReads() ? "schema-queue-reads" : "legacy-queue-reads",
    sortKeys: {
      website: WEBSITE_QUEUE_SORT_KEYS,
      pressureWashing: PW_QUEUE_SORT_KEYS,
    },
    summary: {
      queuesCompared: queues.length,
      totalMismatches: mismatches.length,
      website: website.comparison.parity,
      pressureWashing: pw.comparison.parity,
    },
    queues: queues.map((row) => ({
      queue: row.queue,
      campaignId: row.campaignId,
      focus: row.focus,
      counts: row.comparison.counts,
      parity: row.comparison.parity,
    })),
  };

  const queueParityReport = {
    generatedAt: validationReport.generatedAt,
    queues: queues.map((row) => ({
      queue: row.queue,
      campaignId: row.campaignId,
      focus: row.focus,
      counts: row.comparison.counts,
      parity: row.comparison.parity,
      legacyOrderSample: row.comparison.legacyOrder,
      schemaOrderSample: row.comparison.schemaOrder,
    })),
  };

  const mismatchReport = {
    generatedAt: validationReport.generatedAt,
    total: mismatches.length,
    mismatches,
    details: queues.map((row) => ({
      queue: row.queue,
      onlyLegacy: row.comparison.onlyLegacy,
      onlySchema: row.comparison.onlySchema,
      stateMismatches: row.comparison.stateMismatches,
      orderMismatches: row.comparison.orderMismatches,
    })),
  };

  return {
    validationReport,
    queueParityReport,
    mismatchReport,
    website,
    pw,
  };
}

export async function logDualReadIfEnabled(source, resultPromise) {
  if (process.env.DUAL_READ_VALIDATION !== "1") return;
  try {
    const result = await resultPromise;
    const { comparison } = result;
    console.log(
      `[dual-read:${source}] legacy=${comparison.counts.legacy} schema=${comparison.counts.schema} ` +
        `idSetMatch=${comparison.parity.idSetMatch} orderingMatch=${comparison.parity.orderingMatch} ` +
        `stateMatch=${comparison.parity.stateMatch}`,
    );
    if (!comparison.parity.idSetMatch) {
      console.log(
        `[dual-read:${source}] onlyLegacy=${comparison.onlyLegacy.length} onlySchema=${comparison.onlySchema.length}`,
      );
    }
  } catch (err) {
    console.warn(`[dual-read:${source}]`, err.message);
  }
}
