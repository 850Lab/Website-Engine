import { cleanText } from "../stage1/shared.js";

export const PW_STATUSES = [
  "new",
  "called",
  "no_answer",
  "gatekeeper",
  "interested",
  "follow_up",
  "estimate_needed",
  "estimate_sent",
  "won",
  "lost",
  "not_interested",
];

export const PW_STATUS_LABELS = {
  new: "New",
  called: "Called",
  no_answer: "No Answer",
  gatekeeper: "Gatekeeper",
  interested: "Interested",
  follow_up: "Follow Up",
  estimate_needed: "Estimate Needed",
  estimate_sent: "Estimate Sent",
  won: "Won",
  lost: "Lost",
  not_interested: "Not Interested",
};

/** Legacy status slugs from earlier builds. */
const STATUS_ALIASES = {
  not_contacted: "new",
  contacted: "called",
  needs_quote: "estimate_needed",
  needs_visit: "estimate_needed",
  needs_before_photos: "estimate_needed",
};

export const PW_CLOSED_STATUSES = new Set(["won", "lost", "not_interested"]);

export const PW_QUICK_ACTIONS = [
  {
    id: "called",
    status: "called",
    label: "Called",
    incrementCall: true,
    touchContact: true,
    contactResult: "called",
  },
  {
    id: "no_answer",
    status: "no_answer",
    label: "No Answer",
    incrementCall: true,
    touchContact: true,
    contactResult: "no_answer",
  },
  {
    id: "gatekeeper",
    status: "gatekeeper",
    label: "Gatekeeper",
    incrementCall: true,
    touchContact: true,
    bumpConversation: true,
    contactResult: "gatekeeper",
  },
  {
    id: "interested",
    status: "interested",
    label: "Interested",
    touchContact: true,
    bumpConversation: true,
    contactResult: "interested",
  },
  {
    id: "follow_up",
    status: "follow_up",
    label: "Follow Up",
    touchContact: true,
    needsFollowUpDate: true,
    contactResult: "follow_up",
  },
  {
    id: "estimate_needed",
    status: "estimate_needed",
    label: "Estimate Needed",
    touchContact: true,
    contactResult: "estimate_needed",
  },
  {
    id: "estimate_sent",
    status: "estimate_sent",
    label: "Estimate Sent",
    touchContact: true,
    needsEstimateAmount: true,
    contactResult: "estimate_sent",
  },
  {
    id: "won",
    status: "won",
    label: "Won",
    touchContact: true,
    needsRevenueWon: true,
    contactResult: "won",
  },
  {
    id: "lost",
    status: "lost",
    label: "Lost",
    touchContact: true,
    contactResult: "lost",
  },
  {
    id: "not_interested",
    status: "not_interested",
    label: "Not Interested",
    touchContact: true,
    contactResult: "not_interested",
  },
];

export function normalizePwStatus(value) {
  const raw = cleanText(value).toLowerCase().replace(/\s+/g, "_");
  const mapped = STATUS_ALIASES[raw] ?? raw;
  return PW_STATUSES.includes(mapped) ? mapped : "new";
}

export function pwStatusLabel(status) {
  return PW_STATUS_LABELS[normalizePwStatus(status)] ?? status;
}

export function getPwQuickAction(actionId) {
  return PW_QUICK_ACTIONS.find((a) => a.id === actionId) ?? null;
}
