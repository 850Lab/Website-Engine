import { recordFunnelEvent } from "./funnel-events.js";
import { activateOpportunityProject } from "./opportunity-project.js";
import { getOpportunityProject } from "./opportunity-project-store.js";
import { confirmLaunchCheckoutSession } from "./stripe-launch.js";
import { customerDashboardUrl } from "./customer-auth.js";
import { cleanText, publicBaseUrl } from "./shared.js";

export async function runProjectActivation({ projectId, sessionId, req }) {
  if (cleanText(sessionId)) {
    const confirmation = await confirmLaunchCheckoutSession(projectId, sessionId);
    if (!confirmation.paid) {
      return { ok: false, reason: "payment_pending", confirmation };
    }
  } else {
    const existing = await getOpportunityProject(projectId);
    if (!existing?.billing?.launchPaid && !existing?.flags?.launchPaid) {
      return { ok: false, reason: "payment_required" };
    }
  }

  const project = await activateOpportunityProject(projectId);
  await recordFunnelEvent({
    projectId,
    event: "activation_completed",
  }).catch(() => {});

  const base = publicBaseUrl(req);
  const dashboardUrl = customerDashboardUrl(base, project.id, project.customerAccessToken);

  return {
    ok: true,
    project,
    dashboardUrl,
  };
}
