import {
  countActivityThisWeek,
  listActivityForProject,
} from "./activity-events.js";
import { publicProjectView } from "./opportunity-project-store.js";
import { cleanText } from "./shared.js";

const PUBLISH_TYPES = new Set(["page_live", "article_live", "local_need_addressed"]);

function relativeTime(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function computeMomentumState(project, activityCount, visitorsLifetime) {
  const stored = cleanText(project.momentumState);
  if (stored === "strong" || stored === "active" || stored === "building") {
    return stored;
  }
  if (visitorsLifetime >= 25 && activityCount >= 3) return "strong";
  if (visitorsLifetime >= 10 && activityCount >= 1) return "active";
  if (activityCount >= 3 || visitorsLifetime >= 5) return "building";
  return "launching";
}

function momentumCopy(state, { visitorsThisWeek, activityThisWeek }) {
  const map = {
    launching: {
      label: "Getting started",
      primary: "Your campaign just went live.",
      subline: "We're watching what people in your area need.",
    },
    building: {
      label: "Building momentum",
      primary: "Something is happening.",
      subline: `${visitorsThisWeek} people visited this week.`,
    },
    active: {
      label: "People are finding you",
      primary: "People in your area are finding you.",
      subline: `${activityThisWeek} updates this week.`,
    },
    strong: {
      label: "Strong local presence",
      primary: "Your visibility is growing.",
      subline: "Keep sharing your site link with customers.",
    },
  };
  return map[state] ?? map.launching;
}

export async function buildCustomerDashboard(project) {
  if (!project) return null;

  const metrics = project.metrics ?? {};
  const visitorsLifetime = Number(metrics.visitorsLifetime) || 0;
  const visitorsThisWeek = Number(metrics.visitorsThisWeek) || 0;
  const visitorsPriorWeek = Number(metrics.visitorsPriorWeek) || 0;
  const visitorDelta =
    visitorsPriorWeek > 0 ? visitorsThisWeek - visitorsPriorWeek : null;

  const activity = await listActivityForProject(project.id, 30);
  const activityThisWeek = await countActivityThisWeek(project.id, [...PUBLISH_TYPES]);
  const updatesThisWeek = activityThisWeek;
  const momentumState = computeMomentumState(project, activity.length, visitorsLifetime);
  const momentum = momentumCopy(momentumState, { visitorsThisWeek, activityThisWeek: updatesThisWeek });

  const lastActivityAt =
    metrics.lastActivityAt ||
    activity[0]?.occurredAt ||
    project.billing?.launchPaidAt ||
    project.createdAt;

  return {
    project: publicProjectView({
      ...project,
      momentumState,
    }),
    siteLive: Boolean(project.flags?.websiteLive),
    momentum: {
      state: momentumState,
      ...momentum,
    },
    movement: {
      visitorsThisWeek,
      visitorDelta,
      updatesThisWeek,
      lastActivityAt,
      lastActivityRelative: relativeTime(lastActivityAt),
    },
    totals: {
      visitorsLifetime,
      contentPublished: Number(metrics.contentPublished) || 0,
    },
    activity: activity.map((entry) => ({
      id: entry.id,
      type: entry.type,
      headline: entry.headline,
      detail: entry.detail,
      geoLabel: entry.geoLabel,
      occurredAt: entry.occurredAt,
      occurredRelative: relativeTime(entry.occurredAt),
      cta: entry.cta,
    })),
  };
}
