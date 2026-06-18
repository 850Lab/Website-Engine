import twilio from "twilio";
import express from "express";
import { cleanText, normalizePhoneNumber } from "../stage1/shared.js";
import { getQualifiedBusiness } from "../stage1/qualified-business-store.js";
import {
  assertTwilioVoiceConfigured,
  buildTwilioVoiceStatus,
  getTwilioVoiceConfig,
  resolvePublicBaseUrl,
  updateTwilioVoiceSettings,
} from "./config.js";
import {
  appendCallSessionEvent,
  createCallSession,
  getCallSession,
  getCallSessionByCallSid,
  updateCallSession,
} from "./call-session-store.js";
import {
  buildSalesCallRecord,
  saveRecordingToBusiness,
  upsertSalesCallOnBusiness,
} from "./sales-calls.js";
import {
  assignLeadToOperator,
  canOperatorAccessLead,
} from "../operators/lead-assignment.js";
import {
  ensureTwilioTestBusiness,
  isTwilioTestBusiness,
} from "./test-lead.js";

const VoiceResponse = twilio.twiml.VoiceResponse;

function logTwilioVoiceError(scope, err) {
  console.error(`[twilio-voice] ${scope}:`, err?.message || err);
}

function twilioFormBody(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

function sessionIdFromRequest(req) {
  return cleanText(req.query?.sessionId || twilioFormBody(req).sessionId);
}

async function validateTwilioWebhook(req) {
  const config = await getTwilioVoiceConfig(req);
  if (!config.authToken) return false;

  const signature = req.get("x-twilio-signature");
  if (!signature) return false;

  try {
    const url = `${resolvePublicBaseUrl(req)}${req.originalUrl}`;
    return twilio.validateRequest(
      config.authToken,
      signature,
      url,
      twilioFormBody(req),
    );
  } catch {
    return false;
  }
}

async function rejectInvalidTwilioWebhook(req, res) {
  if (await validateTwilioWebhook(req)) return false;
  res.status(403).type("text/plain").send("Forbidden");
  return true;
}

function prospectPhoneForBusiness(business) {
  const phone = cleanText(business?.normalizedPhone) || cleanText(business?.phone);
  return normalizePhoneNumber(phone);
}

function prospectPhoneForSession(session, business) {
  return (
    prospectPhoneForBusiness(business) ||
    normalizePhoneNumber(session?.prospectPhone)
  );
}

async function persistCallProgress(session, callSid, status = "in-progress") {
  if (!session?.id || !callSid) return;

  try {
    await updateCallSession(session.id, { twilioCallSid: callSid });
  } catch (err) {
    logTwilioVoiceError("updateCallSession", err);
  }

  try {
    await upsertSalesCallOnBusiness(
      session.businessId,
      buildSalesCallRecord({
        id: session.id,
        twilioCallSid: callSid,
        startedAt: session.startedAt,
        status,
      }),
    );
  } catch (err) {
    logTwilioVoiceError("upsertSalesCallOnBusiness", err);
  }
}

function webhookPath(req, path, sessionId) {
  const base = resolvePublicBaseUrl(req);
  const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  return `${base}${path}${qs}`;
}

export function registerTwilioVoiceWebhookRoutes(app, formParser) {
  const parseForm = formParser ?? express.urlencoded({ extended: false });

  app.post(
    "/api/twilio/voice/connect",
    parseForm,
    async (req, res) => {
      try {
        if (await rejectInvalidTwilioWebhook(req, res)) return;

        const sessionId = sessionIdFromRequest(req);
        const session = sessionId ? await getCallSession(sessionId) : null;
        if (!session) {
          const response = new VoiceResponse();
          response.say("Sorry, this call session is no longer available.");
          response.hangup();
          return res.type("text/xml").send(response.toString());
        }

        const business = await getQualifiedBusiness(session.businessId);
        const prospectPhone = prospectPhoneForSession(session, business);
        if (!prospectPhone) {
          await updateCallSession(session.id, {
            status: "failed",
            error: "Prospect phone missing",
            completedAt: new Date().toISOString(),
          });
          const response = new VoiceResponse();
          response.say("Sorry, the prospect phone number is missing.");
          response.hangup();
          return res.type("text/xml").send(response.toString());
        }

        const callSid = cleanText(twilioFormBody(req).CallSid);
        const businessName = cleanText(session.businessName) || "the prospect";
        const recordingCallback = webhookPath(
          req,
          "/api/twilio/voice/recording",
          session.id,
        );
        const statusCallback = webhookPath(req, "/api/twilio/voice/status", session.id);

        const response = new VoiceResponse();
        response.say(
          { voice: "Polly.Joanna" },
          `Connecting you to ${businessName}. This call may be recorded for quality and follow-up.`,
        );
        const dial = response.dial({
          record: "record-from-answer",
          recordingStatusCallback: recordingCallback,
          recordingStatusCallbackMethod: "POST",
          recordingStatusCallbackEvent: "completed",
          action: statusCallback,
          method: "POST",
        });
        dial.number(prospectPhone);

        // Return TwiML immediately so Twilio doesn't timeout while we persist call state.
        res.type("text/xml").send(response.toString());
        if (callSid) {
          await persistCallProgress(session, callSid);
        }
        if (isTwilioTestBusiness(session.businessId)) {
          ensureTwilioTestBusiness().catch((err) =>
            logTwilioVoiceError("ensureTwilioTestBusiness", err),
          );
        }
        return;
      } catch (err) {
        logTwilioVoiceError("connect", err);
        const response = new VoiceResponse();
        response.say("Sorry, an error occurred while connecting your call.");
        response.hangup();
        return res.type("text/xml").send(response.toString());
      }
    },
  );

  app.post("/api/twilio/voice/recording", parseForm, async (req, res) => {
    try {
      if (await rejectInvalidTwilioWebhook(req, res)) return;

      const body = twilioFormBody(req);
      const sessionId = sessionIdFromRequest(req);
      const callSid = cleanText(body.CallSid);
      const session =
        (sessionId ? await getCallSession(sessionId) : null) ||
        (callSid ? await getCallSessionByCallSid(callSid) : null);

      if (!session) {
        return res.type("text/plain").send("OK");
      }

      const recordingStatus = cleanText(body.RecordingStatus).toLowerCase();
      const recordingSid = cleanText(body.RecordingSid);
      const recordingUrl = cleanText(body.RecordingUrl);
      const durationSec = Number(body.RecordingDuration) || null;

      await appendCallSessionEvent(session.id, "recording", {
        recordingStatus,
        recordingSid,
        recordingUrl,
        durationSec,
      });

      if (recordingStatus === "completed" && recordingSid) {
        try {
          await saveRecordingToBusiness({
            businessId: session.businessId,
            callId: session.id,
            twilioCallSid: callSid || session.twilioCallSid,
            twilioRecordingSid: recordingSid,
            recordingUrl,
            durationSec,
            startedAt: session.startedAt,
          });
          await updateCallSession(session.id, {
            status: "completed",
            completedAt: new Date().toISOString(),
          });
        } catch (err) {
          logTwilioVoiceError("recording-save", err);
        }
      }

      return res.type("text/plain").send("OK");
    } catch (err) {
      logTwilioVoiceError("recording", err);
      return res.status(500).type("text/plain").send("Error");
    }
  });

  app.post("/api/twilio/voice/status", parseForm, async (req, res) => {
    try {
      if (await rejectInvalidTwilioWebhook(req, res)) return;

      const body = twilioFormBody(req);
      const sessionId = sessionIdFromRequest(req);
      const callSid = cleanText(body.CallSid);
      const callStatus = cleanText(body.CallStatus).toLowerCase() || "unknown";

      const session =
        (sessionId ? await getCallSession(sessionId) : null) ||
        (callSid ? await getCallSessionByCallSid(callSid) : null);

      if (session) {
        await appendCallSessionEvent(session.id, callStatus, {
          callSid,
          dialCallStatus: cleanText(body.DialCallStatus),
        });

        const terminal = new Set([
          "completed",
          "failed",
          "busy",
          "no-answer",
          "canceled",
        ]);
        if (terminal.has(callStatus)) {
          try {
            await updateCallSession(session.id, {
              status: callStatus,
              completedAt: new Date().toISOString(),
              error: callStatus === "failed" ? cleanText(body.ErrorMessage) || callStatus : null,
            });
            await upsertSalesCallOnBusiness(
              session.businessId,
              buildSalesCallRecord({
                id: session.id,
                twilioCallSid: callSid || session.twilioCallSid,
                startedAt: session.startedAt,
                completedAt: new Date().toISOString(),
                status: callStatus,
                error: callStatus === "failed" ? cleanText(body.ErrorMessage) || callStatus : null,
              }),
            );
          } catch (err) {
            logTwilioVoiceError("status-terminal", err);
          }
        } else if (callStatus === "answered" || callStatus === "in-progress") {
          await updateCallSession(session.id, { status: callStatus });
        } else if (callStatus === "ringing" || callStatus === "initiated") {
          await updateCallSession(session.id, { status: callStatus });
        }
      }

      return res.type("text/plain").send("OK");
    } catch (err) {
      logTwilioVoiceError("status", err);
      return res.status(500).type("text/plain").send("Error");
    }
  });
}

export function registerTwilioCallRoutes(app, { requireOperatorApi, requireOwnerApi } = {}) {
  const auth = requireOperatorApi ?? ((_req, _res, next) => next());
  const ownerAuth = requireOwnerApi ?? auth;

  app.get("/api/twilio/voice/settings", ownerAuth, async (req, res) => {
    try {
      return res.json(await buildTwilioVoiceStatus(req));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/twilio/voice/settings", ownerAuth, async (req, res) => {
    try {
      return res.json(await updateTwilioVoiceSettings(req.body ?? {}));
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/calls/start", auth, async (req, res) => {
    try {
      const businessId = cleanText(req.body?.businessId);
      if (!businessId) {
        return res.status(400).json({ error: "businessId is required" });
      }

      const config = await assertTwilioVoiceConfigured(req);
      if (isTwilioTestBusiness(businessId)) {
        await ensureTwilioTestBusiness();
      }
      const business = await getQualifiedBusiness(businessId);
      if (!business) {
        return res.status(404).json({ error: "Business not found" });
      }

      if (req.operator && !canOperatorAccessLead(business, req.operator)) {
        return res.status(403).json({ error: "Lead is assigned to another operator." });
      }

      if (req.operator) {
        await assignLeadToOperator(businessId, req.operator);
      }

      const prospectPhone = prospectPhoneForBusiness(business);
      if (!prospectPhone) {
        return res.status(400).json({ error: "Business has no phone number" });
      }

      const session = await createCallSession({
        businessId: business.id,
        businessName: business.businessName,
        prospectPhone,
      });

      const connectUrl = webhookPath(req, "/api/twilio/voice/connect", session.id);
      const statusCallback = webhookPath(req, "/api/twilio/voice/status", session.id);

      const client = twilio(config.accountSid, config.authToken);
      const call = await client.calls.create({
        to: normalizePhoneNumber(config.founderPhone),
        from: config.fromNumber,
        url: connectUrl,
        method: "POST",
        statusCallback,
        statusCallbackMethod: "POST",
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      });

      await persistCallProgress(session, call.sid, cleanText(call.status) || "initiated");

      return res.json({
        ok: true,
        callSid: call.sid,
        sessionId: session.id,
        status: cleanText(call.status) || "initiated",
      });
    } catch (err) {
      logTwilioVoiceError("calls/start", err);
      return res.status(400).json({ error: err.message });
    }
  });
}
