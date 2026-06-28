import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import {
  ensureRuntimeDirectories,
  getRuntimeGraphStorePath,
  toRepoRelativePath,
  readJsonWithRetry,
  writeJsonAtomicWithRetry,
  safeFileExists,
  ensureDirectory,
} from "../runtime/index.js";

const GRAPH_VERSION = "2.5.0";

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return structuredClone(value);
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(values.map(String).filter(Boolean))];
}

function createEmptyGraph(description = "Opportunity OS persistent runtime graph") {
  const createdAt = nowIso();
  return {
    metadata: {
      version: GRAPH_VERSION,
      createdAt,
      updatedAt: createdAt,
      description,
      storageMode: "runtime_only",
    },
    nodes: [],
    edges: [],
    aliases: [],
    relationshipEvents: [],
  };
}

async function storeFileExists(path) {
  return safeFileExists(path);
}

function normalizeGraph(graph) {
  if (!isObject(graph.metadata)) graph.metadata = {};
  graph.nodes = asArray(graph.nodes);
  graph.edges = asArray(graph.edges);
  graph.aliases = asArray(graph.aliases);
  graph.relationshipEvents = asArray(graph.relationshipEvents);
  return graph;
}

export async function readGraphStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeGraphStorePath();
  if (!(await storeFileExists(path))) {
    return createEmptyGraph();
  }
  const graph = await readJsonWithRetry(path, createEmptyGraph());
  return normalizeGraph(graph);
}

export async function writeGraphStore(graph) {
  await ensureRuntimeDirectories();
  const path = getRuntimeGraphStorePath();
  await ensureDirectory(dirname(path));

  const normalized = normalizeGraph(clone(graph));
  normalized.metadata = {
    ...normalized.metadata,
    version: normalized.metadata.version || GRAPH_VERSION,
    updatedAt: nowIso(),
    storageMode: "runtime_only",
    runtimeStorePath: toRepoRelativePath(path),
  };

  await writeJsonAtomicWithRetry(path, normalized);
  return normalized;
}

export async function initializeGraphStore() {
  await ensureRuntimeDirectories();
  const path = getRuntimeGraphStorePath();
  if (!(await storeFileExists(path))) {
    const graph = createEmptyGraph();
    await writeGraphStore(graph);
  }
  return path;
}

export async function listGraphNodes() {
  const graph = await readGraphStore();
  return clone(graph.nodes);
}

export async function listGraphEdges() {
  const graph = await readGraphStore();
  return clone(graph.edges);
}

export async function getGraphNodeById(id) {
  const graph = await readGraphStore();
  const node = graph.nodes.find((row) => row.id === id);
  return node ? clone(node) : null;
}

export async function getGraphEdgesByNodeId(id) {
  const graph = await readGraphStore();
  return clone(
    graph.edges.filter((edge) => edge.fromNodeId === id || edge.toNodeId === id),
  );
}

export async function upsertGraphNode(node) {
  if (!node?.id || !node?.type) {
    throw new Error("Graph node requires id and type");
  }

  const graph = await readGraphStore();
  const index = graph.nodes.findIndex((row) => row.id === node.id);
  const at = nowIso();

  if (index === -1) {
    graph.nodes.push({
      ...node,
      sourceFactIds: uniqueStrings(node.sourceFactIds),
      sourceSignalIds: uniqueStrings(node.sourceSignalIds),
      createdAt: node.createdAt || at,
      updatedAt: at,
      metadata: isObject(node.metadata) ? node.metadata : {},
    });
  } else {
    const current = graph.nodes[index];
    graph.nodes[index] = {
      ...current,
      ...node,
      sourceFactIds: uniqueStrings([...asArray(current.sourceFactIds), ...asArray(node.sourceFactIds)]),
      sourceSignalIds: uniqueStrings([
        ...asArray(current.sourceSignalIds),
        ...asArray(node.sourceSignalIds),
      ]),
      updatedAt: at,
      metadata: { ...(current.metadata || {}), ...(node.metadata || {}) },
    };
  }

  await writeGraphStore(graph);
  return getGraphNodeById(node.id);
}

export async function upsertGraphEdge(edge) {
  if (!edge?.id || !edge?.type || !edge?.fromNodeId || !edge?.toNodeId) {
    throw new Error("Graph edge requires id, type, fromNodeId, and toNodeId");
  }
  if (!asArray(edge.factIds).length) {
    throw new Error("Graph edge must reference at least one factId");
  }

  const graph = await readGraphStore();
  const index = graph.edges.findIndex((row) => row.id === edge.id);
  const at = nowIso();

  if (index === -1) {
    graph.edges.push({
      ...edge,
      factIds: uniqueStrings(edge.factIds),
      signalIds: uniqueStrings(edge.signalIds),
      evidence: asArray(edge.evidence),
      createdAt: edge.createdAt || at,
      updatedAt: at,
      metadata: isObject(edge.metadata) ? edge.metadata : {},
    });
  } else {
    const current = graph.edges[index];
    graph.edges[index] = {
      ...current,
      ...edge,
      factIds: uniqueStrings([...asArray(current.factIds), ...asArray(edge.factIds)]),
      signalIds: uniqueStrings([...asArray(current.signalIds), ...asArray(edge.signalIds)]),
      evidence: [...asArray(current.evidence), ...asArray(edge.evidence)],
      updatedAt: at,
      metadata: { ...(current.metadata || {}), ...(edge.metadata || {}) },
    };
  }

  await writeGraphStore(graph);
  return clone(graph.edges.find((row) => row.id === edge.id));
}

export async function recordRelationshipEvent(event) {
  if (!event?.type) {
    throw new Error("Relationship event requires type");
  }

  const graph = await readGraphStore();
  const record = {
    id: event.id || `rel_evt_${randomUUID()}`,
    type: event.type,
    factIds: uniqueStrings(event.factIds),
    signalIds: uniqueStrings(event.signalIds),
    edgeId: event.edgeId ?? null,
    nodeId: event.nodeId ?? null,
    at: event.at || nowIso(),
    metadata: isObject(event.metadata) ? event.metadata : {},
  };

  graph.relationshipEvents.push(record);
  await writeGraphStore(graph);
  return clone(record);
}

export async function upsertGraphAlias(aliasRecord) {
  if (!aliasRecord?.entityId || !aliasRecord?.alias) {
    throw new Error("Graph alias requires entityId and alias");
  }

  const graph = await readGraphStore();
  const normalizedAlias = String(aliasRecord.normalizedAlias || aliasRecord.alias).trim();
  const existing = graph.aliases.find(
    (row) =>
      row.entityId === aliasRecord.entityId &&
      row.normalizedAlias === normalizedAlias,
  );

  if (!existing) {
    graph.aliases.push({
      entityId: aliasRecord.entityId,
      alias: aliasRecord.alias,
      canonicalLabel: aliasRecord.canonicalLabel || aliasRecord.alias,
      normalizedAlias,
      createdAt: aliasRecord.createdAt || nowIso(),
    });
    await writeGraphStore(graph);
  }

  return clone(
    graph.aliases.find(
      (row) => row.entityId === aliasRecord.entityId && row.normalizedAlias === normalizedAlias,
    ),
  );
}

export async function listGraphAliases(entityId = null) {
  const graph = await readGraphStore();
  const aliases = clone(graph.aliases);
  if (!entityId) return aliases;
  return aliases.filter((row) => row.entityId === entityId);
}

export async function getPersistentGraphSummary() {
  const graph = await readGraphStore();
  const byNodeType = {};
  const byEdgeType = {};

  for (const node of graph.nodes) {
    byNodeType[node.type] = (byNodeType[node.type] || 0) + 1;
  }
  for (const edge of graph.edges) {
    byEdgeType[edge.type] = (byEdgeType[edge.type] || 0) + 1;
  }

  return {
    generatedAt: nowIso(),
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    aliasCount: graph.aliases.length,
    relationshipEventCount: graph.relationshipEvents.length,
    byNodeType,
    byEdgeType,
    metadata: clone(graph.metadata),
  };
}

export function getGraphStorePath() {
  return getRuntimeGraphStorePath();
}

export async function clearGraphStoreForTests() {
  await writeGraphStore(createEmptyGraph("Test reset graph store"));
}
