import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Stripe from "stripe";
import { DATA_DIR, writeJsonFileSafe } from "./storage.js";
import { handleLaunchCheckoutWebhook } from "./v7/stripe-launch.js";

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

function stripeClient() {
  const secretKey = stripeSecretKey();
  if (!secretKey) throw new Error("Stripe secret key is not configured.");
  return new Stripe(secretKey);
}

export function getStripeBillingStatus() {
  const webhookMissing = stripeWebhookSecret() ? [] : ["STRIPE_WEBHOOK_SECRET"];
  return {
    configured: Boolean(stripeSecretKey()),
    webhookConfigured: webhookMissing.length === 0,
    checkoutMissing: stripeSecretKey() ? [] : ["STRIPE_SECRET_KEY"],
    webhookMissing,
    missing: [...(stripeSecretKey() ? [] : ["STRIPE_SECRET_KEY"]), ...webhookMissing],
  };
}

function eventLog(message, data = {}) {
  console.info(`[stripe-billing] ${message}`, data);
}

async function readStripeEventsState() {
  try {
    const parsed = JSON.parse(await readFile(STRIPE_EVENTS_FILE, "utf8"));
    return {
      version: 1,
      processedEvents:
        parsed?.processedEvents && typeof parsed.processedEvents === "object"
          ? parsed.processedEvents
          : {},
    };
  } catch (err) {
    if (err.code === "ENOENT") return { version: 1, processedEvents: {} };
    throw err;
  }
}

async function checkStripeEvent(event) {
  const eventId = cleanText(event?.id);
  if (!eventId) return { duplicate: false, eventId: "", recorded: false };
  const state = await readStripeEventsState();
  if (state.processedEvents[eventId]) {
    return { duplicate: true, eventId, recorded: true };
  }
  return { duplicate: false, eventId, recorded: false };
}

async function rememberStripeEvent(event, result = {}) {
  const eventId = cleanText(event?.id);
  if (!eventId) return { duplicate: false, eventId: "", recorded: false };
  const state = await readStripeEventsState();
  state.processedEvents[eventId] = {
    stripeEventId: eventId,
    type: cleanText(event?.type),
    livemode: Boolean(event?.livemode),
    matchedLaunchProject: Boolean(result.matchedLaunchProject),
    processedAt: new Date().toISOString(),
  };
  await writeJsonFileSafe(STRIPE_EVENTS_FILE, state);
  return { duplicate: false, eventId, recorded: true };
}

export function verifyStripeWebhookPayload(rawBody, signatureHeader) {
  const secret = stripeWebhookSecret();
  if (!secret) throw new Error("Stripe webhook secret is not configured.");
  return stripeClient().webhooks.constructEvent(rawBody, signatureHeader, secret);
}

export async function handleStripeWebhookEvent(event) {
  const object = event?.data?.object ?? {};
  const eventId = cleanText(event?.id);
  const eventType = cleanText(event?.type);
  const idempotency = await checkStripeEvent(event);
  if (idempotency.duplicate) {
    eventLog("duplicate webhook ignored", { eventId, eventType });
    return { duplicate: true, eventId, eventType };
  }

  let matchedLaunchProject = false;
  if (eventType === "checkout.session.completed") {
    const launchProject = await handleLaunchCheckoutWebhook(object);
    matchedLaunchProject = Boolean(launchProject);
  }

  eventLog("webhook processed", { eventId, eventType, matchedLaunchProject });
  await rememberStripeEvent(event, { matchedLaunchProject });
  return { duplicate: false, eventId, eventType, matchedLaunchProject };
}
