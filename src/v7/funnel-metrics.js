import { listFunnelEventsForProject } from "./funnel-events.js";

const METRIC_EVENTS = {
  previewViews: "preview_viewed",
  launchPageViews: "launch_page_viewed",
  priceViews: "price_viewed",
  tellMeMoreClicks: "tell_me_more",
  launchClicks: "launch_started",
  purchases: "launch_purchased",
};

export async function buildFunnelMetrics(projectId) {
  const events = await listFunnelEventsForProject(projectId, 10000);
  const counts = {
    previewViews: 0,
    launchPageViews: 0,
    priceViews: 0,
    tellMeMoreClicks: 0,
    launchClicks: 0,
    purchases: 0,
    activations: 0,
    dashboardViews: 0,
  };

  for (const entry of events) {
    switch (entry.event) {
      case METRIC_EVENTS.previewViews:
        counts.previewViews += 1;
        break;
      case METRIC_EVENTS.launchPageViews:
        counts.launchPageViews += 1;
        break;
      case METRIC_EVENTS.priceViews:
        counts.priceViews += 1;
        break;
      case METRIC_EVENTS.tellMeMoreClicks:
        counts.tellMeMoreClicks += 1;
        break;
      case METRIC_EVENTS.launchClicks:
        counts.launchClicks += 1;
        break;
      case METRIC_EVENTS.purchases:
        counts.purchases += 1;
        break;
      case "activation_completed":
        counts.activations += 1;
        break;
      case "dashboard_viewed":
        counts.dashboardViews += 1;
        break;
      default:
        break;
    }
  }

  const conversionPercent =
    counts.previewViews > 0
      ? Math.round((counts.purchases / counts.previewViews) * 1000) / 10
      : null;

  const launchConversionPercent =
    counts.launchPageViews > 0
      ? Math.round((counts.purchases / counts.launchPageViews) * 1000) / 10
      : null;

  return {
    ...counts,
    conversionPercent,
    launchConversionPercent,
    totalEvents: events.length,
  };
}
