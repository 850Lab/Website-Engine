import { Pool } from "pg";

let pool = null;
let initialized = false;

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

export function hasPostgres() {
  return Boolean(connectionString().trim());
}

export function getDbPool() {
  if (!hasPostgres()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString(),
      ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
      max: Math.max(1, Number(process.env.PG_POOL_MAX) || 10),
    });
  }
  return pool;
}

export async function ensureDistributedSchema() {
  if (initialized || !hasPostgres()) return false;
  const db = getDbPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS oe_campaigns (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS oe_jobs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      city TEXT NOT NULL,
      industry TEXT NOT NULL,
      adapter_id TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      retry_at_ms BIGINT NOT NULL DEFAULT 0,
      idempotency_key TEXT NOT NULL UNIQUE,
      claimed_by TEXT NOT NULL DEFAULT '',
      claimed_at TIMESTAMPTZ NULL,
      started_at TIMESTAMPTZ NULL,
      finished_at TIMESTAMPTZ NULL,
      last_heartbeat_at TIMESTAMPTZ NULL,
      lease_expires_at_ms BIGINT NOT NULL DEFAULT 0,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_oe_jobs_claim
      ON oe_jobs (status, retry_at_ms, lease_expires_at_ms);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_oe_jobs_campaign
      ON oe_jobs (campaign_id, created_at);
  `);
  initialized = true;
  return true;
}
