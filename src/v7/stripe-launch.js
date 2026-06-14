import Stripe from "stripe";
import { cleanText } from "./shared.js";
import { getOpportunityProject, saveOpportunityProject } from "./opportunity-project-store.js";
import { markProjectLaunchPaid } from "./opportunity-project.js";
import { recordFunnelEvent } from "./funnel-events.js";

function stripeSecretKey() {
  return cleanText(process.env.STRIPE_SECRET_KEY);
}

function stripeLaunchPrice() {
  return cleanText(process.env.STRIPE_PRICE_LAUNCH_1000);
}

function stripeClient() {
  const key = stripeSecretKey();
  if (!key) throw new Error("Stripe secret key is not configured.");
  return new Stripe(key);
}

export function getLaunchStripeStatus() {
  const missing = [
    stripeSecretKey() ? null : "STRIPE_SECRET_KEY",
    stripeLaunchPrice() ? null : "STRIPE_PRICE_LAUNCH_1000",
  ].filter(Boolean);
  return {
    configured: missing.length === 0,
    missing,
  };
}

function requireLaunchStripe() {
  const status = getLaunchStripeStatus();
  if (!status.configured) {
    throw new Error(`Launch checkout is not configured. Missing: ${status.missing.join(", ")}.`);
  }
}

export async function createLaunchCheckoutSession({ project, origin, email = "" }) {
  requireLaunchStripe();
  if (!project?.id) throw new Error("Project is required.");

  const base = cleanText(origin).replace(/\/$/, "");
  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: stripeLaunchPrice(), quantity: 1 }],
    customer_email: cleanText(email) || undefined,
    client_reference_id: project.id,
    success_url: `${base}/activate/${encodeURIComponent(project.id)}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/launch/${encodeURIComponent(project.id)}?cancelled=1`,
    metadata: {
      projectId: project.id,
      product: "launch_1000",
    },
  });

  await saveOpportunityProject({
    ...project,
    billing: {
      ...project.billing,
      stripeCheckoutSessionId: session.id,
    },
  });

  return { id: session.id, url: session.url };
}

export async function confirmLaunchCheckoutSession(projectId, sessionId) {
  requireLaunchStripe();
  const session = await stripeClient().checkout.sessions.retrieve(cleanText(sessionId));
  const metaProjectId = cleanText(session.metadata?.projectId);
  if (metaProjectId && metaProjectId !== projectId) {
    throw new Error("Checkout session does not match this project.");
  }
  if (session.payment_status !== "paid") {
    return { paid: false, session };
  }

  const project = await markProjectLaunchPaid(projectId, {
    email: session.customer_details?.email,
    stripeCustomerId: cleanText(session.customer),
    stripeCheckoutSessionId: session.id,
  });

  if (project) {
    await recordFunnelEvent({
      projectId,
      event: "launch_purchased",
      meta: { sessionId: session.id },
    }).catch(() => {});
  }

  return { paid: true, session, project };
}

export async function handleLaunchCheckoutWebhook(session) {
  const projectId = cleanText(session.metadata?.projectId);
  if (!projectId || cleanText(session.metadata?.product) !== "launch_1000") {
    return null;
  }
  if (session.payment_status !== "paid") return null;

  const existing = await getOpportunityProject(projectId);
  if (existing?.billing?.launchPaid) {
    return existing;
  }

  return markProjectLaunchPaid(projectId, {
    email: session.customer_details?.email,
    stripeCustomerId: cleanText(session.customer),
    stripeCheckoutSessionId: session.id,
  });
}
