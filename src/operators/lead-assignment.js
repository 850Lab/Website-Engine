import {
  getQualifiedBusiness,
  upsertQualifiedBusiness,
} from "../stage1/qualified-business-store.js";
import { cleanText, nowIso } from "../stage1/shared.js";
import { isTwilioTestBusiness } from "../twilio-voice/test-lead.js";

export function canOperatorAccessLead(record, operator) {
  if (!record || !operator) return false;
  if (isTwilioTestBusiness(record.id)) return true;
  if (operator.role === "owner") return true;

  const assignedId = cleanText(record.assignedOperatorId);
  if (!assignedId) return true;
  return assignedId === operator.id;
}

export async function assignLeadToOperator(businessId, operator) {
  if (!operator?.id) throw new Error("Operator is required.");

  const record = await getQualifiedBusiness(businessId);
  if (!record) throw new Error("Business not found");

  if (isTwilioTestBusiness(businessId)) {
    return record;
  }

  const assignedId = cleanText(record.assignedOperatorId);
  if (assignedId && assignedId !== operator.id) {
    throw new Error("Lead is assigned to another operator.");
  }

  if (assignedId === operator.id) {
    return record;
  }

  const updated = {
    ...record,
    assignedOperatorId: operator.id,
    assignedOperatorName: operator.name,
    assignedAt: nowIso(),
  };
  await upsertQualifiedBusiness(updated);
  return updated;
}
