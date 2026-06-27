import { registerSensor } from "../index.js";

function buildObservation({
  source,
  headline,
  summary,
  originalText,
  signalType,
  location = "Beaumont, TX",
  url = null,
  suffix = "",
}) {
  return {
    capturedAt: new Date().toISOString(),
    source,
    originalText: `${originalText}${suffix}`,
    headline: `${headline}${suffix}`,
    summary,
    signalType,
    url,
    location,
    geo: { lat: null, lng: null },
    metadata: { demo: true, sensor: "web" },
  };
}

export const webSensor = {
  id: "sensor_web_demo",
  name: "Web Sensor (Demo)",
  description: "Observes public web-style announcements using static demo data only.",
  domain: "web",
  sourceTypes: ["news_feed", "company_news"],
  capabilities: ["observe_web_content"],
  async collect(context = {}) {
    const suffix = context.uniqueSuffix ? ` ${context.uniqueSuffix}` : "";
    return [
      buildObservation({
        source: "sensor_web_demo",
        headline: "ABC Manufacturing announces new facility.",
        summary: "Company investing $40M in Beaumont after web announcement.",
        originalText:
          "Web observation: ABC Manufacturing announces new facility with $40M investment in Beaumont.",
        signalType: "company_news",
        location: context.location || "Beaumont, TX",
        url: "https://example.com/demo/abc-manufacturing",
        suffix,
      }),
    ];
  },
  async healthCheck() {
    return { ok: true, message: "Web demo sensor is static and healthy." };
  },
  validate(observation) {
    if (!observation.originalText) throw new Error("Missing originalText");
    return true;
  },
  mapToObservation(observation) {
    return {
      source: observation.source,
      sourceType: "news_feed",
      signalType: observation.signalType,
      headline: observation.headline,
      summary: observation.summary,
      url: observation.url,
      location: observation.location,
      geo: observation.geo,
      observedAt: observation.capturedAt,
      provenance: { sensorId: "sensor_web_demo", demo: true },
    };
  },
};

export function registerWebSensor() {
  return registerSensor(webSensor);
}
