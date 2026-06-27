import { registerConnector } from "../index.js";

export const manualDemoConnector = {
  id: "manual_demo",
  name: "Manual Demo Connector",
  sourceType: "connector",
  description: "Static demo observation for Connector SDK validation. No network access.",
  configSchema: {
    type: "object",
    properties: {
      location: { type: "string", default: "Beaumont, TX" },
    },
  },
  async collectObservations(context = {}) {
    const location = context.location || "Beaumont, TX";
    const suffix = context.uniqueSuffix ? ` ${context.uniqueSuffix}` : "";
    return [
      {
        observationId: "demo_observation_static",
        capturedAt: new Date().toISOString(),
        source: "manual_demo",
        originalText:
          `Demo connector observation${suffix}: ABC Manufacturing announces new facility with $40M investment in Beaumont.`,
        headline: `ABC Manufacturing announces new facility.${suffix}`,
        summary: "Company investing $40M in Beaumont.",
        signalType: "company_news",
        url: null,
        location,
        geo: { lat: null, lng: null },
        metadata: { demo: true, uniqueSuffix: context.uniqueSuffix || null },
      },
    ];
  },
  validateObservation(observation) {
    const required = ["originalText", "headline", "summary", "source"];
    for (const field of required) {
      if (!observation[field]) {
        throw new Error(`Demo observation missing ${field}`);
      }
    }
    return true;
  },
  mapObservationToSignalInput(observation) {
    return {
      source: observation.source,
      sourceType: "connector",
      signalType: observation.signalType,
      headline: observation.headline,
      summary: observation.summary,
      url: observation.url,
      location: observation.location,
      geo: observation.geo,
      observedAt: observation.capturedAt,
      provenance: {
        connectorId: "manual_demo",
        demo: true,
      },
    };
  },
};

export function registerManualDemoConnector() {
  return registerConnector(manualDemoConnector);
}
