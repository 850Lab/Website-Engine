import { entityIdFromLabel } from "../facts/entity-id.js";

export const SUPPORTED_PREDICATES = [
  "announced",
  "located_in",
  "mentions_entity",
  "has_signal_type",
  "has_source",
  "has_url",
  "affects_market",
  "affects_capability",
  "has_urgency",
  "observed_at",
];

const EXTRACTOR = "fact_builder_v0";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatLocation(location) {
  if (!location) return null;
  if (typeof location === "string") return location.trim() || null;
  const parts = [location.city, location.state].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return location.address || location.facilityName || null;
}

function resolveSubjectLabel(signal, headlineSubject = null) {
  if (headlineSubject) return headlineSubject;
  const entities = asArray(signal.entitiesMentioned);
  if (entities.length) return String(entities[0]).trim();
  const headline = String(signal.headline || "").trim();
  if (headline) {
    const firstSegment = headline.split(/[:\-—]/)[0]?.trim();
    if (firstSegment && firstSegment.length <= 120) return firstSegment;
  }
  return "Unknown subject";
}

function buildFactDraft(signal, draft) {
  const subjectLabel = draft.subjectLabel || resolveSubjectLabel(signal);
  return {
    signalIds: [signal.id],
    subjectLabel,
    subjectEntityId: entityIdFromLabel(subjectLabel),
    predicate: draft.predicate,
    object: draft.object ?? null,
    objectEntityId: draft.objectEntityId ?? null,
    value: draft.value ?? null,
    unit: draft.unit ?? null,
    timeRange: draft.timeRange ?? { start: signal.observedAt || null, end: null },
    location: draft.location ?? signal.location ?? null,
    confidence: typeof draft.confidence === "number" ? draft.confidence : signal.confidence ?? 0.7,
    evidence: draft.evidence ?? [
      {
        type: "signal_field",
        ref: signal.id,
        field: draft.evidenceField || draft.predicate,
        confidence: signal.confidence ?? 0.7,
      },
    ],
    extractor: EXTRACTOR,
    source: signal.source || null,
    metadata: {
      signalType: signal.signalType,
      ...(draft.metadata || {}),
    },
  };
}

function extractAnnouncedFacts(signal, subjectLabel) {
  const headline = String(signal.headline || "").trim();
  const facts = [];
  const announcesMatch = headline.match(/^(.+?)\s+announces\s+(.+?)(?:\s+in\s+(.+?))?\.?$/i);

  if (announcesMatch) {
    const parsedSubject = announcesMatch[1].trim();
    const announcement = announcesMatch[2].trim();
    const locationHint = announcesMatch[3]?.trim() || null;
    const resolvedSubject = parsedSubject || subjectLabel;

    facts.push(
      buildFactDraft(signal, {
        subjectLabel: resolvedSubject,
        predicate: "announced",
        object: announcement,
        evidenceField: "headline",
      }),
    );

    if (locationHint || formatLocation(signal.location)) {
      const preferredLocation = formatLocation(signal.location) || locationHint;
      facts.push(
        buildFactDraft(signal, {
          subjectLabel: resolvedSubject,
          predicate: "located_in",
          object: preferredLocation,
          evidenceField: formatLocation(signal.location) ? "location" : "headline",
        }),
      );
    }
  } else if (headline) {
    facts.push(
      buildFactDraft(signal, {
        subjectLabel,
        predicate: "announced",
        object: headline,
        confidence: Math.min(signal.confidence ?? 0.7, 0.55),
        evidenceField: "headline",
        metadata: { conservative: true, reason: "headline_only" },
      }),
    );
  }

  return facts;
}

export function buildFactsFromSignal(signal) {
  if (!signal?.id) {
    throw new Error("buildFactsFromSignal requires a signal with id");
  }

  const subjectLabel = resolveSubjectLabel(signal);
  const facts = [];

  facts.push(...extractAnnouncedFacts(signal, subjectLabel));

  const locationText = formatLocation(signal.location);
  if (locationText && !facts.some((fact) => fact.predicate === "located_in")) {
    facts.push(
      buildFactDraft(signal, {
        subjectLabel,
        predicate: "located_in",
        object: locationText,
        evidenceField: "location",
      }),
    );
  }

  if (signal.summary) {
    facts.push(
      buildFactDraft(signal, {
        subjectLabel,
        predicate: "announced",
        object: String(signal.summary).trim().slice(0, 240),
        confidence: Math.min(signal.confidence ?? 0.7, 0.6),
        evidenceField: "summary",
        metadata: { conservative: true, reason: "summary_statement" },
      }),
    );
  }

  if (signal.signalType) {
    facts.push(
      buildFactDraft(signal, {
        subjectLabel,
        predicate: "has_signal_type",
        object: signal.signalType,
        evidenceField: "signalType",
      }),
    );
  }

  if (signal.source) {
    facts.push(
      buildFactDraft(signal, {
        subjectLabel,
        predicate: "has_source",
        object: signal.source,
        evidenceField: "source",
      }),
    );
  }

  if (signal.url) {
    facts.push(
      buildFactDraft(signal, {
        subjectLabel,
        predicate: "has_url",
        object: signal.url,
        evidenceField: "url",
      }),
    );
  }

  if (signal.urgency) {
    facts.push(
      buildFactDraft(signal, {
        subjectLabel,
        predicate: "has_urgency",
        object: signal.urgency,
        evidenceField: "urgency",
      }),
    );
  }

  if (signal.observedAt) {
    facts.push(
      buildFactDraft(signal, {
        subjectLabel,
        predicate: "observed_at",
        object: signal.observedAt,
        evidenceField: "observedAt",
      }),
    );
  }

  for (const entity of asArray(signal.entitiesMentioned)) {
    const label = String(entity).trim();
    if (!label) continue;
    facts.push(
      buildFactDraft(signal, {
        subjectLabel,
        predicate: "mentions_entity",
        object: label,
        objectEntityId: entityIdFromLabel(label),
        evidenceField: "entitiesMentioned",
      }),
    );
  }

  for (const market of asArray(signal.affectedMarkets)) {
    const label = String(market).trim();
    if (!label) continue;
    facts.push(
      buildFactDraft(signal, {
        subjectLabel,
        predicate: "affects_market",
        object: label,
        evidenceField: "affectedMarkets",
      }),
    );
  }

  for (const capability of asArray(signal.affectedCapabilities)) {
    const label = String(capability).trim();
    if (!label) continue;
    facts.push(
      buildFactDraft(signal, {
        subjectLabel,
        predicate: "affects_capability",
        object: label,
        evidenceField: "affectedCapabilities",
      }),
    );
  }

  return facts;
}
