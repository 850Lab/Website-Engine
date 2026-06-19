import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanText } from "../stage1/shared.js";
import { listPwLeads, buildPwQueueHealth, getActiveQueueLeads } from "./lead-store.js";
import { aggregatePwDailyForLeads } from "./metrics.js";
import { pwStatusLabel } from "./statuses.js";

export const PW_DAILY_TARGETS = {
  calls: 50,
  conversations: 10,
  estimates: 3,
  jobsWon: 1,
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PW_SEARCH_TARGETS_FILE = join(ROOT, "data", "pw-search-targets.json");

function isToday(iso) {
  if (!iso) return false;
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t >= start;
}

export function computePwRecommendation(ctx = {}) {
  const active = Number(ctx.active) || 0;
  const available = Number(ctx.available) || 0;
  const followUpDue = Number(ctx.followUpDue) || 0;
  const callsToday = Number(ctx.callsToday) || 0;
  const conversationsToday = Number(ctx.conversationsToday) || 0;
  const estimatesNeeded = Number(ctx.estimatesNeeded) || 0;
  const estimatesSent = Number(ctx.estimatesSent) || 0;
  const jobsWonToday = Number(ctx.jobsWonToday) || 0;

  if (active === 0 && available === 0) {
    return {
      priority: 1,
      message: "Find new leads first.",
      primary: { label: "Run Lead Search", action: "find-leads" },
      secondary: { label: "View Search Targets", href: "/pw/search-targets" },
    };
  }

  if (active < 10 && available > 0) {
    return {
      priority: 2,
      message: "Refresh your active batch.",
      primary: { label: "Load Fresh Leads", action: "refresh-batch" },
    };
  }

  if (followUpDue > 0) {
    return {
      priority: 3,
      message: "Handle follow-ups before new cold calls.",
      primary: { label: "Call Follow-Ups", href: "/pw/queue?view=follow-ups" },
    };
  }

  if (callsToday < PW_DAILY_TARGETS.calls) {
    return {
      priority: 4,
      message: "Keep calling. Your next target is 50 calls.",
      primary: { label: "Start Calling", href: "/pw/queue" },
    };
  }

  if (conversationsToday < PW_DAILY_TARGETS.conversations) {
    return {
      priority: 5,
      message: "Focus on reaching decision-makers.",
      primary: { label: "Start Calling", href: "/pw/queue" },
    };
  }

  if (estimatesNeeded > 0) {
    return {
      priority: 6,
      message: "Turn interested leads into estimates.",
      primary: { label: "Send Estimates", href: "/pw/queue?view=estimates" },
    };
  }

  if (estimatesSent > 0 && jobsWonToday === 0) {
    return {
      priority: 7,
      message: "Follow up on sent estimates.",
      primary: { label: "Follow Up Estimates", href: "/pw/queue?view=estimates" },
    };
  }

  return {
    priority: 8,
    message: "You're on track. Keep the pipeline moving.",
    primary: { label: "Open Queue", href: "/pw/queue" },
  };
}

export function buildTodayActivity(leads) {
  return leads
    .filter((l) => isToday(l.lastContactedAt))
    .sort((a, b) => Date.parse(b.lastContactedAt) - Date.parse(a.lastContactedAt))
    .slice(0, 5)
    .map((l) => ({
      id: l.id,
      businessName: l.businessName,
      outcome: pwStatusLabel(l.lastContactResult || l.status),
      contactedAt: l.lastContactedAt,
      nextFollowUpAt: l.nextFollowUpAt || null,
    }));
}

export async function loadPwSearchTargets() {
  try {
    const raw = await readFile(PW_SEARCH_TARGETS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

export async function buildPwFounderControl() {
  const leads = await listPwLeads();
  const health = await buildPwQueueHealth();
  const daily = aggregatePwDailyForLeads(leads);
  const queue = await getActiveQueueLeads();
  const activity = buildTodayActivity(leads);

  const recommendation = computePwRecommendation({
    active: health.active,
    available: health.available,
    followUpDue: health.followUpDue,
    callsToday: daily.callsToday,
    conversationsToday: daily.conversationsToday,
    estimatesNeeded: daily.estimatesNeeded,
    estimatesSent: daily.estimatesSent,
    jobsWonToday: daily.jobsWonToday,
  });

  const estimatesToday = leads.filter(
    (l) => l.status === "estimate_sent" && isToday(l.updatedAt),
  ).length;

  return {
    health,
    daily,
    targets: PW_DAILY_TARGETS,
    progress: {
      calls: { current: daily.callsToday, target: PW_DAILY_TARGETS.calls },
      conversations: { current: daily.conversationsToday, target: PW_DAILY_TARGETS.conversations },
      estimates: { current: estimatesToday, target: PW_DAILY_TARGETS.estimates },
      jobsWon: { current: daily.jobsWonToday, target: PW_DAILY_TARGETS.jobsWon },
    },
    recommendation,
    activity,
    nextLead: queue[0]
      ? {
          id: queue[0].id,
          businessName: queue[0].businessName,
          city: queue[0].city,
          phone: queue[0].phone,
        }
      : null,
    findLeadsCommand: "npm run pw:find-leads -- --scrape",
  };
}
