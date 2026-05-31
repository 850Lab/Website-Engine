import { createHmac, timingSafeEqual } from "node:crypto";
import {
  markClientCheckoutStarted,
  updateClientBillingFromStripe,
} from "./client-operations.js";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

function cleanText(value) {
  return String(value ?? "").trim();
}

function stripeSecretKey() {
  return cleanText(process.env.STRIPE_SECRET_KEY);
}

function stripeWebhookSecret() {
  return cleanText(process.env.STRIPE_WEBHOOK_SECRET);
}

function stripeMaintenancePrice() {
  return cleanText(process.env.STRIPE_PRICE_MAINTENANCE_50);
}

export function getStripeBillingStatus() {
  const checkoutMissing = [
    stripeSecretKey() ? null : "STRIPE_SECRET_KEY",
    stripeMaintenancePrice() ? null : "STRIPE_PRICE_MAINTENANCE_50",
  ].filter(Boolean);
  const webhookMissing = stripeWebhookSecret() ? [] : ["STRIPE_WEBHOOK_SECRET"];
  return {
    configured: checkoutMissing.length === 0,
    webhookConfigured: webhookMissing.length === 0,
    checkoutMissing,
    webhookMissing,
    missing: [...checkoutMissing, ...webhookMissing],
  };
}

function requireStripeConfigured() {
  const status = getStripeBillingStatus();
  if (!status.configured) {
    throw new Error(`Stripe checkout is not configured. Missing: ${status.checkoutMissing.join(", ")}.`);
  }
}

function toPeriodEnd(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

function subscriptionStatusToBillingStatus(status) {
  if (["active", "trialing"].includes(status)) return "active";
  if (["past_due", "unpaid"].includes(status)) return "past_due";
  if (["canceled", "incomplete_expired"].includes(status)) return "canceled";
  return "checkout_started";
}

function metadataClientId(object = {}) {
  return cleanText(
    object.metadata?.clientId ||
    object.subscription_details?.metadata?.clientId ||
    object.client_reference_id
  );
}

async function stripePost(path, params) {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Stripe request failed: ${response.status}`);
  }
  return payload;
}

export async function createMaintenanceCheckoutSession({ client, origin }) {
  const setup = getStripeBillingStatus();
  // #region agent log
  fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H3',location:'src/stripe-billing.js:84',message:'checkout prerequisites',data:{configured:setup.configured,checkoutMissing:setup.checkoutMissing,clientId:client?.clientId ?? "",hasEmail:Boolean(client?.email),hasExistingCustomer:Boolean(client?.stripeCustomerId),origin},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  requireStripeConfigured();
  if (!client?.clientId) throw new Error("Client is required for checkout.");
  if (!client.email) throw new Error("Client email is required before starting Stripe checkout.");

  const session = await stripePost("/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": stripeMaintenancePrice(),
    "line_items[0][quantity]": "1",
    customer_email: client.email,
    client_reference_id: client.clientId,
    success_url: `${origin}/operations?billing=success&client=${encodeURIComponent(client.clientId)}`,
    cancel_url: `${origin}/operations?billing=cancelled&client=${encodeURIComponent(client.clientId)}`,
    "metadata[clientId]": client.clientId,
    "subscription_data[metadata][clientId]": client.clientId,
  });
  // #region agent log
  fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H3',location:'src/stripe-billing.js:104',message:'checkout session created',data:{clientId:client.clientId,hasSessionId:Boolean(session.id),hasUrl:Boolean(session.url),hasCustomer:Boolean(session.customer)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  await markClientCheckoutStarted(client.clientId, {
    stripeCustomerId: cleanText(session.customer),
    lastPaymentStatus: "checkout_session_created",
  });

  return {
    id: session.id,
    url: session.url,
    customer: session.customer,
  };
}

function safeCompare(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyStripeWebhookPayload(rawBody, signatureHeader) {
  const secret = stripeWebhookSecret();
  if (!secret) throw new Error("Stripe webhook secret is not configured.");
  const parts = Object.fromEntries(
    String(signatureHeader ?? "")
      .split(",")
      .map((part) => part.split("=", 2))
      .filter(([key, value]) => key && value)
  );
  if (!parts.t || !parts.v1) throw new Error("Stripe signature header is invalid.");
  const signedPayload = `${parts.t}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  if (!safeCompare(expected, parts.v1)) throw new Error("Stripe webhook signature verification failed.");
  return JSON.parse(rawBody);
}

async function applySubscription(subscription, extraPatch = {}) {
  return updateClientBillingFromStripe({
    clientId: metadataClientId(subscription),
    customerId: cleanText(subscription.customer),
    subscriptionId: cleanText(subscription.id),
    patch: {
      stripeCustomerId: cleanText(subscription.customer),
      stripeSubscriptionId: cleanText(subscription.id),
      billingStatus: subscriptionStatusToBillingStatus(subscription.status),
      currentPeriodEnd: toPeriodEnd(subscription.current_period_end),
      cancellationStatus:
        subscription.status === "canceled"
          ? "canceled"
          : subscription.cancel_at_period_end
            ? "cancel_at_period_end"
            : "none",
      cancellationReason: cleanText(subscription.cancellation_details?.reason),
      ...extraPatch,
    },
  });
}

export async function handleStripeWebhookEvent(event) {
  const object = event?.data?.object ?? {};
  // #region agent log
  fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H5',location:'src/stripe-billing.js:166',message:'stripe webhook matching inputs',data:{eventType:event?.type ?? "",clientId:metadataClientId(object),hasCustomer:Boolean(object.customer),hasSubscription:Boolean(object.subscription || object.id),objectStatus:object.status ?? "",paymentStatus:object.payment_status ?? ""},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  switch (event?.type) {
    case "checkout.session.completed":
      return updateClientBillingFromStripe({
        clientId: metadataClientId(object),
        customerId: cleanText(object.customer),
        subscriptionId: cleanText(object.subscription),
        patch: {
          stripeCustomerId: cleanText(object.customer),
          stripeSubscriptionId: cleanText(object.subscription),
          billingStatus: object.payment_status === "paid" ? "active" : "checkout_started",
          lastPaymentStatus: cleanText(object.payment_status)
            ? `checkout_completed_${cleanText(object.payment_status)}`
            : "checkout_completed",
        },
      });
    case "customer.subscription.created":
    case "customer.subscription.updated":
      return applySubscription(object);
    case "customer.subscription.deleted":
      return applySubscription(object, {
        billingStatus: "canceled",
        cancellationStatus: "canceled",
      });
    case "invoice.payment_succeeded":
      return updateClientBillingFromStripe({
        clientId: metadataClientId(object),
        customerId: cleanText(object.customer),
        subscriptionId: cleanText(object.subscription),
        patch: {
          billingStatus: "active",
          lastPaymentStatus: "succeeded",
          failedPaymentCount: 0,
        },
      });
    case "invoice.payment_failed":
      return updateClientBillingFromStripe({
        clientId: metadataClientId(object),
        customerId: cleanText(object.customer),
        subscriptionId: cleanText(object.subscription),
        patch: {
          billingStatus: "past_due",
          lastPaymentStatus: "failed",
          failedPaymentCount: Math.max(1, Number(object.attempt_count) || 1),
        },
      });
    default:
      return null;
  }
}
