import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "../storage.js";
import { nowIso } from "../stage1/shared.js";
import { randomUUID } from "node:crypto";
import { ensureDistributedSchema, getDbPool, hasPostgres } from "./db.js";

export const DISCOVERY_CAMPAIGNS_FILE = join(DATA_DIR, "discovery-campaigns.json");

async function readCampaigns() {
  if (hasPostgres()) {
    await ensureDistributedSchema();
    const db = getDbPool();
    const result = await db.query(
      "SELECT payload FROM oe_campaigns ORDER BY updated_at DESC",
    );
    return result.rows.map((row) => row.payload).filter(Boolean);
  }
  try {
    const parsed = JSON.parse(await readFile(DISCOVERY_CAMPAIGNS_FILE, "utf8"));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.campaigns)) return parsed.campaigns;
    return [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeCampaigns(campaigns) {
  await writeJsonFileSafe(DISCOVERY_CAMPAIGNS_FILE, { version: 1, campaigns });
}

export function newCampaignId() {
  return `camp_${randomUUID().slice(0, 8)}`;
}

export async function listDiscoveryCampaigns() {
  const campaigns = await readCampaigns();
  return campaigns.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

export async function getDiscoveryCampaign(campaignId) {
  if (hasPostgres()) {
    await ensureDistributedSchema();
    const db = getDbPool();
    const result = await db.query(
      "SELECT payload FROM oe_campaigns WHERE id = $1 LIMIT 1",
      [campaignId],
    );
    return result.rows[0]?.payload ?? null;
  }
  const campaigns = await readCampaigns();
  return campaigns.find((campaign) => campaign.id === campaignId) ?? null;
}

export async function saveDiscoveryCampaign(campaign) {
  if (hasPostgres()) {
    await ensureDistributedSchema();
    const db = getDbPool();
    const next = { ...campaign, updatedAt: nowIso() };
    await db.query(
      `
        INSERT INTO oe_campaigns (id, payload, created_at, updated_at)
        VALUES ($1, $2::jsonb, now(), now())
        ON CONFLICT (id)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
      `,
      [next.id, JSON.stringify(next)],
    );
    return next;
  }
  const campaigns = await readCampaigns();
  const index = campaigns.findIndex((entry) => entry.id === campaign.id);
  const next = { ...campaign, updatedAt: nowIso() };
  if (index === -1) {
    campaigns.push(next);
  } else {
    campaigns[index] = { ...campaigns[index], ...next };
  }
  await writeCampaigns(campaigns);
  return index === -1 ? next : campaigns[index];
}

export async function findResumableCampaign(regionId = "southeast-texas") {
  const campaigns = await listDiscoveryCampaigns();
  return (
    campaigns.find(
      (campaign) =>
        campaign.regionId === regionId &&
        campaign.status === "failed" &&
        (campaign.completedPairs ?? 0) < (campaign.totalPairs ?? 0),
    ) ?? null
  );
}

export async function getBestResumableCampaign(regionId = "southeast-texas") {
  const campaigns = await listDiscoveryCampaigns();
  const candidates = campaigns.filter(
    (c) =>
      c.regionId === regionId &&
      ["failed", "running"].includes(c.status) &&
      (c.completedPairs ?? 0) < (c.totalPairs ?? 0),
  );
  if (!candidates.length) return null;
  return candidates.sort(
    (a, b) =>
      (b.completedPairs ?? 0) - (a.completedPairs ?? 0) ||
      (b.totals?.businessesFound ?? 0) - (a.totals?.businessesFound ?? 0),
  )[0];
}
