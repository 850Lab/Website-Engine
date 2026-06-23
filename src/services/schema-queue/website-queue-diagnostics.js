import { randomUUID } from "node:crypto";

export function createWebsiteQueueRequestId(existing = null) {
  const value = cleanRequestId(existing);
  if (value) return value;
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

function cleanRequestId(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function formatDiag(fields) {
  return Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
}

/** Primary response path — what the caller returns to the user. */
export function logWebsiteQueuePrimaryDiag({
  requestId,
  primarySource,
  queueCount,
  servedToUser = true,
}) {
  console.info(
    `[website-queue-diag] ${formatDiag({
      requestId: createWebsiteQueueRequestId(requestId),
      primarySource,
      queueCount,
      servedToUser,
    })}`,
  );
}

/** Background dual-read parity leg — not returned to the user. */
export function logWebsiteQueueDualReadDiag({
  requestId,
  dualReadSource,
  queueCount = null,
  servedToUser = false,
}) {
  console.info(
    `[website-queue-diag] ${formatDiag({
      requestId: createWebsiteQueueRequestId(requestId),
      dualReadSource,
      ...(queueCount == null ? {} : { queueCount }),
      servedToUser,
    })}`,
  );
}

/** Summary after parity comparison finishes. */
export function logWebsiteQueueDualReadSummary({
  requestId,
  dualReadLegacyCount,
  dualReadSchemaCount,
  parityOk,
}) {
  console.info(
    `[website-queue-diag] ${formatDiag({
      requestId: createWebsiteQueueRequestId(requestId),
      dualReadSource: "parity-complete",
      dualReadLegacyCount,
      dualReadSchemaCount,
      parityOk,
      servedToUser: false,
    })}`,
  );
}
