import { cleanText, nowIso } from "../stage1/shared.js";
import {
  getQualifiedBusiness,
  upsertQualifiedBusiness,
} from "../stage1/qualified-business-store.js";
import { appendSalesNote } from "../mission-control/sales-mode.js";
import { getPwLead, upsertPwLead, appendPwNote } from "../pressure-washing/lead-store.js";
import { detectLeadMode } from "./lead-target.js";

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

  await upsertQualifiedBusiness({
    ...record,
    salesCalls: mergeCallRecord(record.salesCalls, callRecord),
  });
  return callRecord;
}

function mergeCallRecord(salesCalls, callRecord) {
  const list = Array.isArray(salesCalls) ? [...salesCalls] : [];
  const index = list.findIndex(
    (entry) =>
      entry.id === callRecord.id ||
      (callRecord.twilioCallSid &&
        entry.twilioCallSid &&
        entry.twilioCallSid === callRecord.twilioCallSid),
  );
  if (index === -1) {
    list.push(callRecord);
  } else {
    list[index] = { ...list[index], ...callRecord };
  }
  return list;
}

export async function upsertSalesCallOnPwLead(leadId, callRecord) {
  const record = await getPwLead(leadId);
  if (!record) throw new Error("Lead not found");

  await upsertPwLead({
    ...record,
    salesCalls: mergeCallRecord(record.salesCalls, callRecord),
  });
  return callRecord;
}

export async function upsertSalesCallOnLead(leadId, callRecord) {
  if (detectLeadMode(leadId) === "pressure-washing") {
    return upsertSalesCallOnPwLead(leadId, callRecord);
  }
  return upsertSalesCallOnBusiness(leadId, callRecord);
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

export async function saveRecordingToPwLead({
  leadId,
  callId,
  twilioCallSid,
  twilioRecordingSid,
  recordingUrl,
  durationSec,
  completedAt = nowIso(),
  startedAt = null,
}) {
  const existing = await getPwLead(leadId);
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

  await upsertSalesCallOnPwLead(leadId, callRecord);

  const durationLabel = durationSec != null ? `${Number(durationSec) || 0}` : "unknown";
  const noteText = `Call recording saved. Duration: ${durationLabel} seconds. Recording SID: ${twilioRecordingSid || "n/a"}.`;
  await appendPwNote(leadId, noteText);

  return callRecord;
}

export async function saveRecordingToLead({
  leadId,
  leadMode = null,
  callId,
  twilioCallSid,
  twilioRecordingSid,
  recordingUrl,
  durationSec,
  completedAt = nowIso(),
  startedAt = null,
}) {
  const mode = leadMode || detectLeadMode(leadId);
  if (mode === "pressure-washing") {
    return saveRecordingToPwLead({
      leadId,
      callId,
      twilioCallSid,
      twilioRecordingSid,
      recordingUrl,
      durationSec,
      completedAt,
      startedAt,
    });
  }
  return saveRecordingToBusiness({
    businessId: leadId,
    callId,
    twilioCallSid,
    twilioRecordingSid,
    recordingUrl,
    durationSec,
    completedAt,
    startedAt,
  });
}
