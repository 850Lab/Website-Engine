function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeOffer(raw = {}) {
  return {
    id: String(raw.id || "").trim(),
    name: String(raw.name || "").trim(),
    category: String(raw.category || "Unknown").trim(),
    capabilityIds: asArray(raw.capabilityIds),
    pain: asArray(raw.pain),
    promise: String(raw.promise || "").trim(),
    urgency: String(raw.urgency || "").trim(),
    kpis: asArray(raw.kpis),
    channels: asArray(raw.channels),
    bestBuyers: asArray(raw.bestBuyers),
    metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {},
  };
}
