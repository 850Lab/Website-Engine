import { cleanText, normalizePhoneNumber } from "../stage1/shared.js";
import { getQualifiedBusiness } from "../stage1/qualified-business-store.js";
import { getPwLead } from "../pressure-washing/lead-store.js";

export function detectLeadMode(leadId) {
  return String(leadId ?? "").startsWith("pwl_") ? "pressure-washing" : "website";
}

export function prospectPhoneForLead(record = {}) {
  const phone = cleanText(record.normalizedPhone) || cleanText(record.phone);
  return normalizePhoneNumber(phone);
}

export async function getCallTarget(leadId) {
  const id = cleanText(leadId);
  if (!id) return null;

  const mode = detectLeadMode(id);
  if (mode === "pressure-washing") {
    const lead = await getPwLead(id);
    if (!lead) return null;
    return {
      mode,
      id: lead.id,
      businessName: lead.businessName,
      normalizedPhone: lead.normalizedPhone,
      phone: lead.phone,
      record: lead,
    };
  }

  const business = await getQualifiedBusiness(id);
  if (!business) return null;
  return {
    mode: "website",
    id: business.id,
    businessName: business.businessName,
    normalizedPhone: business.normalizedPhone,
    phone: business.phone,
    record: business,
  };
}
