import { renderLegalPolicyPage } from "./policy-page.js";

const POLICIES = Object.freeze([
  { path: "/privacy", relativePath: "docs/legal/privacy-policy.md", pageTitle: "Privacy Policy" },
  { path: "/legal/pii", relativePath: "docs/legal/pii-policy.md", pageTitle: "PII Policy" },
  { path: "/legal/email-compliance", relativePath: "docs/legal/email-compliance-policy.md", pageTitle: "Email Compliance" },
  { path: "/legal/outreach-approval", relativePath: "docs/legal/outreach-approval-policy.md", pageTitle: "Outreach Approval" },
  { path: "/legal/source-connectors", relativePath: "docs/legal/source-connector-policy.md", pageTitle: "Source Connectors" },
  { path: "/legal/operations", relativePath: "docs/legal/operations-policy.md", pageTitle: "Operations Policy" },
]);

export function registerLegalRoutes(app) {
  for (const policy of POLICIES) {
    app.get(policy.path, async (req, res, next) => {
      try {
        const homeUrl = `${req.protocol}://${req.get("host")}/`;
        return res
          .type("html")
          .send(
            await renderLegalPolicyPage({
              relativePath: policy.relativePath,
              pageTitle: policy.pageTitle,
              homeUrl,
            }),
          );
      } catch (err) {
        return next(err);
      }
    });
  }
}
