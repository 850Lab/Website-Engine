import { cleanText, nowIso } from "./shared.js";

const ANNOTATION_GAP = 6;

function makeAnnotation({
  timestamp,
  target,
  annotation_type,
  message,
  position = null,
  duration = 4,
}) {
  return {
    timestamp,
    duration,
    target,
    annotation_type,
    message,
    position,
  };
}

function findingsToAuditAnnotations(audit) {
  const timeline = [];
  let cursor = 0;

  timeline.push(
    makeAnnotation({
      timestamp: cursor,
      target: "viewport",
      annotation_type: "caption",
      message: `Revenue leak audit for ${audit.businessName}. Severity score: ${audit.severityScore}/100.`,
      duration: 5,
    })
  );
  cursor += 5 + ANNOTATION_GAP;

  for (const finding of audit.findings.slice(0, 6)) {
    const type =
      finding.severity === "high"
        ? "box"
        : finding.category.includes("cta")
          ? "arrow"
          : finding.category.includes("social")
            ? "highlight"
            : "box";

    timeline.push(
      makeAnnotation({
        timestamp: cursor,
        target: finding.category,
        annotation_type: type,
        message: `${finding.title}. ${finding.recommendedFix}`,
        position: finding.category,
        duration: 5,
      })
    );
    cursor += 5 + ANNOTATION_GAP;
  }

  if (audit.topPriorities?.length) {
    timeline.push(
      makeAnnotation({
        timestamp: cursor,
        target: "summary",
        annotation_type: "zoom",
        message: `Top fixes: ${audit.topPriorities.join(" ")}`,
        duration: 6,
      })
    );
  }

  return {
    version: 1,
    generatedAt: nowIso(),
    walkthroughType: "audit",
    businessName: audit.businessName,
    totalDurationSeconds: cursor + 6,
    timeline,
  };
}

function websiteToAnnotations(website) {
  const timeline = [];
  let cursor = 0;

  timeline.push(
    makeAnnotation({
      timestamp: cursor,
      target: "hero",
      annotation_type: "caption",
      message: `Redesigned homepage for ${website.businessName}: ${website.heroHeadline}`,
      duration: 5,
    })
  );
  cursor += 5 + ANNOTATION_GAP;

  const walkthroughTargets = [
    { target: "hero", type: "highlight", message: `Primary CTA: ${website.ctaText}` },
    { target: "services", type: "box", message: `Core services: ${(website.services ?? []).slice(0, 3).join(", ")}` },
    { target: "trust", type: "highlight", message: `Trust points: ${(website.trustPoints ?? []).slice(0, 2).join("; ")}` },
    { target: "reviews", type: "box", message: "Google reviews surfaced near the decision point." },
    { target: "contact", type: "arrow", message: "Contact and quote form placed for mobile callers." },
    { target: "local-seo", type: "zoom", message: `Local SEO focus: ${website.localSeo?.primaryKeyword ?? "city + service keywords"}` },
  ];

  for (const step of walkthroughTargets) {
    timeline.push(
      makeAnnotation({
        timestamp: cursor,
        target: step.target,
        annotation_type: step.type,
        message: step.message,
        position: step.target,
        duration: 5,
      })
    );
    cursor += 5 + ANNOTATION_GAP;
  }

  return {
    version: 1,
    generatedAt: nowIso(),
    walkthroughType: "website",
    businessName: website.businessName,
    previewUrl: website.previewUrl,
    totalDurationSeconds: cursor,
    timeline,
  };
}

export function buildAnnotationAssets({ audit, website }) {
  const auditWalkthrough = findingsToAuditAnnotations(audit);
  const websiteWalkthrough = websiteToAnnotations(website);

  return {
    version: 1,
    generatedAt: nowIso(),
    auditWalkthrough,
    websiteWalkthrough,
  };
}
