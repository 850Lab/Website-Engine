import { ingestManualObservation } from "../signals/ingest-manual.js";

const registry = new Map();

const REQUIRED_CONNECTOR_FIELDS = [
  "id",
  "name",
  "sourceType",
  "description",
  "configSchema",
  "collectObservations",
  "validateObservation",
  "mapObservationToSignalInput",
];

function assertConnectorShape(connector) {
  const errors = [];
  for (const field of REQUIRED_CONNECTOR_FIELDS) {
    if (connector[field] == null) errors.push(`Missing connector field: ${field}`);
  }
  for (const field of ["collectObservations", "validateObservation", "mapObservationToSignalInput"]) {
    if (typeof connector[field] !== "function") {
      errors.push(`Connector field must be a function: ${field}`);
    }
  }
  if (errors.length) {
    throw new Error(errors.join("; "));
  }
}

export function registerConnector(connector) {
  assertConnectorShape(connector);
  if (registry.has(connector.id)) {
    throw new Error(`Connector already registered: ${connector.id}`);
  }
  registry.set(connector.id, connector);
  return connector;
}

export function listConnectors() {
  return [...registry.values()].map((connector) => ({
    id: connector.id,
    name: connector.name,
    sourceType: connector.sourceType,
    description: connector.description,
    configSchema: connector.configSchema,
  }));
}

export function getConnectorById(id) {
  return registry.get(id) || null;
}

export async function runConnector(id, context = {}) {
  const connector = getConnectorById(id);
  if (!connector) {
    throw new Error(`Unknown connector: ${id}`);
  }

  const observations = await connector.collectObservations(context);
  if (!Array.isArray(observations)) {
    throw new Error(`Connector ${id} must return an array from collectObservations()`);
  }

  const validatedObservations = [];
  const signalInputs = [];

  for (const observation of observations) {
    connector.validateObservation(observation);
    validatedObservations.push(observation);
    signalInputs.push(connector.mapObservationToSignalInput(observation));
  }

  return {
    connectorId: id,
    observations: validatedObservations,
    signalInputs,
  };
}

export async function ingestConnectorResult(result, options = {}) {
  const ingested = [];
  for (let index = 0; index < result.observations.length; index += 1) {
    const observation = result.observations[index];
    const signalInput = result.signalInputs[index];
    const ingestResult = await ingestManualObservation({
      ...signalInput,
      originalText: observation.originalText,
      provenance: {
        connectorId: result.connectorId,
        ingestChannel: "connector_sdk",
        ...(signalInput.provenance || {}),
        ...(options.provenance || {}),
      },
    });
    ingested.push(ingestResult);
  }
  return ingested;
}

export function clearConnectorsForTests() {
  registry.clear();
}

export { registry as connectorRegistry };
