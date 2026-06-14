import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createInboundReply } from "../../reply-inbox.js";
import { listOutreachQueueRecords } from "../../outreach-queue.js";

const TWILIO_MESSAGES_URL_VERSION = "2010-04-01";

function cleanText(value) {
  return String(value ?? "").trim();
}

function envValue(key) {
  return cleanText(process.env[key]);
}

function realSmsSendAllowed() {
  return envValue("ALLOW_REAL_SMS_SEND").toLowerCase() === "true";
}

function normalizePhoneForMatch(value) {
  return cleanText(value).replace(/[^\d+]/g, "");
}

function basicAuthHeader(accountSid, authToken) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

function safeEqualText(left, right) {
  const leftBuffer = Buffer.from(cleanText(left));
  const rightBuffer = Buffer.from(cleanText(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function twilioCredentials() {
  return {
    accountSid: envValue("TWILIO_ACCOUNT_SID"),
    authToken: envValue("TWILIO_AUTH_TOKEN"),
    messagingServiceSid: envValue("TWILIO_MESSAGING_SERVICE_SID"),
    fromNumber: envValue("TWILIO_FROM_NUMBER"),
  };
}

export function getTwilioProviderStatus() {
  const credentials = twilioCredentials();
  return {
    configured: Boolean(
      credentials.accountSid &&
      credentials.authToken &&
      (credentials.messagingServiceSid || credentials.fromNumber)
    ),
    messagingServiceConfigured: Boolean(credentials.messagingServiceSid),
    phoneNumberConfigured: Boolean(credentials.fromNumber),
  };
}

export function verifyTwilioWebhookSignature({ url = "", params = {}, signature = "" } = {}) {
  const { authToken } = twilioCredentials();
  if (!authToken) {
    return { verified: false, skipped: true, reason: "TWILIO_AUTH_TOKEN is not configured." };
  }
  const cleanSignature = cleanText(signature);
  if (!cleanSignature) return { verified: false, skipped: false, reason: "Missing X-Twilio-Signature header." };

  const data = Object.keys(params ?? {})
    .sort()
    .reduce((acc, key) => `${acc}${key}${cleanText(params[key])}`, cleanText(url));
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  return {
    verified: safeEqualText(expected, cleanSignature),
    skipped: false,
    reason: safeEqualText(expected, cleanSignature) ? "Twilio signature verified." : "Invalid Twilio signature.",
  };
}

function assertSendInput({ to, body }) {
  if (!cleanText(to)) throw new Error("SMS recipient is required.");
  if (!cleanText(body)) throw new Error("SMS body is required.");
}

export async function sendTwilioSms({ to, body, metadata = {} } = {}) {
  assertSendInput({ to, body });
  const credentials = twilioCredentials();
  const status = getTwilioProviderStatus();
  const simulated = !realSmsSendAllowed();

  if (simulated) {
    return {
      provider: "twilio",
      simulated: true,
      sent: false,
      providerMessageId: `simulated_twilio_${randomUUID()}`,
      to: cleanText(to),
      message: "ALLOW_REAL_SMS_SEND is not true; SMS send was simulated only.",
      metadata,
    };
  }

  if (!status.configured) {
    throw new Error("Twilio is not configured for real SMS sending.");
  }

  const form = new URLSearchParams();
  form.set("To", cleanText(to));
  form.set("Body", cleanText(body));
  if (credentials.messagingServiceSid) {
    form.set("MessagingServiceSid", credentials.messagingServiceSid);
  } else {
    form.set("From", credentials.fromNumber);
  }

  const response = await fetch(
    `https://api.twilio.com/${TWILIO_MESSAGES_URL_VERSION}/Accounts/${encodeURIComponent(credentials.accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(credentials.accountSid, credentials.authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = cleanText(payload.message) || `Twilio send failed with HTTP ${response.status}.`;
    const code = cleanText(payload.code);
    throw new Error(code ? `${message} Twilio code: ${code}.` : message);
  }

  return {
    provider: "twilio",
    simulated: false,
    sent: true,
    providerMessageId: cleanText(payload.sid),
    status: cleanText(payload.status),
    to: cleanText(payload.to) || cleanText(to),
    from: cleanText(payload.from),
    messagingServiceSid: cleanText(payload.messaging_service_sid),
    metadata,
  };
}

function twilioWebhookValue(payload, key) {
  return cleanText(payload?.[key]);
}

function normalizeInboundSmsPayload(payload = {}) {
  const providerMessageId = twilioWebhookValue(payload, "MessageSid") || twilioWebhookValue(payload, "SmsMessageSid");
  return {
    providerMessageId,
    from: twilioWebhookValue(payload, "From"),
    to: twilioWebhookValue(payload, "To"),
    body: twilioWebhookValue(payload, "Body"),
    accountSid: twilioWebhookValue(payload, "AccountSid"),
    messagingServiceSid: twilioWebhookValue(payload, "MessagingServiceSid"),
    rawStatus: twilioWebhookValue(payload, "SmsStatus"),
    numMedia: twilioWebhookValue(payload, "NumMedia"),
  };
}

async function findMatchingOutreachForInboundSms({ from, to }) {
  const fromMatch = normalizePhoneForMatch(from);
  const toMatch = normalizePhoneForMatch(to);
  if (!fromMatch) return null;

  const records = await listOutreachQueueRecords();
  return records
    .filter((record) => record.sendStatus === "sent")
    .filter((record) => normalizePhoneForMatch(record.to) === fromMatch)
    .filter((record) => !toMatch || !record.from || normalizePhoneForMatch(record.from) === toMatch)
    .sort((a, b) => String(b.sentAt || b.updatedAt || b.createdAt).localeCompare(String(a.sentAt || a.updatedAt || a.createdAt)))[0] ?? null;
}

export async function recordTwilioInboundSms(payload = {}) {
  const inbound = normalizeInboundSmsPayload(payload);
  if (!inbound.providerMessageId) throw new Error("Twilio inbound SMS is missing MessageSid.");
  if (!inbound.body) throw new Error("Twilio inbound SMS is missing Body.");

  const outreach = await findMatchingOutreachForInboundSms(inbound);
  const result = await createInboundReply({
    websiteId: outreach?.websiteId || "",
    leadId: outreach?.leadId || "",
    outreachId: outreach?.outreachId || "",
    provider: "twilio",
    providerMessageId: inbound.providerMessageId,
    from: inbound.from,
    channel: "sms",
    replyText: inbound.body,
    metadata: {
      source: "twilio_sms_webhook",
      to: inbound.to,
      accountSidPresent: Boolean(inbound.accountSid),
      messagingServiceSidPresent: Boolean(inbound.messagingServiceSid),
      smsStatus: inbound.rawStatus,
      numMedia: inbound.numMedia,
      matchedOutreach: Boolean(outreach?.outreachId),
    },
  });

  return {
    ...result,
    matched: Boolean(outreach?.outreachId),
    websiteId: outreach?.websiteId || "",
    outreachId: outreach?.outreachId || "",
  };
}
