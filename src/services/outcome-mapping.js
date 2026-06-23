/** Legacy ↔ schema outcome and queue-state mapping for write cutover. */

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

export const WEBSITE_OUTREACH_TO_QUEUE_STATE = {
  not_contacted: "available",
  contacted: "active",
  replied: "follow_up",
  asked_price: "follow_up",
  appointment: "follow_up",
  won: "completed",
  lost: "completed",
};

export const PW_LEGACY_QUEUE_TO_SCHEMA_STATE = {
  available: "available",
  active: "active",
  follow_up: "follow_up",
  won: "completed",
  lost: "completed",
  suppressed: "suppressed",
};

const FALLBACK_NORMALIZED = {
  no_answer: "attempted",
  called: "attempted",
  gatekeeper: "conversation",
  replied: "conversation",
  interested: "interested",
  asked_price: "interested",
  estimate_sent: "proposal",
  appointment: "appointment",
  won: "sale",
  lost: "closed_lost",
  not_interested: "closed_lost",
  follow_up: "follow_up",
};

export function resolveOutcomeMapping(campaign, { outcomeKey, channel = "website" }) {
  const needle = String(outcomeKey ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!needle) return null;

  const labels = Array.isArray(campaign?.config?.outcomeLabels) ? campaign.config.outcomeLabels : [];
  const fromCampaign = labels.find(
    (row) =>
      String(row.id ?? "")
        .toLowerCase()
        .replace(/\s+/g, "_") === needle ||
      String(row.label ?? "")
        .toLowerCase()
        .replace(/\s+/g, "_") === needle,
  );
  if (fromCampaign?.normalized) {
    return {
      outcomeId: fromCampaign.id,
      normalizedOutcome: fromCampaign.normalized,
      source: "campaign.outcomeLabels",
    };
  }

  const table = channel === "pressure-washing" ? PW_STATUS_TO_ATTEMPT : WEBSITE_OUTREACH_TO_ATTEMPT;
  const mapped = table[needle];
  if (mapped) {
    return { ...mapped, source: "status-map" };
  }

  const normalizedOutcome = FALLBACK_NORMALIZED[needle];
  if (normalizedOutcome) {
    return { outcomeId: needle, normalizedOutcome, source: "fallback" };
  }

  return null;
}

export function mapWebsiteOutreachToQueueState(outreachStatus) {
  const key = String(outreachStatus ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  return WEBSITE_OUTREACH_TO_QUEUE_STATE[key] ?? "active";
}

export function mapPwLegacyQueueToSchemaState(queueState) {
  const key = String(queueState ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  return PW_LEGACY_QUEUE_TO_SCHEMA_STATE[key] ?? "active";
}

export function inferPwQueueStateFromPatch(patch = {}) {
  const actionId = String(patch.actionId ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  const status = String(patch.status ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  const key = actionId || status;

  if (key === "won") return "won";
  if (key === "lost") return "lost";
  if (key === "not_interested") return "suppressed";
  if (key === "no_answer") return (Number(patch.callAttempts) || 0) >= 3 ? "follow_up" : "active";
  if (key === "called") return "active";
  if (["gatekeeper", "interested", "estimate_needed", "estimate_sent", "follow_up"].includes(key)) {
    return "follow_up";
  }
  return "active";
}

export function mapPwStatusToOutreachStatus(status) {
  const value = String(status ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!value || value === "new") return "not_contacted";
  return value;
}
