export const SENSOR_LIFECYCLE = {
  IDLE: "idle",
  COLLECTING: "collecting",
  NORMALIZING: "normalizing",
  PUBLISHING: "publishing_observation",
  WAITING: "waiting",
  RETRY: "retry",
  DISABLED: "disabled",
  ERROR: "error",
};

export const REQUIRED_SENSOR_FIELDS = [
  "id",
  "name",
  "description",
  "domain",
  "sourceTypes",
  "capabilities",
  "collect",
  "healthCheck",
  "validate",
  "mapToObservation",
];

export const REQUIRED_SENSOR_METHODS = [
  "collect",
  "healthCheck",
  "validate",
  "mapToObservation",
];

export const CANONICAL_OBSERVATION_FIELDS = [
  "originalText",
  "headline",
  "summary",
  "source",
];
