import { cleanText } from "../../stage1/shared.js";

const WEBSITE_QUEUE_STATES = [
  "available",
  "active",
  "follow_up",
  "won",
  "lost",
  "suppressed",
];

export function inferWebsiteQueueStateFromRecord(record = {}) {
  const explicit = cleanText(record.websiteQueueState).toLowerCase().replace(/\s+/g, "_");
  if (WEBSITE_QUEUE_STATES.includes(explicit)) return explicit;

  const status = cleanText(record.outreachStatus).toLowerCase();
  if (status === "won") return "won";
  if (status === "lost") return "lost";
  if (status && status !== "not_contacted") return "active";
  return "available";
}
