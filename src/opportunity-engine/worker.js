import { randomUUID } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { executeBusinessDiscoveryRun } from "../stage1/discovery-run.js";
import {
  claimDiscoveryJob,
  completeDiscoveryJob,
  failDiscoveryJob,
  heartbeatDiscoveryJob,
} from "./distributed-job-store.js";

const workerId = process.env.WORKER_ID || `worker_${randomUUID().slice(0, 8)}`;
const heartbeatSeconds = Math.max(30, Number(process.env.WORKER_HEARTBEAT_SECONDS) || 60);
const leaseSeconds = Math.max(60, Number(process.env.WORKER_LEASE_SECONDS) || 180);
const idleMs = Math.max(1500, Number(process.env.WORKER_IDLE_MS) || 5000);
const campaignId = String(process.env.CAMPAIGN_ID || "").trim();

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

async function runSingleJob(job) {
  const heartbeat = setInterval(() => {
    heartbeatDiscoveryJob({
      workerId,
      jobId: job.id,
      leaseSeconds,
    }).catch(() => {});
  }, heartbeatSeconds * 1000);

  try {
    const run = await executeBusinessDiscoveryRun({
      industry: job.industry,
      city: job.city,
      state: job.state,
      maxBusinesses: Number(process.env.WORKER_MAX_BUSINESSES_PER_SEARCH) || 25,
      campaignId: job.campaignId,
      adapterId: job.adapterId,
    });
    await completeDiscoveryJob({
      workerId,
      jobId: job.id,
      run,
    });
    console.log(
      `[${workerId}] completed ${job.id} ${job.adapterId} ${job.industry} ${job.city} -> run ${run.id}`,
    );
  } catch (err) {
    await failDiscoveryJob({
      workerId,
      jobId: job.id,
      error: err.message,
      retryable: true,
    }).catch(() => {});
    console.error(`[${workerId}] failed ${job.id}: ${err.message}`);
  } finally {
    clearInterval(heartbeat);
  }
}

async function loop() {
  console.log(
    `[${workerId}] discovery worker started${campaignId ? ` for campaign ${campaignId}` : ""}`,
  );
  while (!stopping) {
    const job = await claimDiscoveryJob({
      workerId,
      campaignId,
      leaseSeconds,
    });
    if (!job) {
      await wait(idleMs);
      continue;
    }
    await runSingleJob(job);
  }
  console.log(`[${workerId}] shutting down`);
}

loop().catch((err) => {
  console.error(`[${workerId}] fatal worker error: ${err.message}`);
  process.exit(1);
});
