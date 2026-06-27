import { registerSensor } from "../index.js";

export const crmSensor = {
  id: "sensor_crm_demo",
  name: "CRM Sensor (Demo)",
  description: "Observes CRM-style outcome events using static demo data only.",
  domain: "crm",
  sourceTypes: ["crm_event", "crm_webhook"],
  capabilities: ["observe_crm_events"],
  async collect(context = {}) {
    const suffix = context.uniqueSuffix ? ` ${context.uniqueSuffix}` : "";
    return [
      {
        capturedAt: new Date().toISOString(),
        source: "sensor_crm_demo",
        originalText: `CRM observation${suffix}: Follow-up meeting scheduled with facilities director after fire watch proposal review.`,
        headline: `CRM follow-up meeting scheduled.${suffix}`,
        summary: "Facilities director requested revised fire watch scope for hospital expansion.",
        signalType: "crm_event",
        url: null,
        location: context.location || "Beaumont, TX",
        geo: { lat: null, lng: null },
        metadata: { demo: true, sensor: "crm", eventType: "meeting_scheduled" },
      },
    ];
  },
  async healthCheck() {
    return { ok: true, message: "CRM demo sensor is static and healthy." };
  },
  validate(observation) {
    if (!observation.originalText) throw new Error("Missing originalText");
    return true;
  },
  mapToObservation(observation) {
    return {
      source: observation.source,
      sourceType: "crm_webhook",
      signalType: observation.signalType,
      headline: observation.headline,
      summary: observation.summary,
      url: observation.url,
      location: observation.location,
      geo: observation.geo,
      observedAt: observation.capturedAt,
      provenance: { sensorId: "sensor_crm_demo", demo: true },
    };
  },
};

export function registerCrmSensor() {
  return registerSensor(crmSensor);
}
