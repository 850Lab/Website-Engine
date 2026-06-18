import { renderHomePage } from "./pages/home.js";
import { renderCallQueuePage } from "./pages/call-queue.js";
import { renderPipelinePage } from "./pages/pipeline.js";
import { renderOpportunitiesPage } from "./pages/opportunities.js";
import { renderSettingsPage } from "./pages/settings.js";
import {
  buildPivotalDashboard,
  buildPipelineMetrics,
  buildOpportunityFolders,
  buildSettingsSnapshot,
} from "./metrics.js";
import { registerSalesModeRoutes } from "../mission-control/sales-mode.js";

export function registerPivotalOsRoutes(app) {
  app.get("/", (_req, res) => res.type("html").send(renderHomePage()));
  app.get("/call-queue", (_req, res) => res.type("html").send(renderCallQueuePage()));
  app.get("/pipeline", (_req, res) => res.type("html").send(renderPipelinePage()));
  app.get("/opportunities", (_req, res) => res.type("html").send(renderOpportunitiesPage()));
  app.get("/settings", (_req, res) => res.type("html").send(renderSettingsPage()));

  app.get("/mission-control", (_req, res) => res.redirect(302, "/"));
  app.get("/mission-control/sales", (_req, res) => res.redirect(302, "/call-queue"));
  app.get("/angle-folders", (_req, res) => res.redirect(302, "/opportunities"));

  app.get("/api/pivotal-os/dashboard", async (req, res) => {
    try {
      return res.json(await buildPivotalDashboard(req));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pivotal-os/pipeline", async (_req, res) => {
    try {
      return res.json(await buildPipelineMetrics());
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pivotal-os/opportunities", async (req, res) => {
    try {
      return res.json(await buildOpportunityFolders(req));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pivotal-os/settings", (_req, res) => {
    return res.json(buildSettingsSnapshot());
  });

  registerSalesModeRoutes(app);
}

export { renderHomePage, renderCallQueuePage };
