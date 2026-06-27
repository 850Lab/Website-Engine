import { createHash } from "node:crypto";
import {
  getGraphNodeById,
  listGraphAliases,
  upsertGraphAlias,
  upsertGraphNode,
} from "../graph-store/index.js";

const LEGAL_SUFFIXES = /\b(incorporated|corporation|company|limited|llc|inc|co|ltd|corp)\.?$/gi;
const PUNCTUATION = /[^\w\s]/g;

function nowIso() {
  return new Date().toISOString();
}

export function normalizeEntityLabel(label) {
  let normalized = String(label || "").trim().toLowerCase();
  normalized = normalized.replace(PUNCTUATION, " ");
  normalized = normalized.replace(/\s+/g, " ").trim();

  let previous;
  do {
    previous = normalized;
    normalized = normalized.replace(LEGAL_SUFFIXES, "").replace(/\s+/g, " ").trim();
  } while (normalized !== previous);

  return normalized || "unknown";
}

export function entityIdFromCanonicalLabel(canonicalLabel) {
  const normalized = normalizeEntityLabel(canonicalLabel);
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  return `ent_${hash}`;
}

export function graphNodeIdForEntity(entityId) {
  return `entity:${entityId}`;
}

function findEntityIdByNormalizedAlias(normalizedAlias, aliases) {
  const match = aliases.find((row) => row.normalizedAlias === normalizedAlias);
  return match?.entityId || null;
}

export async function resolveEntity(input = {}) {
  const label = String(input.label || "").trim();
  if (!label) {
    throw new Error("resolveEntity requires label");
  }

  const canonicalLabel = normalizeEntityLabel(label);
  const aliases = await listGraphAliases();
  const aliasEntityId = findEntityIdByNormalizedAlias(canonicalLabel, aliases);
  const entityId = aliasEntityId || entityIdFromCanonicalLabel(label);
  const nodeId = graphNodeIdForEntity(entityId);
  const existingNode = await getGraphNodeById(nodeId);
  const at = nowIso();

  const entity = {
    id: entityId,
    type: input.type || "Entity",
    label,
    canonicalLabel,
    aliases: uniqueAliases([label, canonicalLabel, ...(existingNode?.aliases || [])]),
    sourceFactIds: uniqueStrings([...(input.sourceFactIds || []), ...(existingNode?.sourceFactIds || [])]),
    sourceSignalIds: uniqueStrings([
      ...(input.sourceSignalIds || []),
      ...(existingNode?.sourceSignalIds || []),
    ]),
    confidence:
      typeof input.confidence === "number"
        ? input.confidence
        : existingNode?.confidence ?? 0.7,
    createdAt: existingNode?.createdAt || at,
    updatedAt: at,
    metadata: {
      ...(existingNode?.metadata || {}),
      ...(input.metadata || {}),
      resolver: "entity_resolution_v0",
    },
  };

  await upsertGraphNode({
    id: nodeId,
    type: "Entity",
    label: entity.label,
    entityId: entity.id,
    canonicalLabel: entity.canonicalLabel,
    aliases: entity.aliases,
    sourceFactIds: entity.sourceFactIds,
    sourceSignalIds: entity.sourceSignalIds,
    confidence: entity.confidence,
    createdAt: entity.createdAt,
    metadata: entity.metadata,
  });

  if (label !== entity.canonicalLabel) {
    await upsertGraphAlias({
      entityId: entity.id,
      alias: label,
      canonicalLabel: entity.canonicalLabel,
      normalizedAlias: canonicalLabel,
    });
  }

  return entity;
}

export async function mergeEntityAliases(entityId, aliases = []) {
  if (!entityId) throw new Error("mergeEntityAliases requires entityId");

  const nodeId = graphNodeIdForEntity(entityId);
  const existingNode = await getGraphNodeById(nodeId);
  if (!existingNode) {
    throw new Error(`Unknown entity: ${entityId}`);
  }

  const mergedAliases = uniqueAliases([...(existingNode.aliases || []), ...aliases]);
  const at = nowIso();

  for (const alias of aliases) {
    const normalizedAlias = normalizeEntityLabel(alias);
    await upsertGraphAlias({
      entityId,
      alias,
      canonicalLabel: existingNode.canonicalLabel || existingNode.label,
      normalizedAlias,
    });
  }

  await upsertGraphNode({
    ...existingNode,
    aliases: mergedAliases,
    updatedAt: at,
  });

  return {
    id: entityId,
    aliases: mergedAliases,
    updatedAt: at,
  };
}

export async function getEntityResolutionSummary() {
  const aliases = await listGraphAliases();
  const byEntity = {};

  for (const alias of aliases) {
    byEntity[alias.entityId] = (byEntity[alias.entityId] || 0) + 1;
  }

  return {
    generatedAt: nowIso(),
    aliasCount: aliases.length,
    entityCount: Object.keys(byEntity).length,
    byEntity,
  };
}

function uniqueAliases(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text) continue;
    const key = normalizeEntityLabel(text);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function uniqueStrings(values) {
  return [...new Set(values.map(String).filter(Boolean))];
}
