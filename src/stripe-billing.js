import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Stripe from "stripe";
import {
  markClientCheckoutStarted,
  updateClientBillingFromStripe,
} from "./client-operations.js";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";

const STRIPE_EVENTS_FILE = join(DATA_DIR, "stripe-events.json");

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

function stripeActivationPrice() {
  return cleanText(process.env.STRIPE_PRICE_ACTIVATION);
}

function stripeClient() {
  const secretKey = stripeSecretKey();
  if (!secretKey) throw new Error("Stripe secret key is not configured.");
  return new Stripe(secretKey);
}

export function getStripeBillingStatus() {
  const checkoutMissing = [
    stripeSecretKey() ? null : "STRIPE_SECRET_KEY",
    stripeActivationPrice() ? null : "STRIPE_PRICE_ACTIVATION",
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

function invoiceMetadataClientId(invoice = {}) {
  return cleanText(
    invoice.metadata?.clientId ||
    invoice.parent?.subscription_details?.metadata?.clientId ||
    invoice.subscription_details?.metadata?.clientId
  );
}

function invoiceSubscriptionId(invoice = {}) {
  return cleanText(invoice.subscription || invoice.parent?.subscription_details?.subscription);
}

function invoiceConfirmsActivation(invoice = {}) {
  if (invoice.billing_reason === "subscription_create") return true;
  const lines = Array.isArray(invoice.lines?.data) ? invoice.lines.data : [];
  return lines.some((line) => cleanText(line.price?.id) === stripeActivationPrice());
}

function eventLog(message, data = {}) {
  console.info(`[stripe-billing] ${message}`, data);
}

function defaultStripeEventsState() {
  return {
    version: 1,
    processedEvents: {},
  };
}

async function readStripeEventsState() {
  try {
    const parsed = JSON.parse(await readFile(STRIPE_EVENTS_FILE, "utf8"));
    return {
      version: 1,
      processedEvents: parsed?.processedEvents && typeof parsed.processedEvents === "object"
        ? parsed.processedEvents
        : {},
    };
  } catch (err) {
    if (err.code === "ENOENT") return defaultStripeEventsState();
    throw err;
  }
}

async function checkStripeEvent(event) {
  const eventId = cleanText(event?.id);
  if (!eventId) {
    return { duplicate: false, eventId: "", recorded: false };
  }
  const state = await readStripeEventsState();
  if (state.processedEvents[eventId]) {
    return {
      duplicate: true,
      eventId,
      recorded: true,
      processedAt: state.processedEvents[eventId].processedAt,
    };
  }
  return { duplicate: false, eventId, recorded: false };
}

async function rememberStripeEvent(event, result = {}) {
  const eventId = cleanText(event?.id);
  if (!eventId) {
    return { duplicate: false, eventId: "", recorded: false };
  }
  const state = await readStripeEventsState();
  if (state.processedEvents[eventId]) {
    return {
      duplicate: true,
      eventId,
      recorded: true,
      processedAt: state.processedEvents[eventId].processedAt,
    };
  }
  state.processedEvents[eventId] = {
    stripeEventId: eventId,
    type: cleanText(event?.type),
    livemode: Boolean(event?.livemode),
    matchedClient: Boolean(result.client),
    billingStatus: result.client?.billingStatus ?? null,
    processedAt: new Date().toISOString(),
  };
  await writeJsonFileSafe(STRIPE_EVENTS_FILE, state);
  return { duplicate: false, eventId, recorded: true };
}

export async function createMaintenanceCheckoutSession({ client, origin }) {
  const setup = getStripeBillingStatus();
  // #region agent log
  fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H3',location:'src/stripe-billing.js:84',message:'checkout prerequisites',data:{configured:setup.configured,checkoutMissing:setup.checkoutMissing,clientId:client?.clientId ?? "",hasEmail:Boolean(client?.email),hasExistingCustomer:Boolean(client?.stripeCustomerId),origin},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  requireStripeConfigured();
  if (!client?.clientId) throw new Error("Client is required for checkout.");
  if (!client.email) throw new Error("Client email is required before starting Stripe checkout.");

  const session = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: stripeActivationPrice(),
        quantity: 1,
      },
      {
        price: stripeMaintenancePrice(),
        quantity: 1,
      },
    ],
    customer_email: client.email,
    client_reference_id: client.clientId,
    success_url: `${origin}/operations?billing=success&client=${encodeURIComponent(client.clientId)}`,
    cancel_url: `${origin}/operations?billing=cancelled&client=${encodeURIComponent(client.clientId)}`,
    metadata: {
      clientId: client.clientId,
      activationPrice: stripeActivationPrice(),
      maintenancePrice: stripeMaintenancePrice(),
    },
    subscription_data: {
      metadata: {
        clientId: client.clientId,
      },
    },
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

export function verifyStripeWebhookPayload(rawBody, signatureHeader) {
  const secret = stripeWebhookSecret();
  if (!secret) throw new Error("Stripe webhook secret is not configured.");
  return stripeClient().webhooks.constructEvent(rawBody, signatureHeader, secret);
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
  const eventId = cleanText(event?.id);
  const eventType = cleanText(event?.type);
  const idempotency = await checkStripeEvent(event);
  if (idempotency.duplicate) {
    eventLog("duplicate webhook ignored", {
      eventId,
      eventType,
      duplicateIgnored: true,
    });
    return {
      duplicate: true,
      eventId,
      eventType,
      client: null,
      billingStatus: null,
    };
  }
  // #region agent log
  fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H5',location:'src/stripe-billing.js:166',message:'stripe webhook matching inputs',data:{eventType:event?.type ?? "",clientId:metadataClientId(object),hasCustomer:Boolean(object.customer),hasSubscription:Boolean(object.subscription || object.id),objectStatus:object.status ?? "",paymentStatus:object.payment_status ?? ""},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  let client = null;
  switch (event?.type) {
    case "checkout.session.completed":
      client = await updateClientBillingFromStripe({
        clientId: metadataClientId(object),
        customerId: cleanText(object.customer),
        subscriptionId: cleanText(object.subscription),
        patch: {
          activationPaid: object.payment_status === "paid",
          activationPaidAt: object.payment_status === "paid" ? new Date().toISOString() : null,
          stripeCustomerId: cleanText(object.customer),
          stripeSubscriptionId: cleanText(object.subscription),
          lastPaymentStatus: cleanText(object.payment_status)
            ? `checkout_completed_${cleanText(object.payment_status)}`
            : "checkout_completed",
        },
      });
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      client = await applySubscription(object);
      break;
    case "customer.subscription.deleted":
      client = await applySubscription(object, {
        billingStatus: "canceled",
        cancellationStatus: "canceled",
      });
      break;
    case "invoice.payment_succeeded":
      {
        const activationConfirmed = invoiceConfirmsActivation(object);
      client = await updateClientBillingFromStripe({
        clientId: invoiceMetadataClientId(object),
        customerId: cleanText(object.customer),
        subscriptionId: invoiceSubscriptionId(object),
        patch: {
          ...(activationConfirmed
            ? {
                activationPaid: true,
                activationPaidAt: new Date().toISOString(),
              }
            : {}),
          lastPaymentStatus: "succeeded",
          failedPaymentCount: 0,
        },
      });
      }
      break;
    case "invoice.payment_failed":
      client = await updateClientBillingFromStripe({
        clientId: invoiceMetadataClientId(object),
        customerId: cleanText(object.customer),
        subscriptionId: invoiceSubscriptionId(object),
        patch: {
          billingStatus: "past_due",
          lastPaymentStatus: "failed",
          failedPaymentCount: Math.max(1, Number(object.attempt_count) || 1),
        },
      });
      break;
    default:
      client = null;
  }
  eventLog("webhook processed", {
    eventId,
    eventType,
    duplicateIgnored: false,
    matchedClient: Boolean(client),
    billingStatus: client?.billingStatus ?? null,
  });
  await rememberStripeEvent(event, { client });
  return {
    duplicate: false,
    eventId,
    eventType,
    client,
    billingStatus: client?.billingStatus ?? null,
  };
}
