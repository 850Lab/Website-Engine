import {
  getGraphNodeById,
  listGraphEdges,
  listGraphNodes,
  upsertGraphNode,
} from "../graph-store/index.js";
import { listFacts } from "../facts/index.js";
import {
  createSituation,
  listSituations,
  updateSituation,
} from "../situations/index.js";

export const SIGNAL_TYPE_TO_CATEGORY = {
  expansion: "Expansion",
  hiring_spike: "Hiring",
  permit: "Permit Activity",
  funding: "Government Funding",
  public_budget: "Government Funding",
  government_agenda: "Government Funding",
  turnaround: "Turnaround",
  shutdown: "Turnaround",
  weather_event: "Emergency",
  rfp: "Procurement",
  bid_award: "Procurement",
  contract_award: "Procurement",
  acquisition: "Acquisition",
  company_news: "Capital Project",
  crm_event: "Unknown",
  social_signal: "Unknown",
  regulatory_change: "Infrastructure",
  unknown: "Unknown",
};

const PRIORITY_BY_URGENCY = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(values.map(String).filter(Boolean))];
}

function buildAdjacency(edges) {
  const adjacency = new Map();
  const add = (a, b) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a).add(b);
  };
  for (const edge of edges) {
    add(edge.fromNodeId, edge.toNodeId);
    add(edge.toNodeId, edge.fromNodeId);
  }
  return adjacency;
}

function connectedComponents(nodes, adjacency) {
  const visited = new Set();
  const nodeIds = nodes.map((node) => node.id);
  const components = [];

  for (const startId of nodeIds) {
    if (visited.has(startId)) continue;
    const stack = [startId];
    const componentNodeIds = new Set();
    visited.add(startId);

    while (stack.length) {
      const current = stack.pop();
      componentNodeIds.add(current);
      for (const neighbor of adjacency.get(current) || []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        stack.push(neighbor);
      }
    }

    components.push(componentNodeIds);
  }

  return components;
}

function extractCluster(nodes, edges, nodeIdSet) {
  const clusterNodes = nodes.filter((node) => nodeIdSet.has(node.id));
  const clusterEdges = edges.filter(
    (edge) => nodeIdSet.has(edge.fromNodeId) && nodeIdSet.has(edge.toNodeId),
  );

  const entityIds = [];
  const factIds = [];
  const signalIds = [];
  const marketIds = [];
  const capabilityIds = [];
  const graphNodeIds = clusterNodes.map((node) => node.id);
  let primaryEntityLabel = null;
  let primaryLocation = null;
  let observedAt = null;
  let urgency = null;
  const signalTypes = new Set();
  const confidences = [];

  for (const node of clusterNodes) {
    if (node.type === "Entity") {
      const candidateId = node.entityId || node.id.replace(/^entity:/, "");
      if (candidateId.startsWith("ent_")) {
        entityIds.push(candidateId);
        if (!primaryEntityLabel) primaryEntityLabel = node.label;
      }
    }
    if (node.type === "Fact" && node.factId) {
      factIds.push(node.factId);
    }
    if (node.type === "Signal" && node.signalId) {
      signalIds.push(node.signalId);
    }
    if (node.type === "Market") {
      marketIds.push(String(node.label || node.value || node.id.replace(/^market:/, "")));
    }
    if (node.type === "Capability") {
      capabilityIds.push(String(node.label || node.value || node.id.replace(/^capability:/, "")));
    }
    if (node.type === "Location") {
      primaryLocation = String(node.label || node.value || primaryLocation);
    }
    if (typeof node.confidence === "number") {
      confidences.push(node.confidence);
    }
  }

  for (const edge of clusterEdges) {
    for (const signalId of asArray(edge.signalIds)) signalIds.push(signalId);
    for (const factId of asArray(edge.factIds)) factIds.push(factId);
    if (edge.type === "HAS_SIGNAL_TYPE") {
      signalTypes.add(String(edge.label || edge.metadata?.predicate || ""));
    }
    if (edge.type === "OBSERVED_AT" && edge.metadata?.predicate === "observed_at") {
      observedAt = observedAt || String(edge.label || "");
    }
  }

  return {
    entityIds: uniqueStrings(entityIds),
    factIds: uniqueStrings(factIds),
    signalIds: uniqueStrings(signalIds),
    marketIds: uniqueStrings(marketIds),
    capabilityIds: uniqueStrings(capabilityIds),
    relationshipIds: uniqueStrings(clusterEdges.map((edge) => edge.id)),
    graphNodeIds: uniqueStrings(graphNodeIds),
    primaryEntityLabel: primaryEntityLabel || "Unknown entity",
    primaryLocation,
    observedAt,
    urgency,
    signalTypes: [...signalTypes],
    confidences,
    edgeCount: clusterEdges.length,
    nodeCount: clusterNodes.length,
  };
}

function resolveCategory(cluster, factsById) {
  for (const factId of cluster.factIds) {
    const fact = factsById.get(factId);
    if (!fact) continue;
    if (fact.predicate === "has_signal_type") {
      const mapped = SIGNAL_TYPE_TO_CATEGORY[fact.object];
      if (mapped) return mapped;
    }
    if (fact.predicate === "announced" && fact.metadata?.signalType === "expansion") {
      return "Expansion";
    }
  }

  for (const signalType of cluster.signalTypes) {
    const mapped = SIGNAL_TYPE_TO_CATEGORY[signalType];
    if (mapped) return mapped;
  }

  if (cluster.marketIds.length && cluster.capabilityIds.length) {
    return "Capital Project";
  }

  return "Unknown";
}

function computeConfidence(cluster) {
  const avgConfidence = cluster.confidences.length
    ? cluster.confidences.reduce((sum, value) => sum + value, 0) / cluster.confidences.length
    : 0.5;
  const evidenceScore = Math.min(
    1,
    cluster.factIds.length * 0.12 +
      cluster.relationshipIds.length * 0.04 +
      cluster.signalIds.length * 0.08,
  );
  return Number((avgConfidence * 0.7 + evidenceScore * 0.3).toFixed(3));
}

function buildSituationSummary(cluster, confidence) {
  return {
    evidenceCount: cluster.factIds.length + cluster.relationshipIds.length + cluster.signalIds.length,
    factCount: cluster.factIds.length,
    relationshipCount: cluster.relationshipIds.length,
    signalCount: cluster.signalIds.length,
    confidence,
    affectedMarkets: cluster.marketIds,
    affectedCapabilities: cluster.capabilityIds,
    primaryLocation: cluster.primaryLocation,
  };
}

function buildTitle(cluster, category) {
  const locationSuffix = cluster.primaryLocation ? ` in ${cluster.primaryLocation}` : "";
  return `${cluster.primaryEntityLabel} — ${category}${locationSuffix}`;
}

function buildDescription(summary, category) {
  return (
    `${summary.evidenceCount} evidence items across ${summary.factCount} facts, ` +
    `${summary.relationshipCount} relationships, and ${summary.signalCount} signals ` +
    `for ${category}.`
  );
}

function clusterKey(cluster) {
  return [
    cluster.entityIds.sort().join("|"),
    cluster.signalIds.sort().join("|"),
    cluster.primaryLocation || "",
  ].join("::");
}

function resolveInitialStatus(existingSituation, cluster) {
  if (!existingSituation) return "observed";
  const previousEvidence = existingSituation.summary?.evidenceCount || 0;
  const nextEvidence = cluster.factIds.length + cluster.relationshipIds.length + cluster.signalIds.length;
  if (nextEvidence > previousEvidence && existingSituation.status === "observed") {
    return "growing";
  }
  return existingSituation.status;
}

export async function buildSituationsFromGraph(graph = null) {
  const nodes = graph?.nodes || (await listGraphNodes());
  const edges = graph?.edges || (await listGraphEdges());
  const facts = await listFacts();
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));

  if (!nodes.length) {
    return { clusters: [], situations: [] };
  }

  const adjacency = buildAdjacency(edges);
  const components = connectedComponents(nodes, adjacency);
  const clusters = [];
  const situations = [];

  for (const nodeIdSet of components) {
    const cluster = extractCluster(nodes, edges, nodeIdSet);
    if (!cluster.factIds.length && !cluster.signalIds.length) continue;

    for (const factId of cluster.factIds) {
      const fact = factsById.get(factId);
      if (!fact) continue;
      if (fact.predicate === "affects_market" && fact.object) {
        cluster.marketIds.push(String(fact.object));
      }
      if (fact.predicate === "affects_capability" && fact.object) {
        cluster.capabilityIds.push(String(fact.object));
      }
    }
    cluster.marketIds = uniqueStrings(cluster.marketIds);
    cluster.capabilityIds = uniqueStrings(cluster.capabilityIds);

    const category = resolveCategory(cluster, factsById);
    const confidence = computeConfidence(cluster);
    const summary = buildSituationSummary(cluster, confidence);
    const key = clusterKey(cluster);

    clusters.push({ key, ...cluster, category, confidence, summary });

    const draft = {
      title: buildTitle(cluster, category),
      description: buildDescription(summary, category),
      category,
      situationType: category,
      confidence,
      evidenceScore: summary.evidenceCount / 10,
      priority: PRIORITY_BY_URGENCY[cluster.urgency] || "medium",
      entityIds: cluster.entityIds,
      factIds: cluster.factIds,
      relationshipIds: cluster.relationshipIds,
      signalIds: cluster.signalIds,
      marketIds: cluster.marketIds,
      capabilityIds: cluster.capabilityIds,
      graphNodeIds: cluster.graphNodeIds,
      location: parseLocation(cluster.primaryLocation),
      timeline: {
        observedAt: cluster.observedAt,
        start: cluster.observedAt,
        end: null,
        label: category,
      },
      summary,
      tags: uniqueStrings([category, ...(cluster.marketIds || [])]),
      metadata: {
        builder: "situation_builder_v0",
        clusterKey: key,
      },
    };

    situations.push({ key, draft, cluster });
  }

  return { clusters, situations };
}

function parseLocation(primaryLocation) {
  if (!primaryLocation) {
    return { city: null, county: null, state: null, country: "US", address: null, facilityName: null };
  }
  const parts = String(primaryLocation).split(",").map((part) => part.trim());
  return {
    city: parts[0] || null,
    county: null,
    state: parts[1] || null,
    country: "US",
    address: primaryLocation,
    facilityName: null,
  };
}

async function linkSituationToGraphNodes(situationId, graphNodeIds) {
  for (const nodeId of graphNodeIds) {
    const node = await getGraphNodeById(nodeId);
    if (!node) continue;
    const situationIds = uniqueStrings([...(node.metadata?.situationIds || []), situationId]);
    await upsertGraphNode({
      ...node,
      metadata: {
        ...(node.metadata || {}),
        situationIds,
      },
    });
  }
}

export async function processGraphIntoSituations(options = {}) {
  const built = await buildSituationsFromGraph();
  const existing = await listSituations();
  const existingByKey = new Map(
    existing.map((situation) => [situation.metadata?.clusterKey, situation]).filter(([key]) => key),
  );

  const created = [];
  const updated = [];

  for (const item of built.situations) {
    const existingSituation = existingByKey.get(item.key);
    if (existingSituation && !options.force) {
      const nextStatus = resolveInitialStatus(existingSituation, item.cluster);
      const situation = await updateSituation(
        existingSituation.id,
        {
          ...item.draft,
          status: nextStatus,
        },
        { force: nextStatus !== existingSituation.status },
      );
      await linkSituationToGraphNodes(situation.id, item.draft.graphNodeIds);
      updated.push(situation);
      continue;
    }

    const situation = await createSituation({
      ...item.draft,
      status: "observed",
    });
    await linkSituationToGraphNodes(situation.id, item.draft.graphNodeIds);
    created.push(situation);
  }

  return {
    clusters: built.clusters,
    created,
    updated,
    situations: [...created, ...updated],
  };
}

export { SIGNAL_TYPE_TO_CATEGORY as SITUATION_TYPE_MAP };
