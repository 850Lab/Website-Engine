/** Map schema queue-item.state → legacy website websiteQueueState. */
export const SCHEMA_TO_WEBSITE_QUEUE = {
  available: "available",
  active: "active",
  follow_up: "follow_up",
  completed: "completed",
  suppressed: "suppressed",
};

/** Map schema queue-item.state → legacy PW queueState. */
export const SCHEMA_TO_PW_QUEUE = {
  available: "available",
  active: "active",
  follow_up: "follow_up",
  completed: "completed",
  suppressed: "suppressed",
};

export { compareWebsiteQueueRows, comparePwQueueRows, sortWebsiteQueueRowsAsync, sortPwQueueRowsAsync } from "../queue-sort.js";

export function compareQueueSnapshots({
  label,
  legacyEntries,
  schemaEntries,
  sortSchemaEntries = (rows) => rows,
}) {
  const legacyIds = legacyEntries.map((row) => row.legacyId);
  const schemaIds = schemaEntries.map((row) => row.legacyId).filter(Boolean);

  const legacySet = new Set(legacyIds);
  const schemaSet = new Set(schemaIds);

  const onlyLegacy = legacyIds.filter((id) => !schemaSet.has(id));
  const onlySchema = schemaIds.filter((id) => !legacySet.has(id));
  const shared = legacyIds.filter((id) => schemaSet.has(id));

  const legacyById = Object.fromEntries(legacyEntries.map((row) => [row.legacyId, row]));
  const schemaById = Object.fromEntries(schemaEntries.filter((row) => row.legacyId).map((row) => [row.legacyId, row]));

  const stateMismatches = [];
  for (const legacyId of shared) {
    const legacy = legacyById[legacyId];
    const schema = schemaById[legacyId];
    if (!legacy || !schema) continue;
    if (legacy.queueState !== schema.queueState) {
      stateMismatches.push({
        legacyId,
        legacyQueueState: legacy.queueState,
        schemaQueueState: schema.queueState,
        schemaQueueItemId: schema.schemaQueueItemId,
      });
    }
  }

  const legacyOrder = legacyIds;
  const schemaOrder = sortSchemaEntries(schemaEntries.filter((row) => legacySet.has(row.legacyId))).map(
    (row) => row.legacyId,
  );

  const orderMismatches = [];
  const maxLen = Math.max(legacyOrder.length, schemaOrder.length);
  for (let index = 0; index < maxLen; index += 1) {
    const legacy = legacyOrder[index] ?? null;
    const schema = schemaOrder[index] ?? null;
    if (legacy !== schema) {
      orderMismatches.push({ index, legacy, schema });
    }
  }

  const orderingMatch =
    legacyOrder.length === schemaOrder.length && orderMismatches.length === 0;

  return {
    label,
    counts: {
      legacy: legacyIds.length,
      schema: schemaIds.length,
      shared: shared.length,
      onlyLegacy: onlyLegacy.length,
      onlySchema: onlySchema.length,
    },
    parity: {
      countMatch: legacyIds.length === schemaIds.length,
      idSetMatch: onlyLegacy.length === 0 && onlySchema.length === 0,
      orderingMatch,
      stateMatch: stateMismatches.length === 0,
    },
    onlyLegacy,
    onlySchema,
    stateMismatches,
    orderMismatches: orderMismatches.slice(0, 50),
    legacyOrder: legacyIds.slice(0, 100),
    schemaOrder: schemaIds.slice(0, 100),
  };
}
