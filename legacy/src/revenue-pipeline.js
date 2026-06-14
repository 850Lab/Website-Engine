import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";

export const REVENUE_PIPELINE_FILE = join(DATA_DIR, "revenue-pipeline.json");

export const REVENUE_STAGES = [
  "lead",
  "outreach_prepared",
  "outreach_sent",
  "replied",
  "interested",
  "meeting_scheduled",
  "proposal_sent",
  "proposal_viewed",
  "checkout_started",
  "checkout_completed",
  "won",
  "activated",
  "lost",
];

const ACTIVE_STAGES = REVENUE_STAGES.filter((stage) => !["won", "activated", "lost"].includes(stage));
export const REPLY_CHANNELS = ["email", "sms", "phone", "website", "social", "other"];
export const REPLY_SENTIMENTS = ["interested", "neutral", "objection", "not_interested"];
export const MEETING_CHANNELS = ["phone", "google_meet", "zoom", "in_person", "other"];
export const PROPOSAL_STATUSES = ["draft", "sent", "viewed", "accepted", "rejected"];

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function money(value, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100) / 100) : fallback;
}

function clampStage(value, fallback = "lead") {
  const stage = cleanText(value);
  return REVENUE_STAGES.includes(stage) ? stage : fallback;
}

function clampValue(value, allowed, fallback) {
  const next = cleanText(value);
  return allowed.includes(next) ? next : fallback;
}

function defaultState() {
  return {
    version: 1,
    records: [],
  };
}

function makeStageEntry({ previousStage = "", newStage, notes = "", at = nowIso() }) {
  return {
    at,
    previousStage: cleanText(previousStage),
    newStage: clampStage(newStage),
    notes: cleanText(notes),
  };
}

function normalizeReply(reply = {}) {
  const receivedAt = toIsoOrNow(reply.receivedAt || reply.createdAt);
  return {
    replyId: cleanText(reply.replyId) || `reply_${randomUUID()}`,
    receivedAt,
    channel: clampValue(reply.channel, REPLY_CHANNELS, "other"),
    sentiment: clampValue(reply.sentiment, REPLY_SENTIMENTS, "neutral"),
    replyText: cleanText(reply.replyText),
    nextAction: cleanText(reply.nextAction),
    followUpDate: toIsoOrNull(reply.followUpDate),
    evidence: cleanText(reply.evidence || reply.replyText),
    source: cleanText(reply.source) || "manual",
    createdAt: toIsoOrNow(reply.createdAt || receivedAt),
  };
}

function normalizeMeeting(meeting = {}) {
  const scheduledAt = toIsoOrNow(meeting.scheduledAt || meeting.meetingAt || meeting.createdAt);
  return {
    meetingId: cleanText(meeting.meetingId) || `meeting_${randomUUID()}`,
    scheduledAt,
    channel: clampValue(meeting.channel, MEETING_CHANNELS, "phone"),
    notes: cleanText(meeting.notes),
    expectedOutcome: cleanText(meeting.expectedOutcome),
    source: cleanText(meeting.source) || "manual",
    createdAt: toIsoOrNow(meeting.createdAt),
  };
}

function normalizeProposal(proposal = {}) {
  const createdAt = toIsoOrNow(proposal.createdAt || proposal.sentAt);
  return {
    proposalId: cleanText(proposal.proposalId) || `proposal_${randomUUID()}`,
    sentAt: toIsoOrNull(proposal.sentAt) || createdAt,
    amount: money(proposal.amount, 150),
    monthlyAmount: money(proposal.monthlyAmount, 50),
    activationFee: money(proposal.activationFee, 150),
    status: clampValue(proposal.status, PROPOSAL_STATUSES, "draft"),
    proposalNotes: cleanText(proposal.proposalNotes),
    checkoutUrl: cleanText(proposal.checkoutUrl),
    createdAt,
  };
}

function normalizeActivationEvidence(evidence = {}) {
  return {
    evidenceId: cleanText(evidence.evidenceId) || `activation_${randomUUID()}`,
    at: toIsoOrNow(evidence.at),
    source: cleanText(evidence.source) || "manual",
    eventId: cleanText(evidence.eventId),
    eventType: cleanText(evidence.eventType),
    stripeCustomerId: cleanText(evidence.stripeCustomerId),
    stripeSubscriptionId: cleanText(evidence.stripeSubscriptionId),
    billingStatus: cleanText(evidence.billingStatus),
    activationPaid: Boolean(evidence.activationPaid),
    notes: cleanText(evidence.notes),
  };
}

function normalizeRecord(record = {}) {
  const createdAt = toIsoOrNow(record.createdAt);
  const currentStage = clampStage(record.currentStage);
  const history = Array.isArray(record.stageHistory)
    ? record.stageHistory.map((entry) => makeStageEntry(entry))
    : [];
  return {
    revenueId: cleanText(record.revenueId) || `revenue_${randomUUID()}`,
    leadId: cleanText(record.leadId),
    clientId: cleanText(record.clientId),
    currentStage,
    stageHistory: history.length
      ? history
      : [makeStageEntry({ previousStage: "", newStage: currentStage, notes: "Revenue record created.", at: createdAt })],
    replies: Array.isArray(record.replies) ? record.replies.map(normalizeReply) : [],
    meetings: Array.isArray(record.meetings) ? record.meetings.map(normalizeMeeting) : [],
    proposals: Array.isArray(record.proposals) ? record.proposals.map(normalizeProposal) : [],
    activationEvidence: Array.isArray(record.activationEvidence)
      ? record.activationEvidence.map(normalizeActivationEvidence)
      : [],
    estimatedValue: money(record.estimatedValue, 50),
    actualValue: money(record.actualValue, 0),
    createdAt,
    updatedAt: toIsoOrNow(record.updatedAt),
  };
}

function toIsoOrNow(value) {
  if (!value) return nowIso();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString();
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeState(input = {}) {
  return {
    version: 1,
    records: Array.isArray(input.records) ? input.records.map(normalizeRecord) : [],
  };
}

async function readState() {
  try {
    return normalizeState(JSON.parse(await readFile(REVENUE_PIPELINE_FILE, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return defaultState();
    throw err;
  }
}

async function writeState(state) {
  const normalized = normalizeState(state);
  await writeJsonFileSafe(REVENUE_PIPELINE_FILE, normalized);
  return normalized;
}

function findRecordIndex(records, { revenueId = "", leadId = "", clientId = "" } = {}) {
  return records.findIndex((record) =>
    (revenueId && record.revenueId === revenueId) ||
    (leadId && record.leadId === leadId) ||
    (clientId && record.clientId === clientId)
  );
}

function stageAtOrBeyond(record, stage) {
  const current = REVENUE_STAGES.indexOf(record.currentStage);
  const target = REVENUE_STAGES.indexOf(stage);
  return current >= target && target !== -1;
}

function transitionRecord(record, newStage, notes = "") {
  const nextStage = clampStage(newStage, record.currentStage);
  if (record.currentStage === nextStage) {
    return normalizeRecord({
      ...record,
      updatedAt: nowIso(),
    });
  }
  return normalizeRecord({
    ...record,
    currentStage: nextStage,
    stageHistory: [
      ...record.stageHistory,
      makeStageEntry({
        previousStage: record.currentStage,
        newStage: nextStage,
        notes,
      }),
    ],
    updatedAt: nowIso(),
  });
}

export async function listRevenueRecords() {
  return (await readState()).records;
}

export async function createRevenueRecord(input = {}) {
  const state = await readState();
  const leadId = cleanText(input.leadId);
  const clientId = cleanText(input.clientId);
  const existingIndex = findRecordIndex(state.records, { leadId, clientId });
  if (existingIndex !== -1) return state.records[existingIndex];

  const record = normalizeRecord({
    leadId,
    clientId,
    currentStage: input.currentStage || "lead",
    estimatedValue: input.estimatedValue ?? 50,
    actualValue: input.actualValue ?? 0,
  });
  state.records.push(record);
  await writeState(state);
  return record;
}

export async function createRevenueRecordForLead(lead, input = {}) {
  return createRevenueRecord({
    leadId: lead?.id,
    currentStage: input.currentStage || "lead",
    estimatedValue: input.estimatedValue ?? 50,
  });
}

export async function linkRevenueClient({ leadId = "", clientId = "", estimatedValue, actualValue } = {}) {
  const state = await readState();
  const index = findRecordIndex(state.records, { leadId, clientId });
  if (index === -1) {
    const record = normalizeRecord({
      leadId,
      clientId,
      estimatedValue: estimatedValue ?? 50,
      actualValue: actualValue ?? 0,
      currentStage: "lead",
    });
    state.records.push(record);
    await writeState(state);
    return record;
  }
  state.records[index] = normalizeRecord({
    ...state.records[index],
    leadId: state.records[index].leadId || cleanText(leadId),
    clientId: state.records[index].clientId || cleanText(clientId),
    estimatedValue: estimatedValue ?? state.records[index].estimatedValue,
    actualValue: actualValue ?? state.records[index].actualValue,
    updatedAt: nowIso(),
  });
  await writeState(state);
  return state.records[index];
}

export async function transitionRevenueStage(selector = {}, newStage, notes = "") {
  const state = await readState();
  const index = findRecordIndex(state.records, selector);
  if (index === -1) return null;
  state.records[index] = transitionRecord(state.records[index], newStage, notes);
  await writeState(state);
  return state.records[index];
}

export async function transitionRevenueStageIfEarlier(selector = {}, newStage, notes = "") {
  const state = await readState();
  const index = findRecordIndex(state.records, selector);
  if (index === -1) return null;
  if (stageAtOrBeyond(state.records[index], newStage)) return state.records[index];
  state.records[index] = transitionRecord(state.records[index], newStage, notes);
  await writeState(state);
  return state.records[index];
}

export async function getRevenueRecord(selector = {}) {
  const state = await readState();
  const index = findRecordIndex(state.records, selector);
  return index === -1 ? null : state.records[index];
}

export async function logRevenueReply(selector = {}, input = {}) {
  const state = await readState();
  const index = findRecordIndex(state.records, selector);
  if (index === -1) return null;
  const reply = normalizeReply(input);
  const nextStage = reply.sentiment === "interested" ? "interested" : "replied";
  const withReply = normalizeRecord({
    ...state.records[index],
    replies: [...state.records[index].replies, reply],
    updatedAt: nowIso(),
  });
  state.records[index] = transitionRecord(
    withReply,
    nextStage,
    reply.sentiment === "interested"
      ? "Interested reply logged."
      : "Reply logged."
  );
  await writeState(state);
  return {
    record: state.records[index],
    reply,
    recommendedStage: reply.sentiment === "interested" ? "interested" : "replied",
  };
}

export async function logRevenueMeeting(selector = {}, input = {}) {
  const state = await readState();
  const index = findRecordIndex(state.records, selector);
  if (index === -1) return null;
  const meeting = normalizeMeeting(input);
  const withMeeting = normalizeRecord({
    ...state.records[index],
    meetings: [...state.records[index].meetings, meeting],
    updatedAt: nowIso(),
  });
  state.records[index] = transitionRecord(withMeeting, "meeting_scheduled", "Meeting scheduled.");
  await writeState(state);
  return {
    record: state.records[index],
    meeting,
  };
}

export async function logRevenueProposal(selector = {}, input = {}) {
  const state = await readState();
  const index = findRecordIndex(state.records, selector);
  if (index === -1) return null;
  const proposal = normalizeProposal({
    ...input,
    status: input.status || "sent",
    sentAt: input.sentAt || nowIso(),
  });
  const withProposal = normalizeRecord({
    ...state.records[index],
    proposals: [...state.records[index].proposals, proposal],
    estimatedValue: input.amount ?? state.records[index].estimatedValue,
    updatedAt: nowIso(),
  });
  state.records[index] = transitionRecord(withProposal, "proposal_sent", "Proposal created.");
  await writeState(state);
  return {
    record: state.records[index],
    proposal,
  };
}

export async function updateRevenueProposal(selector = {}, proposalId, patch = {}) {
  const state = await readState();
  const index = findRecordIndex(state.records, selector);
  if (index === -1) return null;
  const proposalIndex = state.records[index].proposals.findIndex((proposal) => proposal.proposalId === proposalId);
  if (proposalIndex === -1) return null;
  const proposal = normalizeProposal({
    ...state.records[index].proposals[proposalIndex],
    ...patch,
  });
  const proposals = [...state.records[index].proposals];
  proposals[proposalIndex] = proposal;
  let next = normalizeRecord({
    ...state.records[index],
    proposals,
    updatedAt: nowIso(),
  });
  if (proposal.status === "viewed") {
    next = transitionRecord(next, "proposal_viewed", "Proposal marked viewed.");
  }
  if (proposal.status === "accepted" && stageAtOrBeyond(next, "proposal_sent") && !stageAtOrBeyond(next, "checkout_started")) {
    next = transitionRecord(next, "proposal_viewed", "Proposal accepted; checkout not started yet.");
  }
  state.records[index] = next;
  await writeState(state);
  return {
    record: state.records[index],
    proposal,
  };
}

export async function attachRevenueCheckoutUrl(selector = {}, checkoutUrl = "", notes = "Checkout URL attached.") {
  const state = await readState();
  const index = findRecordIndex(state.records, selector);
  if (index === -1) return null;
  const proposals = [...state.records[index].proposals];
  const proposalIndex = proposals.findLastIndex((proposal) => proposal.status === "accepted" || proposal.status === "sent" || proposal.status === "viewed");
  if (proposalIndex !== -1) {
    proposals[proposalIndex] = normalizeProposal({
      ...proposals[proposalIndex],
      checkoutUrl,
    });
  }
  const withCheckout = normalizeRecord({
    ...state.records[index],
    proposals,
    updatedAt: nowIso(),
  });
  state.records[index] = transitionRecord(withCheckout, "checkout_started", notes);
  await writeState(state);
  return state.records[index];
}

export async function attachRevenueClient(selector = {}, clientId = "") {
  const state = await readState();
  const index = findRecordIndex(state.records, selector);
  if (index === -1) return null;
  state.records[index] = normalizeRecord({
    ...state.records[index],
    clientId,
    updatedAt: nowIso(),
  });
  await writeState(state);
  return state.records[index];
}

export async function markRevenueLost(selector = {}, reason = "") {
  const state = await readState();
  const index = findRecordIndex(state.records, selector);
  if (index === -1) return null;
  state.records[index] = transitionRecord(
    state.records[index],
    "lost",
    cleanText(reason) || "Opportunity marked lost."
  );
  await writeState(state);
  return state.records[index];
}

export async function markRevenueWon(selector = {}, reason = "") {
  const state = await readState();
  const index = findRecordIndex(state.records, selector);
  if (index === -1) return null;
  state.records[index] = transitionRecord(
    state.records[index],
    "won",
    cleanText(reason) || "Opportunity marked won."
  );
  await writeState(state);
  return state.records[index];
}

export async function recordRevenueActivation(selector = {}, evidence = {}) {
  const state = await readState();
  const index = findRecordIndex(state.records, selector);
  if (index === -1) return null;
  const withEvidence = normalizeRecord({
    ...state.records[index],
    activationEvidence: [
      ...state.records[index].activationEvidence,
      normalizeActivationEvidence(evidence),
    ],
    actualValue: evidence.actualValue ?? state.records[index].actualValue,
    updatedAt: nowIso(),
  });
  state.records[index] = transitionRecord(withEvidence, "activated", "Activation proof recorded.");
  await writeState(state);
  return state.records[index];
}

function conversion(records, fromStage, toStage) {
  const from = records.filter((record) => stageAtOrBeyond(record, fromStage)).length;
  if (!from) return 0;
  const to = records.filter((record) => stageAtOrBeyond(record, toStage)).length;
  return Math.round((to / from) * 1000) / 10;
}

function countStage(records, stage) {
  return records.filter((record) => record.currentStage === stage).length;
}

function latestReply(record) {
  return [...record.replies].sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)))[0] ?? null;
}

function latestProposal(record) {
  return [...record.proposals].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] ?? null;
}

function hasMeeting(record) {
  return record.meetings.length > 0 || stageAtOrBeyond(record, "meeting_scheduled");
}

function needsFollowUp(record) {
  const reply = latestReply(record);
  if (!reply) return false;
  if (["meeting_scheduled", "proposal_sent", "checkout_started", "checkout_completed", "activated", "lost"].includes(record.currentStage)) {
    return false;
  }
  return Boolean(reply.nextAction || reply.followUpDate);
}

function isOverdueFollowUp(record) {
  const reply = latestReply(record);
  if (!reply?.followUpDate || !needsFollowUp(record)) return false;
  return new Date(reply.followUpDate).getTime() < Date.now();
}

function proposalNeedsFollowUp(record) {
  const proposal = latestProposal(record);
  if (!proposal || !["sent", "viewed"].includes(proposal.status)) return false;
  return !["checkout_started", "checkout_completed", "activated", "lost"].includes(record.currentStage);
}

function acceptedWithoutCheckout(record) {
  return record.proposals.some((proposal) => proposal.status === "accepted" && !proposal.checkoutUrl) &&
    !stageAtOrBeyond(record, "checkout_started") &&
    record.currentStage !== "lost";
}

function checkoutStartedNotCompleted(record) {
  return stageAtOrBeyond(record, "checkout_started") &&
    !stageAtOrBeyond(record, "checkout_completed") &&
    record.currentStage !== "lost";
}

function checkoutAbandoned(record) {
  if (!checkoutStartedNotCompleted(record)) return false;
  const checkoutStarted = record.stageHistory.findLast((entry) => entry.newStage === "checkout_started");
  if (!checkoutStarted?.at) return false;
  return Date.now() - new Date(checkoutStarted.at).getTime() > 24 * 60 * 60 * 1000;
}

function paidNotActivated(record) {
  return stageAtOrBeyond(record, "checkout_completed") &&
    !stageAtOrBeyond(record, "activated") &&
    record.currentStage !== "lost";
}

function activatedMissingSite(record) {
  return record.currentStage === "activated" && !(record.client?.sites?.length);
}

export async function getRevenuePipelineView({ leads = [], clients = [], sites = [], fulfillmentRecords = [] } = {}) {
  const records = await listRevenueRecords();
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
  const sitesByClientId = new Map();
  for (const site of sites) {
    sitesByClientId.set(site.clientId, [...(sitesByClientId.get(site.clientId) ?? []), site]);
  }
  const clientsById = new Map(clients.map((client) => [
    client.clientId,
    {
      ...client,
      sites: sitesByClientId.get(client.clientId) ?? [],
    },
  ]));
  const fulfillmentByRevenueId = new Map(fulfillmentRecords.map((record) => [record.revenueId, record]));
  const fulfillmentByClientId = new Map(fulfillmentRecords.map((record) => [record.clientId, record]));
  const enrichedRecords = records.map((record) => ({
    ...record,
    lead: record.leadId ? leadsById.get(record.leadId) ?? null : null,
    client: record.clientId ? clientsById.get(record.clientId) ?? null : null,
    fulfillment:
      fulfillmentByRevenueId.get(record.revenueId) ??
      (record.clientId ? fulfillmentByClientId.get(record.clientId) : null) ??
      null,
  }));
  const repliesNeedingFollowUp = enrichedRecords.filter(needsFollowUp);
  const interestedWithoutMeetings = enrichedRecords.filter((record) =>
    record.currentStage === "interested" && !hasMeeting(record)
  );
  const meetingsScheduled = enrichedRecords.filter((record) => hasMeeting(record));
  const overdueFollowUps = enrichedRecords.filter(isOverdueFollowUp);
  const proposalsNeedingFollowUp = enrichedRecords.filter(proposalNeedsFollowUp);
  const acceptedProposalsWithoutCheckout = enrichedRecords.filter(acceptedWithoutCheckout);
  const checkoutStartedNotCompletedRecords = enrichedRecords.filter(checkoutStartedNotCompleted);
  const checkoutAbandonedRecords = enrichedRecords.filter(checkoutAbandoned);
  const paidClientsNotActivated = enrichedRecords.filter(paidNotActivated);
  const activatedClientsMissingSite = enrichedRecords.filter(activatedMissingSite);

  const won = records.filter((record) => record.currentStage === "activated");
  return {
    version: 1,
    stages: REVENUE_STAGES,
    records: enrichedRecords,
    summary: {
      leadsInPipeline: records.filter((record) => ACTIVE_STAGES.includes(record.currentStage)).length,
      replies: records.filter((record) => stageAtOrBeyond(record, "replied")).length,
      meetings: records.filter((record) => stageAtOrBeyond(record, "meeting_scheduled")).length,
      proposals: records.filter((record) => stageAtOrBeyond(record, "proposal_sent")).length,
      checkouts: records.filter((record) => stageAtOrBeyond(record, "checkout_started")).length,
      activations: won.length,
      lostDeals: countStage(records, "lost"),
      totalOpportunities: records.length,
      activeOpportunities: records.filter((record) => ACTIVE_STAGES.includes(record.currentStage)).length,
      wonOpportunities: won.length,
      lostOpportunities: countStage(records, "lost"),
      estimatedRevenue: records.reduce((sum, record) => sum + record.estimatedValue, 0),
      actualRevenue: won.reduce((sum, record) => sum + record.actualValue, 0),
      mrr: won.reduce((sum, record) => sum + (record.actualValue || 50), 0),
      repliesNeedingFollowUp: repliesNeedingFollowUp.length,
      interestedWithoutMeetings: interestedWithoutMeetings.length,
      meetingsScheduled: meetingsScheduled.length,
      overdueFollowUps: overdueFollowUps.length,
      proposalsSent: records.filter((record) => record.proposals.some((proposal) => ["sent", "viewed", "accepted"].includes(proposal.status))).length,
      proposalsAccepted: records.filter((record) => record.proposals.some((proposal) => proposal.status === "accepted")).length,
      checkoutStarted: records.filter((record) => stageAtOrBeyond(record, "checkout_started")).length,
      checkoutCompleted: records.filter((record) => stageAtOrBeyond(record, "checkout_completed")).length,
      checkoutAbandoned: checkoutAbandonedRecords.length,
      proposalsNeedingFollowUp: proposalsNeedingFollowUp.length,
      acceptedProposalsWithoutCheckout: acceptedProposalsWithoutCheckout.length,
      checkoutStartedNotCompleted: checkoutStartedNotCompletedRecords.length,
      paidClientsNotActivated: paidClientsNotActivated.length,
      activatedClientsMissingSite: activatedClientsMissingSite.length,
    },
    funnel: {
      leadToReply: conversion(records, "lead", "replied"),
      replyToMeeting: conversion(records, "replied", "meeting_scheduled"),
      meetingToProposal: conversion(records, "meeting_scheduled", "proposal_sent"),
      proposalToCheckout: conversion(records, "proposal_sent", "checkout_started"),
      checkoutToActivation: conversion(records, "checkout_started", "activated"),
    },
    queues: {
      repliesNeedingFollowUp,
      interestedWithoutMeetings,
      meetingsScheduled,
      overdueFollowUps,
      proposalsNeedingFollowUp,
      acceptedProposalsWithoutCheckout,
      checkoutStartedNotCompleted: checkoutStartedNotCompletedRecords,
      paidClientsNotActivated,
      activatedClientsMissingSite,
    },
  };
}
