import { cleanText } from "../stage1/shared.js";
import { isFoodIndustry, isTargetCity } from "./industries.js";

function daysSince(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export function computePriorityScore(lead = {}) {
  let score = 0;
  const industry = cleanText(lead.industry);

  if (isFoodIndustry(industry)) score += 25;
  if (lead.flags?.hasDriveThru) score += 10;
  if (lead.flags?.hasOutdoorSeating) score += 8;

  const reviews = Number(lead.reviewCount) || 0;
  if (reviews >= 100) score += 10;
  else if (reviews >= 50) score += 5;

  if (isTargetCity(lead.city)) score += 10;
  if (cleanText(lead.normalizedPhone) || cleanText(lead.phone)) score += 10;
  if (cleanText(lead.ownerOrManagerName)) score += 8;
  if (lead.flags?.dumpsterPadLikely) score += 12;
  if (lead.flags?.curbAppealIssue) score += 10;

  const sinceContact = daysSince(lead.lastContactedAt);
  if (sinceContact == null || sinceContact >= 14) score += 5;
  if (sinceContact != null && sinceContact <= 7) score -= 15;

  if (lead.manualPriorityBoost) score += Number(lead.manualPriorityBoost) || 0;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function priorityLabel(score) {
  if (score >= 75) return "Hot";
  if (score >= 55) return "Warm";
  if (score >= 35) return "Nurture";
  return "Low";
}
