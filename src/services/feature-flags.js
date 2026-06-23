export function useSchemaQueueReads() {
  return process.env.USE_SCHEMA_QUEUE_READS === "1";
}

export function useSchemaOutcomeWrites() {
  return process.env.USE_SCHEMA_OUTCOME_WRITES === "1";
}

export function dualReadValidationEnabled() {
  return process.env.DUAL_READ_VALIDATION === "1" || useSchemaQueueReads();
}
