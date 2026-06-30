import { renderPrivacyPolicyPage } from "./privacy-policy-page.js";

export function registerLegalRoutes(app) {
  app.get("/privacy", async (req, res, next) => {
    try {
      const homeUrl = `${req.protocol}://${req.get("host")}/`;
      return res.type("html").send(await renderPrivacyPolicyPage({ homeUrl }));
    } catch (err) {
      return next(err);
    }
  });
}
