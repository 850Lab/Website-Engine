export function normalizeHeadline(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeLocation(location) {
  if (!location) return "";
  if (typeof location === "string") {
    return location.trim().toLowerCase();
  }
  return [location.city, location.state, location.facilityName, location.country]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

export function normalizeObservedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

export function buildCalibratedDedupKey(input = {}) {
  if (input.dedupKey && input.preserveDedupKey === true) {
    return String(input.dedupKey);
  }

  const contentHash =
    input.contentHash ||
    input.provenance?.contentHash ||
    (typeof input.hash === "string" ? input.hash.replace(/^sha256:/, "") : "") ||
    "";

  const semanticEventType = input.semanticEventType || input.signalType || "";

  const parts = [
    input.source,
    normalizeHeadline(input.headline),
    input.signalType,
    normalizeLocation(input.location),
    normalizeObservedAt(input.observedAt),
    contentHash,
    semanticEventType,
  ].filter(Boolean);

  return parts.join("|");
}
