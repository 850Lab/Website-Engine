import {
  renderActivatePage,
  renderDashboardPage,
  renderLaunchPage,
  renderPreviewPage,
} from "./public-pages.js";
import { runProjectActivation } from "./activation.js";
import { buildCustomerDashboard } from "./customer-dashboard.js";
import {
  customerTokenCookieName,
  readCustomerToken,
  validateCustomerAccess,
} from "./customer-auth.js";
import { recordFunnelEvent } from "./funnel-events.js";
import {
  createOpportunityProject,
  recordProjectVisitor,
} from "./opportunity-project.js";
import {
  getOpportunityProject,
  listOpportunityProjects,
  publicProjectView,
  sanitizeProjectForOperator,
} from "./opportunity-project-store.js";
import { createLaunchCheckoutSession, getLaunchStripeStatus } from "./stripe-launch.js";
import { publicBaseUrl } from "./shared.js";
import {
  getFounderTestingProject,
  getFounderWalkSteps,
  listFounderTestingView,
  runFounderWalkActivation,
  simulateFounderTestPurchase,
  updateFounderTestingNotes,
} from "./founder-testing.js";

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

export function registerV7Routes(app) {
  app.get("/p/:projectId", async (req, res, next) => {
    try {
      const project = await getOpportunityProject(req.params.projectId);
      if (!project) return res.status(404).send("Project not found");
      const base = publicBaseUrl(req);
      return res.type("html").send(renderPreviewPage(project, base));
    } catch (err) {
      return next(err);
    }
  });

  app.get("/launch/:projectId", async (req, res, next) => {
    try {
      const project = await getOpportunityProject(req.params.projectId);
      if (!project) return res.status(404).send("Project not found");
      const base = publicBaseUrl(req);
      const cancelled = req.query.cancelled === "1";
      return res.type("html").send(renderLaunchPage(project, base, { cancelled }));
    } catch (err) {
      return next(err);
    }
  });

  app.get("/activate/:projectId", async (req, res, next) => {
    try {
      const project = await getOpportunityProject(req.params.projectId);
      if (!project) return res.status(404).send("Project not found");
      const base = publicBaseUrl(req);
      return res
        .type("html")
        .send(renderActivatePage(project, base, { sessionId: String(req.query.session_id || "") }));
    } catch (err) {
      return next(err);
    }
  });

  app.get("/dashboard/:projectId", async (req, res, next) => {
    try {
      const project = await getOpportunityProject(req.params.projectId);
      if (!project) return res.status(404).send("Project not found");
      const token = readCustomerToken(req, project.id);
      const access = validateCustomerAccess(project, token);
      if (!access.ok && project.flags?.dashboardReady) {
        return res.status(401).send("Dashboard access link required. Check your activation email or receipt.");
      }
      const base = publicBaseUrl(req);
      const html = await renderDashboardPage(project, base, { token });
      return res.type("html").send(html);
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/public/projects/:projectId", async (req, res) => {
    const project = await getOpportunityProject(req.params.projectId);
    if (!project) return jsonError(res, 404, "Project not found");
    return res.json({ project: publicProjectView(project) });
  });

  app.post("/api/public/projects/:projectId/checkout", async (req, res) => {
    try {
      const project = await getOpportunityProject(req.params.projectId);
      if (!project) return jsonError(res, 404, "Project not found");
      const base = publicBaseUrl(req);
      const session = await createLaunchCheckoutSession({
        project,
        origin: base,
        email: req.body?.email,
      });
      return res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
      return jsonError(res, 400, err.message);
    }
  });

  app.post("/api/public/projects/:projectId/activate", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const result = await runProjectActivation({
        projectId,
        sessionId: req.body?.sessionId,
        req,
      });
      if (!result.ok) {
        return res.status(402).json({
          error: "Payment not confirmed yet.",
          reason: result.reason,
        });
      }
      if (result.project?.customerAccessToken) {
        res.cookie(customerTokenCookieName(projectId), result.project.customerAccessToken, {
          httpOnly: true,
          sameSite: "lax",
          maxAge: 365 * 24 * 60 * 60 * 1000,
        });
      }
      return res.json({
        ok: true,
        dashboardUrl: result.dashboardUrl,
        project: publicProjectView(result.project),
      });
    } catch (err) {
      return jsonError(res, 400, err.message);
    }
  });

  app.post("/api/public/projects/:projectId/visitor", async (req, res) => {
    const project = await recordProjectVisitor(req.params.projectId);
    if (!project) return jsonError(res, 404, "Project not found");
    return res.json({ ok: true, visitors: project.metrics?.visitorsLifetime ?? 0 });
  });

  app.post("/api/public/funnel/event", async (req, res) => {
    try {
      const entry = await recordFunnelEvent({
        projectId: req.body?.projectId,
        event: req.body?.event,
        sessionId: req.body?.sessionId,
        meta: req.body?.meta,
      });
      return res.json({ ok: true, id: entry.id });
    } catch (err) {
      return jsonError(res, 400, err.message);
    }
  });

  app.get("/api/customer/projects/:projectId/dashboard", async (req, res) => {
    const project = await getOpportunityProject(req.params.projectId);
    if (!project) return jsonError(res, 404, "Project not found");
    const token = readCustomerToken(req, project.id);
    const access = validateCustomerAccess(project, token);
    if (!access.ok) return jsonError(res, 401, "Invalid dashboard access");
    const dashboard = await buildCustomerDashboard(project);
    return res.json(dashboard);
  });
}

export function registerV7OperatorRoutes(app) {
  app.get("/api/v7/projects", async (_req, res) => {
    const projects = await listOpportunityProjects();
    return res.json({
      projects: projects.map(sanitizeProjectForOperator),
      stripe: getLaunchStripeStatus(),
    });
  });

  app.get("/api/v7/projects/:projectId", async (req, res) => {
    const project = await getOpportunityProject(req.params.projectId);
    if (!project) return jsonError(res, 404, "Project not found");
    const base = publicBaseUrl(req);
    return res.json({
      project: sanitizeProjectForOperator(project),
      links: {
        preview: `${base}/p/${project.id}`,
        launch: `${base}/launch/${project.id}`,
        dashboard: project.customerAccessToken
          ? `${base}/dashboard/${project.id}?token=${encodeURIComponent(project.customerAccessToken)}`
          : `${base}/dashboard/${project.id}`,
      },
      stripe: getLaunchStripeStatus(),
    });
  });

  app.post("/api/v7/projects", async (req, res) => {
    try {
      const project = await createOpportunityProject(req.body ?? {});
      const base = publicBaseUrl(req);
      return res.status(201).json({
        project: sanitizeProjectForOperator(project),
        links: {
          preview: `${base}/p/${project.id}`,
          launch: `${base}/launch/${project.id}`,
        },
      });
    } catch (err) {
      return jsonError(res, 400, err.message);
    }
  });

  app.get("/api/v7/founder-testing", async (req, res) => {
    return res.json(await listFounderTestingView(req));
  });

  app.get("/api/v7/founder-testing/:projectId", async (req, res) => {
    const view = await getFounderTestingProject(req.params.projectId, req);
    if (!view) return jsonError(res, 404, "Project not found");
    return res.json(view);
  });

  app.put("/api/v7/founder-testing/:projectId/notes", async (req, res) => {
    try {
      const notes = await updateFounderTestingNotes(req.params.projectId, req.body ?? {});
      const view = await getFounderTestingProject(req.params.projectId, req);
      return res.json({ notes, readiness: view?.readiness ?? null });
    } catch (err) {
      return jsonError(res, 400, err.message);
    }
  });

  app.get("/api/v7/founder-testing/:projectId/walk", async (req, res) => {
    const walk = await getFounderWalkSteps(req.params.projectId, req);
    if (!walk) return jsonError(res, 404, "Project not found");
    return res.json(walk);
  });

  app.post("/api/v7/founder-testing/:projectId/walk/simulate-purchase", async (req, res) => {
    try {
      return res.json(await simulateFounderTestPurchase(req.params.projectId));
    } catch (err) {
      return jsonError(res, 400, err.message);
    }
  });

  app.post("/api/v7/founder-testing/:projectId/walk/activate", async (req, res) => {
    try {
      return res.json(await runFounderWalkActivation(req.params.projectId, req));
    } catch (err) {
      return jsonError(res, 400, err.message);
    }
  });
}
