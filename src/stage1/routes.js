import { executeBusinessDiscoveryRun } from "./discovery-run.js";
import { newDiscoveryRunId } from "./shared.js";
import {
  buildDatabaseSummary,
  buildBusinessRecord,
  filterBusinesses,
  getDiscoveryRun,
  getQualifiedBusiness,
  isPreviewVerified,
  isReadyForOutreach,
  listDiscoveryRuns,
  listQualifiedBusinesses,
  upsertQualifiedBusiness,
} from "./qualified-business-store.js";
import { contactMethodLabel } from "./contact-method.js";
import { getOpportunityProject } from "../v7/opportunity-project-store.js";
import {
  buildProjectPatch,
  createProjectForBusiness,
  founderQueueView,
  generateProjectsForRecords,
  selectQualifiedBusinesses,
  verifyPreview,
} from "./founder-preview-bridge.js";

const stage1Runs = new Map();

function parseFilters(query = {}) {
  return {
    qualifiedOnly: query.qualifiedOnly === "1" || query.qualifiedOnly === "true",
    noWebsite: query.noWebsite === "1" || query.noWebsite === "true",
    poorWebsite: query.poorWebsite === "1" || query.poorWebsite === "true",
    textFirst: query.textFirst === "1" || query.textFirst === "true",
    emailFirst: query.emailFirst === "1" || query.emailFirst === "true",
    notContactable: query.notContactable === "1" || query.notContactable === "true",
    readyForOutreach: query.readyForOutreach === "1" || query.readyForOutreach === "true",
    industry: query.industry ?? "",
    city: query.city ?? "",
  };
}

function publicBusinessView(record) {
  return {
    ...record,
    contactMethodLabel: contactMethodLabel(record.contactMethodCategory),
    readyForOutreach: isReadyForOutreach(record),
    previewVerified: isPreviewVerified(record),
    ...projectStatusView(record),
  };
}

function projectStatusView(record) {
  if (!record.opportunityProjectId) {
    return {
      projectStatus: "No Project",
      previewStatus: "No Project",
    };
  }
  return {
    projectStatus: record.projectStatus || "Project Created",
    previewStatus: record.previewStatus || (record.previewGenerated ? "Preview Generated" : "Project Created"),
  };
}

export function registerStage1Routes(app) {
  app.get("/api/stage1/summary", async (_req, res) => {
    const records = await listQualifiedBusinesses();
    return res.json(await buildDatabaseSummary(records));
  });

  app.get("/api/stage1/businesses", async (req, res) => {
    const records = await listQualifiedBusinesses();
    const filters = parseFilters(req.query);
    const filtered = filterBusinesses(records, filters);
    const summary = await buildDatabaseSummary(records);
    return res.json({
      businesses: filtered.map(publicBusinessView),
      summary,
      filters,
      total: filtered.length,
    });
  });

  app.get("/api/stage1/businesses/:id", async (req, res) => {
    const record = await getQualifiedBusiness(req.params.id);
    if (!record) return res.status(404).json({ error: "Business not found" });
    return res.json(publicBusinessView(record));
  });

  app.post("/api/stage1/businesses/:id/project", async (req, res) => {
    try {
      const record = await getQualifiedBusiness(req.params.id);
      if (!record) return res.status(404).json({ error: "Business not found" });
      if (record.qualificationStatus !== "qualified") {
        return res.status(400).json({ error: "Only qualified businesses can generate opportunity projects." });
      }
      const result = await createProjectForBusiness(record, req);
      return res.status(result.status === "created" ? 201 : 200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/stage1/projects/generate", async (req, res) => {
    try {
      const mode = String(req.body?.mode ?? "selected").toLowerCase();
      const selectedBusinessIds = Array.isArray(req.body?.selectedBusinessIds)
        ? req.body.selectedBusinessIds
        : [];
      const records = await listQualifiedBusinesses();
      const selected = selectQualifiedBusinesses(records, mode, selectedBusinessIds);
      return res.status(200).json(await generateProjectsForRecords(selected, req));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/stage1/projects/generate-founder-test-queue", async (req, res) => {
    try {
      const records = await listQualifiedBusinesses();
      const selected = selectQualifiedBusinesses(records, "top_25", []);
      return res.status(200).json(await generateProjectsForRecords(selected, req));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/stage1/founder-test-queue", async (req, res) => {
    const status = String(req.query?.status ?? "").toLowerCase();
    const records = await listQualifiedBusinesses();
    let qualified = records.filter((row) => row.qualificationStatus === "qualified");
    if (status === "no_project") {
      qualified = qualified.filter((row) => !row.opportunityProjectId);
    } else if (status === "project_created") {
      qualified = qualified.filter((row) => row.opportunityProjectId && !row.previewGenerated);
    } else if (status === "preview_generated") {
      qualified = qualified.filter((row) => row.previewGenerated);
    } else if (status === "ready_for_outreach") {
      qualified = qualified.filter((row) => isReadyForOutreach(row));
    }

    const queue = qualified.map(founderQueueView);
    return res.json({
      total: queue.length,
      queue,
      summary: {
        noProject: queue.filter((row) => !row.opportunityProjectId).length,
        projectCreated: queue.filter((row) => row.opportunityProjectId).length,
        previewGenerated: queue.filter((row) => row.previewGenerated).length,
        previewVerified: queue.filter((row) => row.previewVerified).length,
        readyForOutreach: queue.filter((row) => row.readyForOutreach).length,
      },
    });
  });

  app.post("/api/stage1/projects/:businessId/verify-preview", async (req, res) => {
    try {
      const record = await getQualifiedBusiness(req.params.businessId);
      if (!record) return res.status(404).json({ error: "Business not found" });
      if (!record.opportunityProjectId) {
        return res.status(400).json({ error: "No opportunity project exists for this business." });
      }
      const project = await getOpportunityProject(record.opportunityProjectId);
      if (!project) {
        return res.status(404).json({ error: "Linked opportunity project was not found." });
      }
      const verification = await verifyPreview(project, req);
      const base = `${req.protocol}://${req.get("host")}`;
      const patched = buildProjectPatch(
        record,
        project,
        {
          previewUrl: `${base}/p/${project.id}`,
          launchUrl: `${base}/launch/${project.id}`,
          dashboardUrl: `${base}/dashboard/${project.id}`,
        },
        verification,
        record.projectGenerationDurationMs,
      );
      if (verification?.ok) {
        patched.readyForOutreach = true;
        patched.readyForOutreachAt = new Date().toISOString();
      }
      await upsertQualifiedBusiness(patched);
      return res.json({
        businessId: record.id,
        projectId: project.id,
        verification,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/stage1/businesses/:id/mark-ready", async (req, res) => {
    try {
      const record = await getQualifiedBusiness(req.params.id);
      if (!record) return res.status(404).json({ error: "Business not found" });
      if (!record.opportunityProjectId) {
        return res.status(400).json({ error: "Project must exist before marking ready." });
      }
      if (!isPreviewVerified(record)) {
        return res.status(400).json({ error: "Preview must be generated and verified before marking ready." });
      }
      const patched = buildBusinessRecord({
        ...record,
        readyForOutreach: true,
        readyForOutreachAt: new Date().toISOString(),
      });
      await upsertQualifiedBusiness(patched);
      return res.json({ business: publicBusinessView(patched) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/stage1/discovery-runs", async (_req, res) => {
    const runs = await listDiscoveryRuns();
    return res.json({ runs });
  });

  app.get("/api/stage1/discover/:runId", async (req, res) => {
    const live = stage1Runs.get(req.params.runId);
    if (live) return res.json(live);
    const saved = await getDiscoveryRun(req.params.runId);
    if (!saved) return res.status(404).json({ error: "Discovery run not found" });
    return res.json(saved);
  });

  app.post("/api/stage1/discover", async (req, res) => {
    const { industry, city, state, maxBusinesses } = req.body ?? {};
    const runId = newDiscoveryRunId();

    const runState = {
      id: runId,
      status: "starting",
      industry,
      city,
      state,
      maxBusinesses,
      logs: [{ at: new Date().toISOString(), message: "Discovery run queued" }],
      progress: 0,
    };
    stage1Runs.set(runId, runState);

    res.status(202).json({ runId, status: "starting" });

    executeBusinessDiscoveryRun(
      { industry, city, state, maxBusinesses },
      {
        runId,
        onProgress: (update) => {
          stage1Runs.set(runId, { ...update });
        },
      }
    ).catch((err) => {
      stage1Runs.set(runId, {
        ...runState,
        status: "failed",
        error: err.message,
        finishedAt: new Date().toISOString(),
      });
    });
  });
}
