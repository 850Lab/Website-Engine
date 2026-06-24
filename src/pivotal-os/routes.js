import { renderHomePage } from "./pages/home.js";
import { renderSettingsPage } from "./pages/settings.js";
import { renderLoginPage } from "./pages/login.js";
import { registerSalesModeRoutes } from "../mission-control/sales-mode.js";
import { registerOutreachFocusRoutes } from "../outreach-focus/routes.js";
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
  app.get("/campaigns", operatorPage, (_req, res) => res.type("html").send(renderHomePage()));
  app.get("/actions", operatorPage, (_req, res) => res.type("html").send(renderHomePage()));
  app.get("/opportunities", operatorPage, (_req, res) => res.type("html").send(renderHomePage()));
  app.get("/settings", operatorPage, (_req, res) => res.type("html").send(renderSettingsPage()));

  app.get("/call-queue", (_req, res) => res.redirect(302, "/actions"));
  app.get("/pw/queue", (_req, res) => res.redirect(302, "/actions"));
  app.get("/pipeline", (_req, res) => res.redirect(302, "/opportunities"));
  app.get("/mission-control", (_req, res) => res.redirect(302, "/"));
  app.get("/mission-control/sales", (_req, res) => res.redirect(302, "/actions"));
  app.get("/angle-folders", (_req, res) => res.redirect(302, "/opportunities"));

  registerSalesModeRoutes(app, { requireOperatorApi: operatorApi });
  registerOutreachFocusRoutes(app, { requireOperatorApi: operatorApi });
}

export { renderHomePage };
