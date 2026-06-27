/** @deprecated Phase 2.2.5 transitional module. Use `engine/sensors` instead. */
import {
  ingestSensorResult,
  registerSensor,
  runSensor as runSensorInternal,
  clearSensorsForTests,
  sensorRegistry as connectorRegistry,
} from "../sensors/index.js";

function adaptConnector(connector) {
  return {
    id: connector.id,
    name: connector.name,
    description: connector.description,
    domain: "legacy_connector",
    sourceTypes: [connector.sourceType],
    capabilities: ["observe_legacy_connector"],
    collect: connector.collectObservations.bind(connector),
    healthCheck: async () => ({ ok: true, message: "Legacy connector shim" }),
    validate: connector.validateObservation.bind(connector),
    mapToObservation: connector.mapObservationToSignalInput.bind(connector),
  };
}

export function registerConnector(connector) {
  return registerSensor(adaptConnector(connector));
}

export function listConnectors() {
  return [...connectorRegistry.values()]
    .filter((sensor) => sensor.domain === "legacy_connector")
    .map((sensor) => ({
      id: sensor.id,
      name: sensor.name,
      sourceType: sensor.sourceTypes[0],
      description: sensor.description,
      configSchema: {},
    }));
}

export function getConnectorById(id) {
  const sensor = connectorRegistry.get(id);
  if (!sensor || sensor.domain !== "legacy_connector") return null;
  return sensor;
}

export async function runConnector(id, context = {}) {
  const result = await runSensorInternal(id, context, { publish: false });
  return {
    connectorId: id,
    observations: result.observations,
    signalInputs: result.signalInputs,
  };
}

export async function ingestConnectorResult(result, options = {}) {
  return ingestSensorResult(
    {
      sensorId: result.connectorId,
      observations: result.observations,
      signalInputs: result.signalInputs,
    },
    {
      ...options,
      provenance: {
        connectorId: result.connectorId,
        ingestChannel: "connector_sdk",
        ...(options.provenance || {}),
      },
    },
  );
}

export { clearSensorsForTests as clearConnectorsForTests, connectorRegistry };
