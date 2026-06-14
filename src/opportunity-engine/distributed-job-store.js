import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DATA_DIR, writeJsonFileSafe } from "../storage.js";
import { nowIso } from "../stage1/shared.js";
import { pairKey } from "./campaign-progress.js";
import { getDiscoveryCampaign, saveDiscoveryCampaign } from "./campaign-store.js";
import { ensureDistributedSchema, getDbPool, hasPostgres } from "./db.js";

export const DISCOVERY_JOBS_FILE = join(DATA_DIR, "discovery-jobs.json");

function leaseMs(leaseSeconds = 180) {
  return Math.max(30, Number(leaseSeconds) || 180) * 1000;
}

function retryDelayMs(attempts = 1) {
  return Math.min(5 * 60 * 1000, Math.max(30_000, attempts * 30_000));
}

function nowMs() {
  return Date.now();
}

function newJobId() {
  return `job_${randomUUID().slice(0, 10)}`;
}

async function readJobs() {
  if (hasPostgres()) {
    await ensureDistributedSchema();
    const db = getDbPool();
    const result = await db.query(
      "SELECT payload FROM oe_jobs ORDER BY created_at ASC",
    );
    return result.rows.map((row) => row.payload).filter(Boolean);
  }
  try {
    const parsed = JSON.parse(await readFile(DISCOVERY_JOBS_FILE, "utf8"));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.jobs)) return parsed.jobs;
    return [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeJobs(jobs) {
  if (hasPostgres()) {
    // Prefer mutation helpers for Postgres mode.
    return;
  }
  await writeJsonFileSafe(DISCOVERY_JOBS_FILE, { version: 1, jobs });
}

async function upsertPgJob(db, job) {
  await db.query(
    `
      INSERT INTO oe_jobs (
        id, campaign_id, city, industry, adapter_id, status, attempts, max_attempts, retry_at_ms,
        idempotency_key, claimed_by, claimed_at, started_at, finished_at, last_heartbeat_at,
        lease_expires_at_ms, payload, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17::jsonb, now(), now()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        campaign_id = EXCLUDED.campaign_id,
        city = EXCLUDED.city,
        industry = EXCLUDED.industry,
        adapter_id = EXCLUDED.adapter_id,
        status = EXCLUDED.status,
        attempts = EXCLUDED.attempts,
        max_attempts = EXCLUDED.max_attempts,
        retry_at_ms = EXCLUDED.retry_at_ms,
        idempotency_key = EXCLUDED.idempotency_key,
        claimed_by = EXCLUDED.claimed_by,
        claimed_at = EXCLUDED.claimed_at,
        started_at = EXCLUDED.started_at,
        finished_at = EXCLUDED.finished_at,
        last_heartbeat_at = EXCLUDED.last_heartbeat_at,
        lease_expires_at_ms = EXCLUDED.lease_expires_at_ms,
        payload = EXCLUDED.payload,
        updated_at = now()
    `,
    [
      job.id,
      job.campaignId,
      job.city,
      job.industry,
      job.adapterId,
      job.status,
      Number(job.attempts) || 0,
      Number(job.maxAttempts) || 3,
      Number(job.retryAtMs) || 0,
      job.idempotencyKey,
      job.claimedBy || "",
      job.claimedAt || null,
      job.startedAt || null,
      job.finishedAt || null,
      job.lastHeartbeatAt || null,
      Number(job.leaseExpiresAtMs) || 0,
      JSON.stringify(job),
    ],
  );
}

function normalizeExpiredLease(job, now = nowMs()) {
  if (job.status === "running" && Number(job.leaseExpiresAtMs) <= now) {
    return {
      ...job,
      status: "queued",
      claimedBy: "",
      claimedAt: null,
      lastHeartbeatAt: null,
      leaseExpiresAtMs: 0,
      retryAtMs: now + retryDelayMs(job.attempts ?? 1),
      error: "lease_expired",
      updatedAt: nowIso(),
    };
  }
  return job;
}

function isClaimable(job, now = nowMs()) {
  if (job.status !== "queued") return false;
  if (Number(job.retryAtMs) > now) return false;
  if (Number(job.attempts) >= Number(job.maxAttempts || 3)) return false;
  return true;
}

function toIdempotencyKey(campaignId, city, industry, adapterId) {
  return `${campaignId}|${pairKey(city, industry, adapterId)}`;
}

function summarizeJobs(jobs = []) {
  const totals = {
    businessesFound: 0,
    qualifiedCount: 0,
    rejectedCount: 0,
    duplicateCount: 0,
  };
  const counts = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };
  const pairResults = [];
  let firstError = "";
  let currentPair = null;
  for (const job of jobs) {
    counts[job.status] = (counts[job.status] ?? 0) + 1;
    if (job.status === "running" && !currentPair) {
      currentPair = {
        city: job.city,
        industry: job.industry,
        adapterId: job.adapterId,
      };
    }
    if (job.status === "completed") {
      totals.businessesFound += Number(job.businessesFound) || 0;
      totals.qualifiedCount += Number(job.qualifiedCount) || 0;
      totals.rejectedCount += Number(job.rejectedCount) || 0;
      totals.duplicateCount += Number(job.duplicateCount) || 0;
      pairResults.push({
        city: job.city,
        industry: job.industry,
        adapterId: job.adapterId,
        status: "completed",
        discoveryRunId: job.discoveryRunId ?? null,
        businessesFound: Number(job.businessesFound) || 0,
        qualifiedCount: Number(job.qualifiedCount) || 0,
        rejectedCount: Number(job.rejectedCount) || 0,
        duplicateCount: Number(job.duplicateCount) || 0,
        startedAt: job.startedAt ?? null,
        finishedAt: job.finishedAt ?? null,
      });
    } else if (job.status === "failed") {
      pairResults.push({
        city: job.city,
        industry: job.industry,
        adapterId: job.adapterId,
        status: "failed",
        discoveryRunId: job.discoveryRunId ?? null,
        businessesFound: 0,
        qualifiedCount: 0,
        rejectedCount: 0,
        duplicateCount: 0,
        startedAt: job.startedAt ?? null,
        finishedAt: job.finishedAt ?? null,
        error: job.error ?? "job_failed",
      });
      if (!firstError) firstError = job.error ?? "job_failed";
    }
  }

  const totalPairs = jobs.length;
  const completedPairs = counts.completed;
  const remainingPairs = Math.max(0, totalPairs - completedPairs);

  let status = "queued";
  if (totalPairs > 0 && completedPairs === totalPairs) {
    status = "completed";
  } else if (counts.running > 0) {
    status = "running";
  } else if (counts.failed > 0 && counts.queued === 0) {
    status = "failed";
  } else if (counts.queued > 0) {
    status = "queued";
  }

  return {
    status,
    totalPairs,
    completedPairs,
    remainingPairs,
    currentPair,
    error: status === "failed" ? firstError : null,
    counts,
    totals,
    pairResults,
  };
}

export async function listCampaignJobs(campaignId) {
  if (hasPostgres()) {
    await ensureDistributedSchema();
    const db = getDbPool();
    const result = await db.query(
      "SELECT payload FROM oe_jobs WHERE campaign_id = $1 ORDER BY created_at ASC",
      [campaignId],
    );
    return result.rows.map((row) => row.payload).filter(Boolean);
  }
  const jobs = await readJobs();
  return jobs
    .filter((job) => job.campaignId === campaignId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function enqueueDiscoveryJobs(campaign, pairs = []) {
  if (hasPostgres()) {
    await ensureDistributedSchema();
    const db = getDbPool();
    let created = 0;
    for (const pair of pairs) {
      const idempotencyKey = toIdempotencyKey(campaign.id, pair.city, pair.industry, pair.adapterId);
      const job = {
        id: newJobId(),
        campaignId: campaign.id,
        city: pair.city,
        industry: pair.industry,
        adapterId: pair.adapterId,
        state: campaign.state,
        status: "queued",
        attempts: 0,
        maxAttempts: 3,
        retryAtMs: 0,
        idempotencyKey,
        discoveryRunId: null,
        businessesFound: 0,
        qualifiedCount: 0,
        rejectedCount: 0,
        duplicateCount: 0,
        claimedBy: "",
        claimedAt: null,
        startedAt: null,
        finishedAt: null,
        lastHeartbeatAt: null,
        leaseExpiresAtMs: 0,
        error: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      const result = await db.query(
        `
          INSERT INTO oe_jobs (
            id, campaign_id, city, industry, adapter_id, status, attempts, max_attempts, retry_at_ms,
            idempotency_key, claimed_by, claimed_at, started_at, finished_at, last_heartbeat_at,
            lease_expires_at_ms, payload, created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15,
            $16, $17::jsonb, now(), now()
          )
          ON CONFLICT (idempotency_key) DO NOTHING
          RETURNING id
        `,
        [
          job.id,
          job.campaignId,
          job.city,
          job.industry,
          job.adapterId,
          job.status,
          job.attempts,
          job.maxAttempts,
          job.retryAtMs,
          job.idempotencyKey,
          job.claimedBy,
          job.claimedAt,
          job.startedAt,
          job.finishedAt,
          job.lastHeartbeatAt,
          job.leaseExpiresAtMs,
          JSON.stringify(job),
        ],
      );
      if (result.rowCount > 0) created += 1;
    }
    const stats = await getCampaignJobStats(campaign.id);
    await refreshCampaignFromJobs(campaign.id);
    return { created, total: stats.totalPairs };
  }
  const jobs = await readJobs();
  const existing = new Set(
    jobs
      .filter((job) => job.campaignId === campaign.id)
      .map((job) => job.idempotencyKey),
  );

  let created = 0;
  for (const pair of pairs) {
    const idempotencyKey = toIdempotencyKey(campaign.id, pair.city, pair.industry, pair.adapterId);
    if (existing.has(idempotencyKey)) continue;
    jobs.push({
      id: newJobId(),
      campaignId: campaign.id,
      city: pair.city,
      industry: pair.industry,
      adapterId: pair.adapterId,
      state: campaign.state,
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      retryAtMs: 0,
      idempotencyKey,
      discoveryRunId: null,
      businessesFound: 0,
      qualifiedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      claimedBy: "",
      claimedAt: null,
      startedAt: null,
      finishedAt: null,
      lastHeartbeatAt: null,
      leaseExpiresAtMs: 0,
      error: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    existing.add(idempotencyKey);
    created += 1;
  }

  await writeJobs(jobs);
  await refreshCampaignFromJobs(campaign.id);
  return { created, total: existing.size };
}

export async function claimDiscoveryJob({ workerId, campaignId = "", leaseSeconds = 180 } = {}) {
  const worker = String(workerId ?? "").trim();
  if (!worker) throw new Error("workerId is required.");
  if (hasPostgres()) {
    await ensureDistributedSchema();
    const db = getDbPool();
    const now = nowMs();
    await db.query("BEGIN");
    try {
      const result = await db.query(
        `
          SELECT id, payload
          FROM oe_jobs
          WHERE
            ($1 = '' OR campaign_id = $1)
            AND (
              (status = 'queued' AND retry_at_ms <= $2 AND attempts < max_attempts)
              OR (status = 'running' AND lease_expires_at_ms <= $2 AND attempts < max_attempts)
            )
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `,
        [campaignId, now],
      );
      if (!result.rows.length) {
        await db.query("COMMIT");
        return null;
      }
      const base = result.rows[0].payload;
      const next = {
        ...base,
        status: "running",
        attempts: Number(base.attempts || 0) + 1,
        claimedBy: worker,
        claimedAt: nowIso(),
        startedAt: base.startedAt ?? nowIso(),
        lastHeartbeatAt: nowIso(),
        leaseExpiresAtMs: now + leaseMs(leaseSeconds),
        retryAtMs: 0,
        updatedAt: nowIso(),
      };
      await upsertPgJob(db, next);
      await db.query("COMMIT");
      await refreshCampaignFromJobs(next.campaignId);
      return next;
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  }
  const jobs = await readJobs();
  const now = nowMs();
  const normalized = jobs.map((job) => normalizeExpiredLease(job, now));
  const candidate = normalized.find(
    (job) =>
      (!campaignId || job.campaignId === campaignId) &&
      isClaimable(job, now),
  );
  if (!candidate) {
    if (normalized.length !== jobs.length || normalized.some((job, index) => job !== jobs[index])) {
      await writeJobs(normalized);
    }
    return null;
  }
  const idx = normalized.findIndex((job) => job.id === candidate.id);
  const next = {
    ...normalized[idx],
    status: "running",
    attempts: Number(normalized[idx].attempts || 0) + 1,
    claimedBy: worker,
    claimedAt: nowIso(),
    startedAt: normalized[idx].startedAt ?? nowIso(),
    lastHeartbeatAt: nowIso(),
    leaseExpiresAtMs: now + leaseMs(leaseSeconds),
    retryAtMs: 0,
    updatedAt: nowIso(),
  };
  normalized[idx] = next;
  await writeJobs(normalized);
  await refreshCampaignFromJobs(next.campaignId);
  return next;
}

export async function heartbeatDiscoveryJob({ workerId, jobId, leaseSeconds = 180 } = {}) {
  const worker = String(workerId ?? "").trim();
  const id = String(jobId ?? "").trim();
  if (!worker || !id) return false;
  if (hasPostgres()) {
    await ensureDistributedSchema();
    const db = getDbPool();
    const result = await db.query(
      "SELECT payload FROM oe_jobs WHERE id = $1 LIMIT 1",
      [id],
    );
    const job = result.rows[0]?.payload;
    if (!job) return false;
    if (job.status !== "running" || job.claimedBy !== worker) return false;
    const next = {
      ...job,
      lastHeartbeatAt: nowIso(),
      leaseExpiresAtMs: nowMs() + leaseMs(leaseSeconds),
      updatedAt: nowIso(),
    };
    await upsertPgJob(db, next);
    return true;
  }
  const jobs = await readJobs();
  const idx = jobs.findIndex((job) => job.id === id);
  if (idx === -1) return false;
  const job = jobs[idx];
  if (job.status !== "running" || job.claimedBy !== worker) return false;
  jobs[idx] = {
    ...job,
    lastHeartbeatAt: nowIso(),
    leaseExpiresAtMs: nowMs() + leaseMs(leaseSeconds),
    updatedAt: nowIso(),
  };
  await writeJobs(jobs);
  return true;
}

export async function completeDiscoveryJob({ workerId, jobId, run } = {}) {
  const worker = String(workerId ?? "").trim();
  const id = String(jobId ?? "").trim();
  if (hasPostgres()) {
    await ensureDistributedSchema();
    const db = getDbPool();
    const result = await db.query(
      "SELECT payload FROM oe_jobs WHERE id = $1 LIMIT 1",
      [id],
    );
    const job = result.rows[0]?.payload;
    if (!job) throw new Error("Job not found.");
    if (job.status !== "running" || job.claimedBy !== worker) {
      throw new Error("Job is not owned by this worker.");
    }
    const next = {
      ...job,
      status: "completed",
      discoveryRunId: run?.id ?? null,
      businessesFound: Number(run?.businessesFound) || 0,
      qualifiedCount: Number(run?.qualifiedCount) || 0,
      rejectedCount: Number(run?.rejectedCount) || 0,
      duplicateCount: Number(run?.duplicateCount) || 0,
      finishedAt: nowIso(),
      leaseExpiresAtMs: 0,
      lastHeartbeatAt: nowIso(),
      error: null,
      updatedAt: nowIso(),
    };
    await upsertPgJob(db, next);
    return refreshCampaignFromJobs(job.campaignId);
  }
  const jobs = await readJobs();
  const idx = jobs.findIndex((job) => job.id === id);
  if (idx === -1) throw new Error("Job not found.");
  const job = jobs[idx];
  if (job.status !== "running" || job.claimedBy !== worker) {
    throw new Error("Job is not owned by this worker.");
  }
  jobs[idx] = {
    ...job,
    status: "completed",
    discoveryRunId: run?.id ?? null,
    businessesFound: Number(run?.businessesFound) || 0,
    qualifiedCount: Number(run?.qualifiedCount) || 0,
    rejectedCount: Number(run?.rejectedCount) || 0,
    duplicateCount: Number(run?.duplicateCount) || 0,
    finishedAt: nowIso(),
    leaseExpiresAtMs: 0,
    lastHeartbeatAt: nowIso(),
    error: null,
    updatedAt: nowIso(),
  };
  await writeJobs(jobs);
  return refreshCampaignFromJobs(job.campaignId);
}

export async function failDiscoveryJob({ workerId, jobId, error = "job_failed", retryable = true } = {}) {
  const worker = String(workerId ?? "").trim();
  const id = String(jobId ?? "").trim();
  if (hasPostgres()) {
    await ensureDistributedSchema();
    const db = getDbPool();
    const result = await db.query(
      "SELECT payload FROM oe_jobs WHERE id = $1 LIMIT 1",
      [id],
    );
    const job = result.rows[0]?.payload;
    if (!job) throw new Error("Job not found.");
    if (job.status !== "running" || job.claimedBy !== worker) {
      throw new Error("Job is not owned by this worker.");
    }
    const exhausted = Number(job.attempts || 0) >= Number(job.maxAttempts || 3);
    const shouldRetry = Boolean(retryable) && !exhausted;
    const next = {
      ...job,
      status: shouldRetry ? "queued" : "failed",
      retryAtMs: shouldRetry ? nowMs() + retryDelayMs(job.attempts || 1) : 0,
      finishedAt: shouldRetry ? null : nowIso(),
      leaseExpiresAtMs: 0,
      lastHeartbeatAt: nowIso(),
      claimedBy: "",
      claimedAt: null,
      error: String(error || "job_failed"),
      updatedAt: nowIso(),
    };
    await upsertPgJob(db, next);
    return refreshCampaignFromJobs(job.campaignId);
  }
  const jobs = await readJobs();
  const idx = jobs.findIndex((job) => job.id === id);
  if (idx === -1) throw new Error("Job not found.");
  const job = jobs[idx];
  if (job.status !== "running" || job.claimedBy !== worker) {
    throw new Error("Job is not owned by this worker.");
  }
  const exhausted = Number(job.attempts || 0) >= Number(job.maxAttempts || 3);
  const shouldRetry = Boolean(retryable) && !exhausted;
  jobs[idx] = {
    ...job,
    status: shouldRetry ? "queued" : "failed",
    retryAtMs: shouldRetry ? nowMs() + retryDelayMs(job.attempts || 1) : 0,
    finishedAt: shouldRetry ? null : nowIso(),
    leaseExpiresAtMs: 0,
    lastHeartbeatAt: nowIso(),
    claimedBy: "",
    claimedAt: null,
    error: String(error || "job_failed"),
    updatedAt: nowIso(),
  };
  await writeJobs(jobs);
  return refreshCampaignFromJobs(job.campaignId);
}

export async function requeueIncompleteCampaignJobs(campaignId) {
  if (hasPostgres()) {
    await ensureDistributedSchema();
    const db = getDbPool();
    const result = await db.query(
      "SELECT payload FROM oe_jobs WHERE campaign_id = $1 AND status <> 'completed'",
      [campaignId],
    );
    let changed = 0;
    for (const row of result.rows) {
      const job = row.payload;
      const next = {
        ...job,
        status: "queued",
        retryAtMs: 0,
        claimedBy: "",
        claimedAt: null,
        leaseExpiresAtMs: 0,
        lastHeartbeatAt: null,
        error: null,
        updatedAt: nowIso(),
      };
      await upsertPgJob(db, next);
      changed += 1;
    }
    await refreshCampaignFromJobs(campaignId);
    return { requeued: changed };
  }
  const jobs = await readJobs();
  let changed = 0;
  for (let idx = 0; idx < jobs.length; idx += 1) {
    const job = jobs[idx];
    if (job.campaignId !== campaignId) continue;
    if (job.status === "completed") continue;
    jobs[idx] = {
      ...job,
      status: "queued",
      retryAtMs: 0,
      claimedBy: "",
      claimedAt: null,
      leaseExpiresAtMs: 0,
      lastHeartbeatAt: null,
      error: null,
      updatedAt: nowIso(),
    };
    changed += 1;
  }
  if (changed) {
    await writeJobs(jobs);
  }
  await refreshCampaignFromJobs(campaignId);
  return { requeued: changed };
}

export async function getCampaignJobStats(campaignId) {
  const jobs = await listCampaignJobs(campaignId);
  return summarizeJobs(jobs);
}

export async function refreshCampaignFromJobs(campaignId) {
  const campaign = await getDiscoveryCampaign(campaignId);
  if (!campaign) return null;
  const stats = await getCampaignJobStats(campaignId);
  const next = {
    ...campaign,
    status: stats.status,
    totalPairs: stats.totalPairs,
    completedPairs: stats.completedPairs,
    currentPair: stats.currentPair,
    pairResults: stats.pairResults,
    totals: stats.totals,
    error: stats.error,
    finishedAt:
      stats.status === "completed"
        ? campaign.finishedAt ?? nowIso()
        : stats.status === "failed"
          ? campaign.finishedAt ?? nowIso()
          : null,
  };
  await saveDiscoveryCampaign(next);
  return next;
}
