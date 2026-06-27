import { listFacts } from "../facts/index.js";
import {
  recordRelationshipEvent,
  upsertGraphEdge,
  upsertGraphNode,
} from "../graph-store/index.js";
import {
  graphNodeIdForEntity,
  normalizeEntityLabel,
  resolveEntity,
} from "../entity-resolution/index.js";

export const RELATIONSHIP_TYPES = [
  "SUPPORTED_BY_SIGNAL",
  "MENTIONS",
  "LOCATED_IN",
  "HAS_SIGNAL_TYPE",
  "HAS_SOURCE",
  "HAS_URL",
  "AFFECTS_MARKET",
  "AFFECTS_CAPABILITY",
  "OBSERVED_AT",
  "ANNOUNCED",
  "HAS_VALUE",
  "HAS_UNIT",
];

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(values.map(String).filter(Boolean))];
}

function nodeId(type, key) {
  return `${type.toLowerCase()}:${key}`;
}

function edgeId(type, fromNodeId, toNodeId) {
  return `${type}:${fromNodeId}->${toNodeId}`;
}

function predicateToRelationshipType(predicate) {
  const map = {
    announced: "ANNOUNCED",
    located_in: "LOCATED_IN",
    mentions_entity: "MENTIONS",
    has_signal_type: "HAS_SIGNAL_TYPE",
    has_source: "HAS_SOURCE",
    has_url: "HAS_URL",
    affects_market: "AFFECTS_MARKET",
    affects_capability: "AFFECTS_CAPABILITY",
    has_urgency: "MENTIONS",
    observed_at: "OBSERVED_AT",
  };
  return map[predicate] || "MENTIONS";
}

function targetNodeType(predicate) {
  const map = {
    located_in: "Location",
    has_signal_type: "Fact",
    has_source: "Source",
    has_url: "Source",
    affects_market: "Market",
    affects_capability: "Capability",
    observed_at: "Fact",
    has_urgency: "Fact",
    mentions_entity: "Entity",
    announced: "Entity",
  };
  return map[predicate] || "Entity";
}

function buildEdgeDraft({
  type,
  fromNodeId,
  toNodeId,
  label,
  fact,
  signalIds,
  evidence,
  metadata = {},
}) {
  return {
    id: edgeId(type, fromNodeId, toNodeId),
    type,
    fromNodeId,
    toNodeId,
    label: label || type,
    factIds: [fact.id],
    signalIds: uniqueStrings(signalIds),
    confidence: fact.confidence ?? 0.7,
    evidence: evidence || asArray(fact.evidence),
    metadata: {
      predicate: fact.predicate,
      extractor: fact.extractor,
      ...metadata,
    },
  };
}

export async function buildRelationshipsFromFact(fact) {
  if (!fact?.id || !asArray(fact.signalIds).length) {
    throw new Error("Fact must include id and signalIds");
  }

  const nodes = [];
  const edges = [];
  const entities = [];
  const signalIds = asArray(fact.signalIds);
  const factNodeId = nodeId("Fact", fact.id);

  nodes.push({
    id: factNodeId,
    type: "Fact",
    label: `${fact.predicate}: ${fact.object ?? fact.value ?? ""}`.trim(),
    factId: fact.id,
    predicate: fact.predicate,
    sourceFactIds: [fact.id],
    sourceSignalIds: signalIds,
    confidence: fact.confidence ?? 0.7,
  });

  if (fact.subjectLabel) {
    const entity = await resolveEntity({
      label: fact.subjectLabel,
      sourceFactIds: [fact.id],
      sourceSignalIds: signalIds,
      confidence: fact.confidence ?? 0.7,
    });
    entities.push(entity);

    const entityNodeId = graphNodeIdForEntity(entity.id);
    nodes.push({
      id: entityNodeId,
      type: "Entity",
      label: entity.label,
      entityId: entity.id,
      canonicalLabel: entity.canonicalLabel,
      aliases: entity.aliases,
      sourceFactIds: [fact.id],
      sourceSignalIds: signalIds,
      confidence: entity.confidence,
    });

    edges.push(
      buildEdgeDraft({
        type: "MENTIONS",
        fromNodeId: entityNodeId,
        toNodeId: factNodeId,
        label: "subject_of",
        fact,
        signalIds,
        metadata: { role: "subject" },
      }),
    );
  }

  for (const signalId of signalIds) {
    const signalNodeId = nodeId("Signal", signalId);
    nodes.push({
      id: signalNodeId,
      type: "Signal",
      label: signalId,
      signalId,
      sourceFactIds: [fact.id],
      sourceSignalIds: [signalId],
      confidence: fact.confidence ?? 0.7,
    });

    edges.push(
      buildEdgeDraft({
        type: "SUPPORTED_BY_SIGNAL",
        fromNodeId: factNodeId,
        toNodeId: signalNodeId,
        label: "supported_by_signal",
        fact,
        signalIds: [signalId],
      }),
    );
  }

  const relationshipType = predicateToRelationshipType(fact.predicate);
  const targetType = targetNodeType(fact.predicate);
  const targetKey =
    fact.objectEntityId ||
    (fact.object != null ? String(fact.object) : fact.predicate);
  const targetNodeId = nodeId(targetType, targetKey);

  nodes.push({
    id: targetNodeId,
    type: targetType,
    label: String(fact.object ?? fact.value ?? targetKey),
    value: fact.object ?? fact.value ?? null,
    sourceFactIds: [fact.id],
    sourceSignalIds: signalIds,
    confidence: fact.confidence ?? 0.7,
  });

  edges.push(
    buildEdgeDraft({
      type: relationshipType,
      fromNodeId: factNodeId,
      toNodeId: targetNodeId,
      label: fact.predicate,
      fact,
      signalIds,
    }),
  );

  if (fact.objectEntityId && fact.predicate === "mentions_entity") {
    const mentioned = await resolveEntity({
      label: String(fact.object),
      sourceFactIds: [fact.id],
      sourceSignalIds: signalIds,
      confidence: fact.confidence ?? 0.7,
    });
    entities.push(mentioned);
  }

  if (fact.value != null) {
    const valueNodeId = nodeId("Fact", `${fact.id}:value`);
    nodes.push({
      id: valueNodeId,
      type: "Fact",
      label: String(fact.value),
      value: fact.value,
      sourceFactIds: [fact.id],
      sourceSignalIds: signalIds,
      confidence: fact.confidence ?? 0.7,
      metadata: { role: "scalar_value" },
    });
    edges.push(
      buildEdgeDraft({
        type: "HAS_VALUE",
        fromNodeId: factNodeId,
        toNodeId: valueNodeId,
        label: "has_value",
        fact,
        signalIds,
      }),
    );
  }

  if (fact.unit) {
    const unitNodeId = nodeId("Fact", `${fact.id}:unit`);
    nodes.push({
      id: unitNodeId,
      type: "Fact",
      label: String(fact.unit),
      value: fact.unit,
      sourceFactIds: [fact.id],
      sourceSignalIds: signalIds,
      confidence: fact.confidence ?? 0.7,
      metadata: { role: "unit" },
    });
    edges.push(
      buildEdgeDraft({
        type: "HAS_UNIT",
        fromNodeId: factNodeId,
        toNodeId: unitNodeId,
        label: "has_unit",
        fact,
        signalIds,
      }),
    );
  }

  return { nodes, edges, entities };
}

export async function processFactsIntoRelationships(facts = []) {
  const processedFacts = [];
  const processedNodes = [];
  const processedEdges = [];
  const processedEntities = [];

  for (const fact of facts) {
    const built = await buildRelationshipsFromFact(fact);
    processedFacts.push(fact.id);

    for (const node of built.nodes) {
      await upsertGraphNode(node);
      processedNodes.push(node.id);
      await recordRelationshipEvent({
        type: "node_upserted",
        factIds: [fact.id],
        nodeId: node.id,
        signalIds: asArray(fact.signalIds),
        metadata: { nodeType: node.type },
      });
    }

    for (const edge of built.edges) {
      await upsertGraphEdge(edge);
      processedEdges.push(edge.id);
      await recordRelationshipEvent({
        type: "edge_upserted",
        factIds: edge.factIds,
        edgeId: edge.id,
        signalIds: edge.signalIds,
        metadata: { relationshipType: edge.type },
      });
    }

    for (const entity of built.entities) {
      processedEntities.push(entity);
      await recordRelationshipEvent({
        type: "entity_resolved",
        factIds: [fact.id],
        nodeId: graphNodeIdForEntity(entity.id),
        signalIds: asArray(fact.signalIds),
        metadata: {
          canonicalLabel: entity.canonicalLabel,
          aliasCount: entity.aliases.length,
        },
      });
    }
  }

  return {
    factIds: processedFacts,
    nodeIds: uniqueStrings(processedNodes),
    edgeIds: uniqueStrings(processedEdges),
    entities: processedEntities,
  };
}

export async function processAllFactsIntoGraph() {
  const facts = await listFacts();
  return processFactsIntoRelationships(facts);
}

export { normalizeEntityLabel, predicateToRelationshipType, targetNodeType };
