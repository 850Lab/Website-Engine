import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR } from "../storage.js";
import { readJsonDocument, writeJsonDocument } from "../persistence/json-document-store.js";
import { cleanText, normalizePhoneNumber, nowIso } from "../stage1/shared.js";
import { computePriorityScore } from "./scoring.js";
import { defaultAngle, defaultOffer } from "./scripts.js";
import { normalizePwStatus, PW_CLOSED_STATUSES, getPwQuickAction } from "./statuses.js";
import {
  applyOutcomeQueueState,
  isFollowUpDue,
  resolveQueueState,
} from "./queue-state.js";
import {
  applyBatchPromotion,
  buildActiveQueue,
  buildDedupIndex,
  leadDedupKey,
  planBatchPromotion,
  summarizeQueueHealth,
} from "./queue-engine.js";

export const PW_LEADS_FILE = join(DATA_DIR, "pressure-washing-leads.json");

export { isFollowUpDue, leadDedupKey, buildDedupIndex };

async function readLeadsDocument() {
  const parsed = await readJsonDocument(PW_LEADS_FILE);
  if (!parsed) return { version: 1, leads: [], updatedAt: null };
  if (Array.isArray(parsed)) return { version: 1, leads: parsed, updatedAt: null };
  return {
    version: parsed.version ?? 1,
    leads: Array.isArray(parsed.leads) ? parsed.leads : [],
    updatedAt: parsed.updatedAt ?? null,
  };
}

async function readLeads() {
  const doc = await readLeadsDocument();
  return doc.leads;
}

async function writeLeads(leads) {
  await writeJsonDocument(PW_LEADS_FILE, { version: 1, leads, updatedAt: nowIso() });
}

export function newPwLeadId() {
  return `pwl_${randomUUID().slice(0, 8)}`;
}

export function buildPwLead(input = {}) {
  const normalizedPhone = normalizePhoneNumber(input.normalizedPhone || input.phone);
  const createdAt = cleanText(input.createdAt) || nowIso();
  const lead = {
    id: cleanText(input.id) || newPwLeadId(),
    businessName: cleanText(input.businessName),
    industry: cleanText(input.industry) || "Restaurants",
    address: cleanText(input.address),
    city: cleanText(input.city),
    phone: cleanText(input.phone),
    normalizedPhone,
    website: cleanText(input.website),
    googleMapsUrl: cleanText(input.googleMapsUrl),
    googleRating: Number(input.googleRating) || 0,
    reviewCount: Number(input.reviewCount) || 0,
    ownerOrManagerName: cleanText(input.ownerOrManagerName),
    contactRole: cleanText(input.contactRole),
    contactSource: cleanText(input.contactSource) || "manual",
    pressureWashingAngle: cleanText(input.pressureWashingAngle),
    likelyNeeds: Array.isArray(input.likelyNeeds) ? input.likelyNeeds.map(cleanText).filter(Boolean) : [],
    offer: cleanText(input.offer),
    priorityScore: 0,
    status: normalizePwStatus(input.status),
    queueState: "",
    assignedBatchId: cleanText(input.assignedBatchId) || "",
    batchRank: Number(input.batchRank) || 0,
    source: cleanText(input.source) || "manual",
    sourceQuery: cleanText(input.sourceQuery) || "",
    discoveredAt: cleanText(input.discoveredAt) || createdAt,
    addedToQueueAt: cleanText(input.addedToQueueAt) || null,
    lastContactedAt: cleanText(input.lastContactedAt) || null,
    lastContactResult: cleanText(input.lastContactResult) || "",
    lastConversationAt: cleanText(input.lastConversationAt) || null,
    nextFollowUpAt: cleanText(input.nextFollowUpAt) || null,
    callAttempts: Number(input.callAttempts) || 0,
    conversationCount: Number(input.conversationCount) || 0,
    estimateStatus: cleanText(input.estimateStatus) || "",
    estimateAmount: input.estimateAmount == null ? null : Number(input.estimateAmount) || 0,
    jobStatus: cleanText(input.jobStatus) || "",
    revenueWon: input.revenueWon == null ? null : Number(input.revenueWon) || 0,
    wonAt: cleanText(input.wonAt) || null,
    notes: Array.isArray(input.notes) ? input.notes : [],
    objections: Array.isArray(input.objections) ? input.objections : [],
    followUpNotes: Array.isArray(input.followUpNotes) ? input.followUpNotes : [],
    flags: {
      hasDriveThru: Boolean(input.flags?.hasDriveThru),
      hasOutdoorSeating: Boolean(input.flags?.hasOutdoorSeating),
      dumpsterPadLikely: Boolean(input.flags?.dumpsterPadLikely ?? true),
      curbAppealIssue: Boolean(input.flags?.curbAppealIssue),
    },
    manualPriorityBoost: Number(input.manualPriorityBoost) || 0,
    createdAt,
    updatedAt: cleanText(input.updatedAt) || nowIso(),
  };

  lead.queueState = resolveQueueState(input, lead);

  if (!lead.pressureWashingAngle) lead.pressureWashingAngle = defaultAngle(lead);
  if (!lead.offer) lead.offer = defaultOffer(lead.industry);
  if (!lead.likelyNeeds.length) {
    lead.likelyNeeds = defaultAngle(lead).replace("Likely needs: ", "").replace(/\.$/, "").split(", ");
  }
  lead.priorityScore = computePriorityScore(lead);
  return lead;
}

export async function listPwLeads() {
  const leads = await readLeads();
  return leads
    .map((row) => buildPwLead({ ...row, id: row.id }))
    .sort((a, b) => b.priorityScore - a.priorityScore || String(a.businessName).localeCompare(String(b.businessName)));
}

export async function getPwLeadsFileUpdatedAt() {
  const doc = await readLeadsDocument();
  return doc.updatedAt;
}

export async function replenishActiveBatch() {
  const raw = await readLeads();
  let leads = raw.map((row) => buildPwLead({ ...row, id: row.id }));
  const plan = planBatchPromotion(leads);

  if (!plan.toPromote.length) {
    return { leads, promoted: 0, batchId: null };
  }

  const promotedRows = applyBatchPromotion(
    leads.map((l) => ({ ...l })),
    plan,
  );
  const promoted = plan.toPromote.map((row) => buildPwLead(promotedRows.find((l) => l.id === row.id)));
  const merged = leads.map((lead) => {
    const updated = promotedRows.find((row) => row.id === lead.id);
    return updated ? buildPwLead(updated) : lead;
  });

  await writeLeads(merged);
  return { leads: merged, promoted: plan.toPromote.length, batchId: plan.batchId };
}

export async function getActiveQueueLeads() {
  await replenishActiveBatch();
  return buildActiveQueue(await listPwLeads());
}

export async function getPwLead(id) {
  const leads = await readLeads();
  const found = leads.find((row) => row.id === cleanText(id));
  return found ? buildPwLead(found) : null;
}

export async function upsertPwLead(input) {
  const leads = await readLeads();
  const id = cleanText(input.id);
  const existing = id ? leads.find((row) => row.id === id) : null;
  const merged = existing ? { ...existing, ...input, id: existing.id } : input;
  const next = buildPwLead(merged);
  const index = leads.findIndex((row) => row.id === next.id);
  if (index === -1) {
    leads.push(next);
  } else {
    leads[index] = { ...leads[index], ...next, id: leads[index].id, createdAt: leads[index].createdAt };
  }
  await writeLeads(leads);
  return next;
}

export async function appendPwNote(id, text, kind = "notes") {
  const record = await getPwLead(id);
  if (!record) throw new Error("Lead not found");
  const noteText = cleanText(text);
  if (!noteText) throw new Error("Note cannot be empty");
  const entry = { at: nowIso(), text: noteText };
  const field = kind === "objections" ? "objections" : kind === "followUpNotes" ? "followUpNotes" : "notes";
  const list = Array.isArray(record[field]) ? [...record[field], entry] : [entry];
  return upsertPwLead({ ...record, [field]: list });
}

export async function updatePwLeadStatus(id, patch = {}) {
  const record = await getPwLead(id);
  if (!record) throw new Error("Lead not found");
  const actionId = cleanText(patch.actionId);
  const quick = actionId ? getPwQuickAction(actionId) : null;
  const status = patch.status ? normalizePwStatus(patch.status) : record.status;
  const touch = patch.touchContact === true;
  const now = nowIso();

  const callAttempts = patch.incrementCall ? record.callAttempts + 1 : record.callAttempts;
  const conversationCount = patch.incrementConversation
    ? record.conversationCount + 1
    : record.conversationCount;

  const outcome = applyOutcomeQueueState(record, {
    actionId: actionId || quick?.id,
    status,
    callAttempts,
    nextFollowUpAt: patch.nextFollowUpAt,
  });

  const next = {
    ...record,
    status: outcome.status ? normalizePwStatus(outcome.status) : status,
    queueState: outcome.queueState ?? record.queueState,
    lastContactedAt: touch ? now : record.lastContactedAt,
    lastContactResult:
      patch.lastContactResult ?? quick?.contactResult ?? (touch ? status : record.lastContactResult),
    nextFollowUpAt: patch.nextFollowUpAt ?? outcome.nextFollowUpAt ?? record.nextFollowUpAt,
    callAttempts,
    conversationCount,
    lastConversationAt: patch.incrementConversation ? now : record.lastConversationAt,
    estimateStatus: patch.estimateStatus ?? record.estimateStatus,
    estimateAmount: patch.estimateAmount ?? record.estimateAmount,
    jobStatus: patch.jobStatus ?? record.jobStatus,
    revenueWon: patch.revenueWon ?? record.revenueWon,
    updatedAt: now,
  };

  if (patch.followUpDays) {
    const d = new Date();
    d.setDate(d.getDate() + Number(patch.followUpDays));
    next.nextFollowUpAt = d.toISOString();
    next.status = "follow_up";
    next.queueState = "follow_up";
    next.lastContactResult = "follow_up";
  }

  if (next.status === "estimate_sent" && patch.estimateAmount != null) {
    next.estimateStatus = "sent";
  }
  if (next.status === "estimate_needed") {
    next.estimateStatus = "needed";
  }
  if (next.status === "won" || next.queueState === "won") {
    next.jobStatus = "won";
    next.wonAt = record.wonAt || now;
    next.queueState = "won";
    if (patch.revenueWon != null) {
      next.revenueWon = Number(patch.revenueWon) || 0;
    }
  }
  if (next.queueState === "lost") {
    next.status = "lost";
  }
  if (next.queueState === "suppressed") {
    next.status = "not_interested";
  }

  return upsertPwLead(next);
}

export function mergePwLeadActions(lead) {
  const phone = lead.normalizedPhone || normalizePhoneNumber(lead.phone);
  const textBody = encodeURIComponent(
    `Hey, this is Jaylan with Zeal Power Washing. I called about cleaning the dumpster pad, entrance, or concrete around ${lead.businessName}. I can send a quick estimate if you'd like.`,
  );
  return {
    ...lead,
    hasPhone: Boolean(phone),
    actions: {
      call: phone ? `tel:${phone}` : "",
      text: phone ? `sms:${phone}?body=${textBody}` : "",
    },
  };
}

/** @deprecated use getActiveQueueLeads */
export function buildPwQueue(leads) {
  return buildActiveQueue(leads);
}

export function getNextPwLeadId(queue, currentId) {
  if (!queue.length) return null;
  if (!currentId) return queue[0].id;
  const index = queue.findIndex((row) => row.id === currentId);
  if (index === -1) return queue[0].id;
  return queue[index + 1]?.id ?? queue[0].id;
}

export async function buildPwQueueHealth() {
  const leads = await listPwLeads();
  const lastUpdatedAt = await getPwLeadsFileUpdatedAt();
  return summarizeQueueHealth(leads, { lastUpdatedAt });
}

export async function refreshPwQueue() {
  const result = await replenishActiveBatch();
  const health = summarizeQueueHealth(result.leads, {
    lastUpdatedAt: await getPwLeadsFileUpdatedAt(),
  });
  return { ...result, health };
}
