import { registerSensor } from "../index.js";

export const documentSensor = {
  id: "sensor_document_demo",
  name: "Document Sensor (Demo)",
  description: "Observes structured document events using static demo data only.",
  domain: "documents",
  sourceTypes: ["file_import", "government_feed"],
  capabilities: ["observe_documents"],
  async collect(context = {}) {
    const suffix = context.uniqueSuffix ? ` ${context.uniqueSuffix}` : "";
    return [
      {
        capturedAt: new Date().toISOString(),
        source: "sensor_document_demo",
        originalText: `Document observation${suffix}: Hospital expansion permit filed for 120-bed east campus project.`,
        headline: `Hospital expansion permit filed.${suffix}`,
        summary: "Certificate of need filing indicates 120-bed expansion in Beaumont.",
        signalType: "permit",
        url: null,
        location: context.location || "Beaumont, TX",
        geo: { lat: null, lng: null },
        metadata: { demo: true, sensor: "document", documentType: "permit" },
      },
    ];
  },
  async healthCheck() {
    return { ok: true, message: "Document demo sensor is static and healthy." };
  },
  validate(observation) {
    if (!observation.originalText) throw new Error("Missing originalText");
    return true;
  },
  mapToObservation(observation) {
    return {
      source: observation.source,
      sourceType: "government_feed",
      signalType: observation.signalType,
      headline: observation.headline,
      summary: observation.summary,
      url: observation.url,
      location: observation.location,
      geo: observation.geo,
      observedAt: observation.capturedAt,
      provenance: { sensorId: "sensor_document_demo", demo: true },
    };
  },
};

export function registerDocumentSensor() {
  return registerSensor(documentSensor);
}
