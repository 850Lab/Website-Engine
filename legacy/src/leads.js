import { randomUUID } from "node:crypto";
import { loadLeads, saveLeads } from "./storage.js";
import { scoreLead, statusFromScore } from "./scoring.js";
import { generateOutreachAngle } from "./outreach.js";

function enrichLead(input) {
  const lead = {
    id: input.id ?? randomUUID(),
    businessName: input.businessName ?? "",
    category: input.category ?? "",
    city: input.city ?? "",
    phone: input.phone ?? "",
    websiteUrl: input.websiteUrl ?? "",
    googleReviewCount: Number(input.googleReviewCount) || 0,
    googleRating: Number(input.googleRating) || 0,
    notes: input.notes ?? "",
    weakWebsite: Boolean(input.weakWebsite),
    serviceBusiness:
      input.serviceBusiness === undefined
        ? undefined
        : Boolean(input.serviceBusiness),
    socialEvidence: Boolean(input.socialEvidence),
    strongProof: Boolean(input.strongProof),
    websiteQuality: input.websiteQuality ?? null,
    manualStatus: input.manualStatus ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { score, breakdown, serviceBusiness } = scoreLead(lead);
  const computedStatus = statusFromScore(score);
  const angle = generateOutreachAngle(lead);
  const status = lead.manualStatus ?? computedStatus;

  return {
    ...lead,
    serviceBusiness: lead.serviceBusiness ?? serviceBusiness,
    score,
    scoreBreakdown: breakdown,
    computedStatus,
    status,
    outreachAngle: angle.label,
    outreachKey: angle.key,
    outreachPitch: angle.pitch,
  };
}

export async function addLead(fields) {
  const leads = await loadLeads();
  const lead = enrichLead(fields);
  leads.push(lead);
  await saveLeads(leads);
  return lead;
}

export async function listLeads({ status } = {}) {
  const leads = await loadLeads();
  if (!status) return leads;
  return leads.filter(
    (l) => l.status.toUpperCase() === status.toUpperCase()
  );
}

export async function getTargets() {
  return listLeads({ status: "TARGET" });
}

export async function updateLeadStatus(id, status) {
  const allowed = ["TARGET", "HOLD", "SKIP"];
  const normalized = status.toUpperCase();
  if (!allowed.includes(normalized)) {
    throw new Error(`Status must be one of: ${allowed.join(", ")}`);
  }

  const leads = await loadLeads();
  const index = leads.findIndex((l) => l.id === id);
  if (index === -1) {
    throw new Error(`Lead not found: ${id}`);
  }

  const updated = enrichLead({
    ...leads[index],
    manualStatus: normalized,
    createdAt: leads[index].createdAt,
  });
  leads[index] = updated;
  await saveLeads(leads);
  return updated;
}

export async function findLead(id) {
  const leads = await loadLeads();
  return leads.find((l) => l.id === id) ?? null;
}
