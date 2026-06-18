import { renderHomePage } from "./pages/home.js";
import { renderCallQueuePage } from "./pages/call-queue.js";
import { renderPipelinePage } from "./pages/pipeline.js";
import { renderOpportunitiesPage } from "./pages/opportunities.js";
import { renderSettingsPage } from "./pages/settings.js";
import { renderLoginPage } from "./pages/login.js";
import {
  buildPivotalDashboard,
  buildPipelineMetrics,
  buildOpportunityFolders,
  buildSettingsSnapshot,
} from "./metrics.js";
import { registerSalesModeRoutes } from "../mission-control/sales-mode.js";
import { cleanText } from "../stage1/shared.js";
import { requireOperatorApi, requireOperatorPage } from "../operators/middleware.js";

export function registerPivotalOsRoutes(app, options = {}) {
  const operatorPage = options.requireOperatorPage ?? requireOperatorPage;
  const operatorApi = options.requireOperatorApi ?? requireOperatorApi;

  app.get("/login", (req, res) => {
    const returnTo = cleanText(req.query.return) || "/";
    return res.type("html").send(renderLoginPage(returnTo));
  });

  app.get("/", operatorPage, (_req, res) => res.type("html").send(renderHomePage()));
  app.get("/call-queue", operatorPage, (_req, res) => res.type("html").send(renderCallQueuePage()));
  app.get("/pipeline", operatorPage, (_req, res) => res.type("html").send(renderPipelinePage()));
  app.get("/opportunities", operatorPage, (_req, res) => res.type("html").send(renderOpportunitiesPage()));
  app.get("/settings", operatorPage, (_req, res) => res.type("html").send(renderSettingsPage()));

  app.get("/mission-control", (_req, res) => res.redirect(302, "/"));
  app.get("/mission-control/sales", (_req, res) => res.redirect(302, "/call-queue"));
  app.get("/angle-folders", (_req, res) => res.redirect(302, "/opportunities"));

  app.get("/api/pivotal-os/dashboard", operatorApi, async (req, res) => {
    try {
      return res.json(await buildPivotalDashboard(req, req.operator));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pivotal-os/pipeline", operatorApi, async (_req, res) => {
    try {
      return res.json(await buildPipelineMetrics());
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pivotal-os/opportunities", operatorApi, async (req, res) => {
    try {
      return res.json(await buildOpportunityFolders(req));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pivotal-os/settings", operatorApi, (_req, res) => {
    return res.json(buildSettingsSnapshot());
  });

  registerSalesModeRoutes(app, { requireOperatorApi: operatorApi });
}

export { renderHomePage, renderCallQueuePage };
