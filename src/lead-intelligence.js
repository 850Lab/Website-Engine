const CHAIN_NAMES = [
  "orkin",
  "terminix",
  "trugreen",
  "rentokil",
  "mosquito joe",
  "arrow exterminators",
  "moxie pest control",
  "aptive",
  "the grounds guys",
  "u.s. lawns",
  "servpro",
  "merry maids",
  "mr. rooter",
  "benjamin franklin plumbing",
  "one hour heating",
  "aire serv",
  "precision door",
  "leaf filter",
  "window genie",
];

const CHAIN_INDICATORS = [
  "franchise",
  "national chain",
  "corporate",
  "locations nationwide",
  "nationwide",
  "serving all",
  "book.housecallpro.com",
  "utm_campaign=lcl",
  "branchid=",
  "locations/",
  "/quote",
  "/book-now",
];

const CORPORATE_DOMAINS = [
  "orkin.com",
  "terminix.com",
  "trugreen.com",
  "rentokil.com",
  "servpro.com",
  "merrymaids.com",
  "mrrooter.com",
  "groundsguys.com",
  "uslawns.com",
];

function clean(value) {
  return String(value ?? "").trim();
}

function dayStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayEnd(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysSince(value, now = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function latestTouchAt(lead) {
  const history = Array.isArray(lead.outreachHistory) ? lead.outreachHistory : [];
  const historyTimes = history
    .map((item) => new Date(item?.at).getTime())
    .filter(Number.isFinite);
  const candidates = [
    lead.lastContactedAt,
    lead.contactedAt,
    lead.lastFollowUpAt,
    historyTimes.length ? new Date(Math.max(...historyTimes)).toISOString() : null,
  ].filter(Boolean);
  return candidates.sort((a, b) => String(b).localeCompare(String(a)))[0] ?? null;
}

export function analyzeChainSignals(lead) {
  const text = [
    lead.businessName,
    lead.category,
    lead.websiteUrl,
    lead.notes,
  ]
    .map((value) => clean(value).toLowerCase())
    .join(" ");

  let chainConfidence = 0;
  const reasons = [];

  const matchedName = CHAIN_NAMES.find((name) => text.includes(name));
  if (matchedName) {
    chainConfidence += 70;
    reasons.push(`Known chain brand: ${matchedName}`);
  }

  const matchedIndicator = CHAIN_INDICATORS.find((indicator) => text.includes(indicator));
  if (matchedIndicator) {
    chainConfidence += 25;
    reasons.push(`Chain/franchise indicator: ${matchedIndicator}`);
  }

  const matchedDomain = CORPORATE_DOMAINS.find((domain) => text.includes(domain));
  if (matchedDomain) {
    chainConfidence += 35;
    reasons.push(`Corporate domain: ${matchedDomain}`);
  }

  if (/\b(llc|inc|co)\b/i.test(clean(lead.businessName)) && /locations?|branch/i.test(text)) {
    chainConfidence += 10;
    reasons.push("Business text references locations/branches.");
  }

  chainConfidence = Math.min(100, chainConfidence);
  return {
    likelyFranchise: chainConfidence >= 60,
    chainConfidence,
    chainReasons: reasons,
  };
}

export function computeLeadVelocity(lead, nowInput = new Date()) {
  const now = new Date(nowInput);
  const touchAt = latestTouchAt(lead);
  const daysSinceLastTouch = daysSince(touchAt, now);
  const nextFollowUpAt = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
  const validNextFollowUp = nextFollowUpAt && !Number.isNaN(nextFollowUpAt.getTime());
  const followUpDue = Boolean(lead.followUpNeeded && validNextFollowUp && nextFollowUpAt <= dayEnd(now));
  const followUpOverdue = Boolean(lead.followUpNeeded && validNextFollowUp && nextFollowUpAt < dayStart(now));
  const approvedNeverContacted =
    lead.previewStatus === "approved" &&
    !["contacted", "replied", "won", "lost"].includes(lead.pipelineStage);
  const staleLead =
    !["new", "preview_ready", "won", "lost"].includes(lead.pipelineStage) &&
    daysSinceLastTouch !== null &&
    daysSinceLastTouch >= 7;

  const intelligence = [];
  if (followUpOverdue) intelligence.push("Follow-up overdue");
  else if (followUpDue) intelligence.push("Follow-up due today");
  if (approvedNeverContacted) intelligence.push("Preview approved but never contacted");
  if (lead.replyStatus === "contacted" && daysSinceLastTouch >= 3) {
    intelligence.push(`No reply after ${daysSinceLastTouch} days`);
  }
  if ((Number(lead.followUpCount) || 0) >= 1 && lead.replyStatus !== "replied") {
    intelligence.push("Needs second follow-up");
  }
  if (staleLead) intelligence.push("Lead stalled for 7+ days");
  if (lead.likelyFranchise) intelligence.push("Likely franchise or chain");

  const score = Number(lead.score) || 0;
  const reviews = Number(lead.googleReviewCount) || 0;
  let urgencyScore = 0;
  if (followUpOverdue) urgencyScore += 45;
  else if (followUpDue) urgencyScore += 35;
  if (approvedNeverContacted) urgencyScore += 30;
  if (lead.replyStatus === "replied") urgencyScore += 45;
  if (staleLead) urgencyScore += 18;
  urgencyScore += Math.min(20, Math.floor(score * 0.8));
  if (lead.previewStatus === "approved") urgencyScore += 10;
  if (lead.websiteQuality === "weak" || !lead.websiteUrl) urgencyScore += 8;
  if (clean(lead.phone)) urgencyScore += 5;
  if (lead.likelyFranchise) urgencyScore -= 25;
  if (["won", "lost"].includes(lead.pipelineStage)) urgencyScore = 0;
  urgencyScore = Math.max(0, Math.min(100, urgencyScore));

  let closeLikelihood = 0;
  closeLikelihood += Math.min(35, score * 2);
  closeLikelihood += reviews >= 100 ? 15 : reviews >= 25 ? 10 : reviews >= 10 ? 6 : 0;
  if (lead.previewStatus === "approved") closeLikelihood += 15;
  if (lead.replyStatus === "replied") closeLikelihood += 25;
  if (clean(lead.phone)) closeLikelihood += 6;
  if (lead.websiteQuality === "weak" || !lead.websiteUrl) closeLikelihood += 8;
  if (lead.likelyFranchise) closeLikelihood -= 25;
  if (lead.pipelineStage === "lost") closeLikelihood = 0;
  if (lead.pipelineStage === "won") closeLikelihood = 100;
  closeLikelihood = Math.max(0, Math.min(100, closeLikelihood));

  const outreachPriority =
    urgencyScore >= 65 || closeLikelihood >= 70
      ? "High Priority"
      : urgencyScore >= 35 || closeLikelihood >= 45
        ? "Medium Priority"
        : "Low Priority";

  const suggestedNextAction =
    lead.pipelineStage === "won"
      ? "Won - document outcome"
      : lead.pipelineStage === "lost"
        ? "Lost - no action"
        : lead.replyStatus === "replied"
          ? "Reply received - follow up personally"
          : followUpOverdue
            ? "Complete overdue follow-up"
            : followUpDue
              ? "Send scheduled follow-up"
              : approvedNeverContacted
                ? "Contact lead now"
                : lead.previewStatus !== "approved"
                  ? "Generate or approve preview"
                  : staleLead
                    ? "Revive or close stale lead"
                    : "Monitor";

  return {
    latestTouchAt: touchAt,
    daysSinceLastTouch,
    followUpDue,
    followUpOverdue,
    approvedNeverContacted,
    staleLead,
    urgencyScore,
    closeLikelihood,
    outreachPriority,
    suggestedNextAction,
    intelligence,
    hotLead: lead.replyStatus === "replied" || (outreachPriority === "High Priority" && !lead.likelyFranchise),
  };
}

export function priorityRank(lead) {
  const priority = lead.outreachPriority ?? "Low Priority";
  return priority === "High Priority" ? 3 : priority === "Medium Priority" ? 2 : 1;
}

export function compareOperationalPriority(a, b) {
  return (
    priorityRank(b) - priorityRank(a) ||
    (Number(b.urgencyScore) || 0) - (Number(a.urgencyScore) || 0) ||
    (Number(b.closeLikelihood) || 0) - (Number(a.closeLikelihood) || 0) ||
    (Number(b.score) || 0) - (Number(a.score) || 0)
  );
}
