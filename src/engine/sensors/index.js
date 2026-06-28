import { ingestManualObservation } from "../signals/ingest-manual.js";
import {
  CANONICAL_OBSERVATION_FIELDS,
  REQUIRED_SENSOR_FIELDS,
  REQUIRED_SENSOR_METHODS,
  SENSOR_LIFECYCLE,
} from "./types.js";

const registry = new Map();
const health = new Map();
const lifecycle = new Map();

function nowIso() {
  return new Date().toISOString();
}

function createHealthRecord() {
  return {
    lastRun: null,
    averageRuntimeMs: 0,
    failures: 0,
    successes: 0,
    observationsEmitted: 0,
    runs: 0,
    lastState: SENSOR_LIFECYCLE.IDLE,
    lastError: null,
  };
}

function assertSensorShape(sensor) {
  const errors = [];
  for (const field of REQUIRED_SENSOR_FIELDS) {
    if (sensor[field] == null) errors.push(`Missing sensor field: ${field}`);
  }
  for (const method of REQUIRED_SENSOR_METHODS) {
    if (typeof sensor[method] !== "function") {
      errors.push(`Sensor method must be a function: ${method}`);
    }
  }
  if (!Array.isArray(sensor.sourceTypes) || !sensor.sourceTypes.length) {
    errors.push("Sensor sourceTypes must be a non-empty array");
  }
  if (!Array.isArray(sensor.capabilities) || !sensor.capabilities.length) {
    errors.push("Sensor capabilities must be a non-empty array");
  }
  if (errors.length) {
    throw new Error(errors.join("; "));
  }
}

function setLifecycle(sensorId, state) {
  lifecycle.set(sensorId, state);
  const record = health.get(sensorId);
  if (record) record.lastState = state;
}

function updateHealth(sensorId, patch) {
  const record = health.get(sensorId) || createHealthRecord();
  health.set(sensorId, { ...record, ...patch });
}

export function registerSensor(sensor) {
  assertSensorShape(sensor);
  if (registry.has(sensor.id)) {
    throw new Error(`Sensor already registered: ${sensor.id}`);
  }
  registry.set(sensor.id, { ...sensor, enabled: sensor.enabled !== false });
  health.set(sensor.id, createHealthRecord());
  lifecycle.set(sensor.id, SENSOR_LIFECYCLE.IDLE);
  return registry.get(sensor.id);
}

export function unregisterSensor(id) {
  if (!registry.has(id)) {
    throw new Error(`Unknown sensor: ${id}`);
  }
  registry.delete(id);
  health.delete(id);
  lifecycle.delete(id);
}

export function listSensors() {
  return [...registry.values()].map((sensor) => ({
    id: sensor.id,
    name: sensor.name,
    description: sensor.description,
    domain: sensor.domain,
    sourceTypes: sensor.sourceTypes,
    capabilities: sensor.capabilities,
    enabled: sensor.enabled !== false,
    lifecycle: lifecycle.get(sensor.id) || SENSOR_LIFECYCLE.IDLE,
  }));
}

export function getSensor(id) {
  return registry.get(id) || null;
}

export function getSensorLifecycle(id) {
  return lifecycle.get(id) || null;
}

export function setSensorEnabled(id, enabled) {
  const sensor = getSensor(id);
  if (!sensor) throw new Error(`Unknown sensor: ${id}`);
  sensor.enabled = enabled;
  setLifecycle(id, enabled ? SENSOR_LIFECYCLE.IDLE : SENSOR_LIFECYCLE.DISABLED);
  return sensor;
}

async function normalizeSensorOutput(sensor, observations) {
  setLifecycle(sensor.id, SENSOR_LIFECYCLE.NORMALIZING);
  const validated = [];
  const signalInputs = [];

  for (const observation of observations) {
    sensor.validate(observation);
    for (const field of CANONICAL_OBSERVATION_FIELDS) {
      if (!observation[field]) {
        throw new Error(`Sensor ${sensor.id} observation missing ${field}`);
      }
    }
    validated.push(observation);
    signalInputs.push(sensor.mapToObservation(observation));
  }

  return { observations: validated, signalInputs };
}

export async function runSensor(id, context = {}, options = {}) {
  const sensor = getSensor(id);
  if (!sensor) throw new Error(`Unknown sensor: ${id}`);
  if (sensor.enabled === false) {
    throw new Error(`Sensor is disabled: ${id}`);
  }

  const startedAt = Date.now();
  setLifecycle(sensor.id, SENSOR_LIFECYCLE.COLLECTING);

  try {
    const check = await sensor.healthCheck(context);
    if (!check?.ok) {
      throw new Error(check?.message || `Sensor health check failed: ${id}`);
    }

    const observations = await sensor.collect(context);
    if (!Array.isArray(observations)) {
      throw new Error(`Sensor ${id} collect() must return an array`);
    }

    const normalized = await normalizeSensorOutput(sensor, observations);
    setLifecycle(sensor.id, SENSOR_LIFECYCLE.PUBLISHING);

    let ingested = [];
    if (options.publish !== false && normalized.observations.length) {
      ingested = await ingestSensorResult(
        {
          sensorId: id,
          observations: normalized.observations,
          signalInputs: normalized.signalInputs,
        },
        options,
      );
    }

    setLifecycle(sensor.id, SENSOR_LIFECYCLE.WAITING);

    const runtimeMs = Date.now() - startedAt;
    const prior = health.get(sensor.id) || createHealthRecord();
    const runs = prior.runs + 1;
    const averageRuntimeMs = Math.round(
      (prior.averageRuntimeMs * prior.runs + runtimeMs) / runs,
    );

    updateHealth(sensor.id, {
      lastRun: nowIso(),
      averageRuntimeMs,
      successes: prior.successes + 1,
      observationsEmitted: prior.observationsEmitted + normalized.observations.length,
      runs,
      lastError: null,
    });

    setLifecycle(sensor.id, SENSOR_LIFECYCLE.IDLE);

    return {
      sensorId: id,
      lifecycle: SENSOR_LIFECYCLE.IDLE,
      runtimeMs,
      ...normalized,
      ingested,
    };
  } catch (error) {
    const prior = health.get(sensor.id) || createHealthRecord();
    updateHealth(sensor.id, {
      lastRun: nowIso(),
      failures: prior.failures + 1,
      runs: prior.runs + 1,
      lastError: error.message,
    });
    setLifecycle(sensor.id, SENSOR_LIFECYCLE.ERROR);
    throw error;
  }
}

export async function runAllSensors(context = {}, options = {}) {
  const results = [];
  for (const sensor of registry.values()) {
    if (sensor.enabled === false) continue;
    results.push(await runSensor(sensor.id, context, options));
  }
  return results;
}

export async function ingestSensorResult(result, options = {}) {
  const ingested = [];
  for (let index = 0; index < result.observations.length; index += 1) {
    const observation = result.observations[index];
    const signalInput = result.signalInputs[index];
    const ingestResult = await ingestManualObservation({
      ...signalInput,
      originalText: observation.originalText,
      provenance: {
        sensorId: result.sensorId,
        ingestChannel: "sensor_framework",
        ...(signalInput.provenance || {}),
        ...(options.provenance || {}),
      },
    });
    ingested.push(ingestResult);
  }
  return ingested;
}

export function healthReport() {
  return {
    generatedAt: nowIso(),
    sensors: listSensors().map((sensor) => ({
      ...sensor,
      health: health.get(sensor.id) || createHealthRecord(),
    })),
  };
}

export function clearSensorsForTests() {
  registry.clear();
  health.clear();
  lifecycle.clear();
}

export { registry as sensorRegistry, health as sensorHealth, lifecycle as sensorLifecycle };

export {
  collectFileDropObservations,
  runFileDropSensor,
  registerFileDropSensor,
  FILE_DROP_SENSOR_ID,
} from "./live/file-drop-sensor.js";

export { SENSOR_LIFECYCLE } from "./types.js";
