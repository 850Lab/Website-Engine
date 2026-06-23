/** Legacy status → Attempt outcome mapping (campaign-agnostic). */

export const WEBSITE_OUTREACH_TO_ATTEMPT = {
  not_contacted: null,
  contacted: { outcomeId: "no_answer", normalizedOutcome: "attempted" },
  replied: { outcomeId: "interested", normalizedOutcome: "conversation" },
  asked_price: { outcomeId: "interested", normalizedOutcome: "interested" },
  appointment: { outcomeId: "appointment", normalizedOutcome: "appointment" },
  won: { outcomeId: "won", normalizedOutcome: "sale" },
  lost: { outcomeId: "lost", normalizedOutcome: "closed_lost" },
};

export const PW_STATUS_TO_ATTEMPT = {
  new: null,
  called: { outcomeId: "called", normalizedOutcome: "attempted" },
  no_answer: { outcomeId: "no_answer", normalizedOutcome: "attempted" },
  gatekeeper: { outcomeId: "gatekeeper", normalizedOutcome: "conversation" },
  interested: { outcomeId: "interested", normalizedOutcome: "interested" },
  follow_up: { outcomeId: "follow_up", normalizedOutcome: "follow_up" },
  estimate_needed: { outcomeId: "estimate_needed", normalizedOutcome: "interested" },
  estimate_sent: { outcomeId: "estimate_sent", normalizedOutcome: "proposal" },
  won: { outcomeId: "won", normalizedOutcome: "sale" },
  lost: { outcomeId: "lost", normalizedOutcome: "closed_lost" },
  not_interested: { outcomeId: "lost", normalizedOutcome: "closed_lost" },
};

export const FOCUS_EVENT_TO_ATTEMPT = {
  call: { outcomeId: "called", normalizedOutcome: "attempted" },
  conversation: { outcomeId: "interested", normalizedOutcome: "conversation" },
  interested: { outcomeId: "interested", normalizedOutcome: "interested" },
  estimate: { outcomeId: "estimate_sent", normalizedOutcome: "proposal" },
  sale: { outcomeId: "won", normalizedOutcome: "sale" },
};

export const WEBSITE_QUEUE_TO_STATE = {
  available: "available",
  active: "active",
  follow_up: "follow_up",
  won: "completed",
  lost: "completed",
  suppressed: "suppressed",
};

export const PW_QUEUE_TO_STATE = {
  available: "available",
  active: "active",
  won: "completed",
};
