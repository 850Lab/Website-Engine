import {
  campaignQueue,
  executeDiscoveryCampaign,
  getActiveCampaignId,
  getLiveCampaign,
  getOpportunityEngineConfig,
  resumeDiscoveryCampaign,
  setLiveCampaign,
} from "./discovery-campaign.js";
import { buildOpportunityDashboard } from "./dashboard-metrics.js";
import { buildIntelligenceDashboard } from "./intelligence-dashboard.js";
import {
  getBestResumableCampaign,
  getDiscoveryCampaign,
  listDiscoveryCampaigns,
  newCampaignId,
} from "./campaign-store.js";
import { enrichCampaignView } from "./campaign-progress.js";
import { buildSoutheastTexasOpportunityReport } from "./reports/southeast-texas-report.js";
import { buildContactAuditReport } from "./reports/contact-audit.js";
import { buildCoverageAnalysisReport } from "./reports/coverage-analysis.js";
import { buildDataQualityReport } from "./reports/data-quality.js";
import { getAdapterRegistryView } from "../discovery-adapters/registry.js";
import { migrateRecordsToIdentities, getIdentityMigrationStatus } from "../identity/migrate-identities.js";
import { listBusinessSources, getSourcesForIdentity } from "../identity/identity-store.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { writeJsonFileSafe } from "../storage.js";
import { requireWorkerApiKey } from "../worker-auth.js";
import {
  claimDiscoveryJob,
  completeDiscoveryJob,
  failDiscoveryJob,
  getCampaignJobStats,
  heartbeatDiscoveryJob,
  listCampaignJobs,
  refreshCampaignFromJobs,
} from "./distributed-job-store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = join(__dirname, "..", "..", "data", "southeast-texas-opportunity-report.json");

function queueCampaignRun(runner) {
  runner().catch(() => {
    // errors persisted on campaign record
  });
}

export function registerOpportunityEngineRoutes(app) {
  app.get("/api/opportunity-engine/config", async (_req, res) => {
    return res.json(getOpportunityEngineConfig());
  });

  app.get("/api/opportunity-engine/adapters", async (_req, res) => {
    return res.json({ adapters: await getAdapterRegistryView() });
  });

  app.get("/api/opportunity-engine/identity/status", async (_req, res) => {
    return res.json(await getIdentityMigrationStatus());
  });

  app.post("/api/opportunity-engine/identity/migrate", async (_req, res) => {
    return res.json(await migrateRecordsToIdentities());
  });

  app.get("/api/opportunity-engine/businesses/:recordId/sources", async (req, res) => {
    const { getQualifiedBusiness } = await import("../stage1/qualified-business-store.js");
    const record = await getQualifiedBusiness(req.params.recordId);
    if (!record?.businessIdentityId) {
      return res.json({ sources: [] });
    }
    const sources = await getSourcesForIdentity(record.businessIdentityId);
    return res.json({ businessIdentityId: record.businessIdentityId, sources });
  });

  app.get("/api/opportunity-engine/dashboard", async (_req, res) => {
    return res.json(await buildOpportunityDashboard());
  });

  app.get("/api/opportunity-engine/intelligence", async (_req, res) => {
    return res.json(await buildIntelligenceDashboard());
  });

  app.get("/api/opportunity-engine/reports/southeast-texas", async (_req, res) => {
    const report = await buildSoutheastTexasOpportunityReport();
    await writeJsonFileSafe(REPORT_FILE, report);
    return res.json(report);
  });

  app.get("/api/opportunity-engine/reports/contact-audit", async (_req, res) => {
    return res.json(await buildContactAuditReport());
  });

  app.get("/api/opportunity-engine/reports/coverage", async (_req, res) => {
    return res.json(await buildCoverageAnalysisReport());
  });

  app.get("/api/opportunity-engine/reports/data-quality", async (_req, res) => {
    return res.json(await buildDataQualityReport());
  });

  app.get("/api/opportunity-engine/campaigns", async (_req, res) => {
    const campaigns = await listDiscoveryCampaigns();
    const resumable = await getBestResumableCampaign();
    return res.json({
      campaigns: campaigns.map(enrichCampaignView),
      resumable: resumable ? enrichCampaignView(resumable) : null,
      activeCampaignId: getActiveCampaignId(),
    });
  });

  app.get("/api/opportunity-engine/campaigns/:campaignId", async (req, res) => {
    const refreshed = await refreshCampaignFromJobs(req.params.campaignId);
    if (refreshed) {
      setLiveCampaign(refreshed);
    }
    const live = getLiveCampaign(req.params.campaignId);
    if (live) return res.json(enrichCampaignView(live));
    const saved = await getDiscoveryCampaign(req.params.campaignId);
    if (!saved) return res.status(404).json({ error: "Discovery campaign not found" });
    return res.json(enrichCampaignView(saved));
  });

  app.post("/api/opportunity-engine/campaigns/resume", async (_req, res) => {
    const resumable = await getBestResumableCampaign();
    if (!resumable) {
      return res.status(404).json({ error: "No resumable campaign found." });
    }

    const campaignId = resumable.id;
    campaignQueue.set(campaignId, enrichCampaignView({ ...resumable, status: "starting" }));
    res.status(202).json({ campaignId, status: "resuming", resumed: true });

    queueCampaignRun(() =>
      resumeDiscoveryCampaign(campaignId, {
        onProgress: (update) => campaignQueue.set(campaignId, update),
      }),
    );
  });

  app.post("/api/opportunity-engine/campaigns/:campaignId/resume", async (req, res) => {
    const saved = await getDiscoveryCampaign(req.params.campaignId);
    if (!saved) return res.status(404).json({ error: "Discovery campaign not found" });

    const campaignId = saved.id;
    campaignQueue.set(campaignId, enrichCampaignView({ ...saved, status: "starting" }));
    res.status(202).json({ campaignId, status: "resuming", resumed: true });

    queueCampaignRun(() =>
      resumeDiscoveryCampaign(campaignId, {
        onProgress: (update) => campaignQueue.set(campaignId, update),
      }),
    );
  });

  app.post("/api/opportunity-engine/campaigns", async (req, res) => {
    const resumable = await getBestResumableCampaign();
    if (resumable && !req.body?.forceNew) {
      return res.status(409).json({
        error: "Incomplete campaign exists. Resume it instead of starting a duplicate.",
        resumableCampaignId: resumable.id,
        completedPairs: resumable.completedPairs,
        totalPairs: resumable.totalPairs,
      });
    }

    const campaignId = newCampaignId();
    campaignQueue.set(campaignId, {
      id: campaignId,
      status: "starting",
      startedAt: new Date().toISOString(),
      logs: [{ at: new Date().toISOString(), message: "Discovery campaign queued" }],
      progress: 0,
    });

    res.status(202).json({ campaignId, status: "starting" });

    queueCampaignRun(() =>
      executeDiscoveryCampaign({ ...req.body, forceNew: true }, {
        campaignId,
        onProgress: (update) => campaignQueue.set(campaignId, update),
      }),
    );
  });

  app.get("/api/opportunity-engine/campaigns/:campaignId/jobs", async (req, res) => {
    const campaign = await getDiscoveryCampaign(req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: "Discovery campaign not found" });
    const [jobs, stats] = await Promise.all([
      listCampaignJobs(req.params.campaignId),
      getCampaignJobStats(req.params.campaignId),
    ]);
    return res.json({ campaignId: req.params.campaignId, jobs, stats });
  });

  app.post("/api/opportunity-engine/jobs/claim", requireWorkerApiKey, async (req, res) => {
    try {
      const job = await claimDiscoveryJob({
        workerId: req.body?.workerId,
        campaignId: req.body?.campaignId ?? "",
        leaseSeconds: req.body?.leaseSeconds ?? 180,
      });
      if (!job) return res.status(204).send();
      return res.status(200).json(job);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/opportunity-engine/jobs/:jobId/heartbeat", requireWorkerApiKey, async (req, res) => {
    const ok = await heartbeatDiscoveryJob({
      workerId: req.body?.workerId,
      jobId: req.params.jobId,
      leaseSeconds: req.body?.leaseSeconds ?? 180,
    });
    if (!ok) return res.status(409).json({ error: "Heartbeat rejected." });
    return res.json({ ok: true });
  });

  app.post("/api/opportunity-engine/jobs/:jobId/complete", requireWorkerApiKey, async (req, res) => {
    try {
      const campaign = await completeDiscoveryJob({
        workerId: req.body?.workerId,
        jobId: req.params.jobId,
        run: req.body?.run,
      });
      if (campaign) setLiveCampaign(campaign);
      return res.json({ ok: true, campaign });
    } catch (err) {
      return res.status(409).json({ error: err.message });
    }
  });

  app.post("/api/opportunity-engine/jobs/:jobId/fail", requireWorkerApiKey, async (req, res) => {
    try {
      const campaign = await failDiscoveryJob({
        workerId: req.body?.workerId,
        jobId: req.params.jobId,
        error: req.body?.error ?? "job_failed",
        retryable: req.body?.retryable !== false,
      });
      if (campaign) setLiveCampaign(campaign);
      return res.json({ ok: true, campaign });
    } catch (err) {
      return res.status(409).json({ error: err.message });
    }
  });
}
