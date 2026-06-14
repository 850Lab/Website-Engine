import { cleanText, nowIso } from "./shared.js";

function sceneFromAnnotation(annotation, index, contextLabel) {
  return {
    sceneNumber: index + 1,
    timestamp: annotation.timestamp,
    duration: annotation.duration,
    target: annotation.target,
    annotationType: annotation.annotation_type,
    narration: annotation.message,
    visualCue: `${contextLabel}: ${annotation.annotation_type} on ${annotation.target}`,
    onScreenText: annotation.message.split(".")[0],
  };
}

function buildScript(title, walkthrough, introLine) {
  const scenes = (walkthrough.timeline ?? []).map((annotation, index) =>
    sceneFromAnnotation(annotation, index, walkthrough.walkthroughType)
  );

  return {
    version: 1,
    generatedAt: nowIso(),
    title,
    walkthroughType: walkthrough.walkthroughType,
    businessName: walkthrough.businessName,
    estimatedDurationSeconds: walkthrough.totalDurationSeconds,
    intro: introLine,
    outro:
      "If this direction looks useful, I can walk through launch timing, content needs, and a simple package quote.",
    scenes,
  };
}

/**
 * Generate Loom narration scripts aligned to annotation timelines.
 */
export function buildLoomScripts({ research, audit, annotations, website }) {
  const businessName = cleanText(research.business.name);
  const city = cleanText(research.business.city) || "your area";

  const auditScript = buildScript(
    `${businessName} — Revenue Leak Audit Walkthrough`,
    annotations.auditWalkthrough,
    `Hi, I reviewed ${businessName} in ${city}. I found ${audit.findings.length} issues that can affect calls and quote requests.`
  );

  const websiteScript = buildScript(
    `${businessName} — Website Redesign Walkthrough`,
    annotations.websiteWalkthrough,
    `Here is a cleaner website direction for ${businessName}, focused on mobile calls, proof, and local search in ${city}.`
  );

  return {
    version: 1,
    generatedAt: nowIso(),
    auditScript,
    websiteScript,
    recordingNotes: [
      "Record at 1920x1080; use annotation JSON as overlay timeline in post-production.",
      "Pause 1–2 seconds between scenes to match timestamp gaps.",
      `Open redesigned preview at ${website.previewUrl} for the website walkthrough.`,
    ],
  };
}
