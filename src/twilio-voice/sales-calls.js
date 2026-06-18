import { cleanText, nowIso } from "../stage1/shared.js";
import {
  getQualifiedBusiness,
  upsertQualifiedBusiness,
} from "../stage1/qualified-business-store.js";
import { appendSalesNote } from "../mission-control/sales-mode.js";

export function buildSalesCallRecord({
  id,
  twilioCallSid = null,
  twilioRecordingSid = null,
  startedAt = nowIso(),
  completedAt = null,
  durationSec = null,
  recordingUrl = null,
  status = "initiated",
  error = null,
}) {
  return {
    id: cleanText(id),
    twilioCallSid: cleanText(twilioCallSid) || null,
    twilioRecordingSid: cleanText(twilioRecordingSid) || null,
    startedAt,
    completedAt,
    durationSec: durationSec == null ? null : Number(durationSec) || 0,
    recordingUrl: cleanText(recordingUrl) || null,
    status: cleanText(status) || "initiated",
    error: cleanText(error) || null,
  };
}

export async function upsertSalesCallOnBusiness(businessId, callRecord) {
  const record = await getQualifiedBusiness(businessId);
  if (!record) throw new Error("Business not found");

  const salesCalls = Array.isArray(record.salesCalls) ? [...record.salesCalls] : [];
  const index = salesCalls.findIndex(
    (entry) =>
      entry.id === callRecord.id ||
      (callRecord.twilioCallSid &&
        entry.twilioCallSid &&
        entry.twilioCallSid === callRecord.twilioCallSid),
  );

  if (index === -1) {
    salesCalls.push(callRecord);
  } else {
    salesCalls[index] = { ...salesCalls[index], ...callRecord };
  }

  await upsertQualifiedBusiness({ ...record, salesCalls });
  return callRecord;
}

export async function saveRecordingToBusiness({
  businessId,
  callId,
  twilioCallSid,
  twilioRecordingSid,
  recordingUrl,
  durationSec,
  completedAt = nowIso(),
  startedAt = null,
}) {
  const existing = await getQualifiedBusiness(businessId);
  const priorCall = Array.isArray(existing?.salesCalls)
    ? existing.salesCalls.find((entry) => entry.id === callId)
    : null;

  const callRecord = buildSalesCallRecord({
    id: callId,
    twilioCallSid,
    twilioRecordingSid,
    recordingUrl,
    durationSec,
    startedAt: startedAt || priorCall?.startedAt || nowIso(),
    completedAt,
    status: "completed",
  });

  await upsertSalesCallOnBusiness(businessId, callRecord);

  const durationLabel = durationSec != null ? `${Number(durationSec) || 0}` : "unknown";
  const noteText = `Call recording saved. Duration: ${durationLabel} seconds. Recording SID: ${twilioRecordingSid || "n/a"}.`;
  await appendSalesNote(businessId, noteText);

  return callRecord;
}
