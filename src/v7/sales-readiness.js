function clampScore(value) {
  return Math.min(10, Math.max(0, Math.round(value * 10) / 10));
}

function ratio(numerator, denominator, fallback = 0) {
  if (!denominator || denominator <= 0) return fallback;
  return numerator / denominator;
}

/**
 * Derive sales readiness from project state, funnel metrics, and optional founder score.
 */
export function calculateSalesReadiness(project, metrics = {}, founderNotes = {}) {
  const hasPreview = Boolean(project?.preview?.previewUrl);
  const hasCity = Boolean(project?.city);
  const hasCategory = Boolean(project?.category);
  const hasContact = Boolean(project?.phone || project?.websiteUrl);
  const isLive = Boolean(project?.flags?.websiteLive || project?.status === "active");

  let previewQuality = 2;
  if (hasPreview) previewQuality += 3;
  if (metrics.previewViews > 0) previewQuality += 1.5;
  if (hasCity && hasCategory) previewQuality += 2;
  if (hasContact) previewQuality += 1;
  if (isLive) previewQuality += 1.5;
  previewQuality = clampScore(previewQuality);

  let offerClarity = 3;
  if (metrics.launchPageViews > 0) offerClarity += 2;
  if (metrics.priceViews > 0) offerClarity += 2;
  if (metrics.launchPageViews > 0 && metrics.priceViews >= metrics.launchPageViews) offerClarity += 1;
  if (metrics.tellMeMoreClicks > metrics.launchClicks && metrics.tellMeMoreClicks > 1) {
    offerClarity -= 1.5;
  }
  if (metrics.launchClicks > 0) offerClarity += 1;
  offerClarity = clampScore(offerClarity);

  let trust = 3;
  if (metrics.purchases > 0) trust += 2;
  if (metrics.activations > 0) trust += 1.5;
  if (metrics.dashboardViews > 0) trust += 1;
  if (hasContact) trust += 1;
  if (isLive) trust += 1.5;
  if (founderNotes.trust && founderNotes.trust.length > 20) trust += 0.5;
  trust = clampScore(trust);

  const ctaRate = ratio(metrics.launchClicks, metrics.launchPageViews, hasPreview ? 0.35 : 0.2);
  let callToAction = clampScore(ctaRate * 10);
  if (metrics.launchPageViews === 0 && hasPreview) callToAction = clampScore(5);
  if (metrics.purchases > 0) callToAction = clampScore(Math.max(callToAction, 7));

  const componentAvg = (previewQuality + offerClarity + trust + callToAction) / 4;
  const founderScore = Number(founderNotes.score);
  const overallReadiness = Number.isFinite(founderScore)
    ? clampScore(componentAvg * 0.75 + founderScore * 0.25)
    : clampScore(componentAvg);

  return {
    previewQuality,
    offerClarity,
    trust,
    callToAction,
    overallReadiness,
    summary:
      overallReadiness >= 8
        ? "Strong — ready for live prospect tests"
        : overallReadiness >= 6
          ? "Promising — refine weak areas before scaling"
          : overallReadiness >= 4
            ? "Early — walk the funnel and capture notes"
            : "Not ready — preview and offer need work",
  };
}
