import { cleanText, nowIso } from "../stage1/shared.js";
import { LEARNING_REPORT_SCOPE_TYPES } from "./constants.js";
import { getRecordById, listRecords, upsertRecord } from "./collection.js";
import { newLearningReportId } from "./ids.js";
import { LEARNING_REPORTS_FILE } from "./paths.js";
import { validateLearningReport } from "./validate.js";

const COLLECTION_KEY = "reports";

export function emptyLearningAggregates() {
  return {
    funnel: {
      attempts: 0,
      conversations: 0,
      interested: 0,
      proposals: 0,
      appointments: 0,
      sales: 0,
    },
    byOffer: [],
    byBuyer: [],
    byRegion: [],
    byChannel: [],
    byOfferBuyer: [],
    byOfferChannel: [],
    byBuyerRegion: [],
    dailyTrend: [],
  };
}

export function buildLearningReport(input = {}) {
  const stamp = nowIso();

  return {
    id: cleanText(input.id) || newLearningReportId(),
    scopeType: LEARNING_REPORT_SCOPE_TYPES.includes(input.scopeType)
      ? input.scopeType
      : "global",
    scopeId: cleanText(input.scopeId) || null,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    filters:
      input.filters && typeof input.filters === "object" ? input.filters : null,
    aggregates: {
      ...emptyLearningAggregates(),
      ...(input.aggregates && typeof input.aggregates === "object" ? input.aggregates : {}),
    },
    generatedAt: input.generatedAt || stamp,
    generatedBy: cleanText(input.generatedBy) || "system",
  };
}

export async function listLearningReports() {
  return listRecords(LEARNING_REPORTS_FILE, COLLECTION_KEY);
}

export async function getLearningReport(id) {
  return getRecordById(LEARNING_REPORTS_FILE, id, COLLECTION_KEY);
}

export async function findLearningReport({ scopeType, scopeId, periodFrom, periodTo }) {
  const reports = await listLearningReports();
  return (
    reports.find(
      (row) =>
        row.scopeType === scopeType &&
        (row.scopeId ?? null) === (scopeId ?? null) &&
        row.periodFrom === periodFrom &&
        row.periodTo === periodTo,
    ) ?? null
  );
}

export async function saveLearningReport(input = {}) {
  const existing = input.id ? await getLearningReport(input.id) : null;
  const record = buildLearningReport({
    ...existing,
    ...input,
    aggregates: { ...(existing?.aggregates ?? {}), ...(input.aggregates ?? {}) },
    generatedAt: nowIso(),
  });
  validateLearningReport(record);
  return upsertRecord(LEARNING_REPORTS_FILE, record, {
    collectionKey: COLLECTION_KEY,
    validate: validateLearningReport,
  });
}
