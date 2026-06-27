import { entityIdFromLabel } from "../facts/entity-id.js";

export const GRAPH_NODE_TYPES = [
  "Entity",
  "Signal",
  "Fact",
  "Location",
  "Capability",
  "Market",
  "Source",
];

export const GRAPH_EDGE_TYPES = [
  "SUPPORTED_BY_SIGNAL",
  "MENTIONS",
  "LOCATED_IN",
  "HAS_SIGNAL_TYPE",
  "AFFECTS_CAPABILITY",
  "AFFECTS_MARKET",
  "OBSERVED_AT",
  "HAS_SOURCE",
  "HAS_URL",
];

let lastProjection = null;

function nodeId(type, key) {
  return `${type.toLowerCase()}:${key}`;
}

function edgeId(type, from, to) {
  return `${type}:${from}->${to}`;
}

function upsertNode(nodes, node) {
  if (!nodes.has(node.id)) nodes.set(node.id, node);
}

function upsertEdge(edges, edge) {
  if (!edges.has(edge.id)) edges.set(edge.id, edge);
}

function predicateToEdgeType(predicate) {
  const map = {
    announced: "MENTIONS",
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

export function mapFactToGraphRefs(fact) {
  const refs = [`node:fact:${fact.id}`];

  if (fact.subjectEntityId) refs.push(`node:entity:${fact.subjectEntityId}`);
  for (const signalId of fact.signalIds || []) {
    refs.push(`node:signal:${signalId}`);
    refs.push(`edge:SUPPORTED_BY_SIGNAL:fact:${fact.id}->signal:${signalId}`);
  }

  const edgeType = predicateToEdgeType(fact.predicate);
  const targetType = targetNodeType(fact.predicate);
  const targetKey =
    fact.objectEntityId ||
    (fact.object != null ? String(fact.object) : fact.predicate);
  refs.push(`edge:${edgeType}:fact:${fact.id}->${targetType.toLowerCase()}:${targetKey}`);

  return refs;
}

export function buildGraphProjectionFromFacts(facts = []) {
  const nodes = new Map();
  const edges = new Map();

  for (const fact of facts) {
    const factNodeId = nodeId("Fact", fact.id);
    upsertNode(nodes, {
      id: factNodeId,
      type: "Fact",
      label: `${fact.predicate}: ${fact.object ?? fact.value ?? ""}`.trim(),
      factId: fact.id,
      predicate: fact.predicate,
      confidence: fact.confidence,
    });

    if (fact.subjectLabel) {
      const entityId = fact.subjectEntityId || entityIdFromLabel(fact.subjectLabel);
      const entityNodeId = nodeId("Entity", entityId);
      upsertNode(nodes, {
        id: entityNodeId,
        type: "Entity",
        label: fact.subjectLabel,
        entityId,
      });
      upsertEdge(edges, {
        id: edgeId("SUBJECT_OF", entityNodeId, factNodeId),
        type: "MENTIONS",
        from: entityNodeId,
        to: factNodeId,
        predicate: "subject",
      });
    }

    for (const signalId of fact.signalIds || []) {
      const signalNodeId = nodeId("Signal", signalId);
      upsertNode(nodes, {
        id: signalNodeId,
        type: "Signal",
        label: signalId,
        signalId,
      });
      upsertEdge(edges, {
        id: edgeId("SUPPORTED_BY_SIGNAL", factNodeId, signalNodeId),
        type: "SUPPORTED_BY_SIGNAL",
        from: factNodeId,
        to: signalNodeId,
      });
    }

    const edgeType = predicateToEdgeType(fact.predicate);
    const targetType = targetNodeType(fact.predicate);
    const targetKey =
      fact.objectEntityId ||
      (fact.object != null ? String(fact.object) : fact.predicate);
    const targetNodeId = nodeId(targetType, targetKey);

    upsertNode(nodes, {
      id: targetNodeId,
      type: targetType,
      label: String(fact.object ?? fact.value ?? targetKey),
      value: fact.object ?? fact.value ?? null,
    });

    upsertEdge(edges, {
      id: edgeId(edgeType, factNodeId, targetNodeId),
      type: edgeType,
      from: factNodeId,
      to: targetNodeId,
      predicate: fact.predicate,
      confidence: fact.confidence,
    });
  }

  const projection = {
    generatedAt: new Date().toISOString(),
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  };

  lastProjection = projection;
  return projection;
}

export function getGraphSummary(projection = lastProjection) {
  if (!projection) {
    return {
      nodeCount: 0,
      edgeCount: 0,
      byNodeType: {},
      byEdgeType: {},
    };
  }

  const byNodeType = {};
  const byEdgeType = {};

  for (const node of projection.nodes) {
    byNodeType[node.type] = (byNodeType[node.type] || 0) + 1;
  }
  for (const edge of projection.edges) {
    byEdgeType[edge.type] = (byEdgeType[edge.type] || 0) + 1;
  }

  return {
    nodeCount: projection.nodes.length,
    edgeCount: projection.edges.length,
    byNodeType,
    byEdgeType,
    generatedAt: projection.generatedAt,
  };
}

export function getLastGraphProjection() {
  return lastProjection;
}
