import twilio from "twilio";
import express from "express";
import { cleanText, normalizePhoneNumber } from "../stage1/shared.js";
import { getQualifiedBusiness } from "../stage1/qualified-business-store.js";
import {
  assertTwilioVoiceConfigured,
  getTwilioVoiceConfig,
  resolvePublicBaseUrl,
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

const VoiceResponse = twilio.twiml.VoiceResponse;

function twilioFormBody(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

function sessionIdFromRequest(req) {
  return cleanText(req.query?.sessionId || twilioFormBody(req).sessionId);
}

function validateTwilioWebhook(req) {
  const { authToken } = getTwilioVoiceConfig();
  if (!authToken) return false;

  const signature = req.get("x-twilio-signature");
  if (!signature) return false;

  try {
    return twilio.validateRequest(
      authToken,
      signature,
      resolvePublicBaseUrl(req) + req.originalUrl,
      twilioFormBody(req),
    );
  } catch {
    return false;
  }
}

function rejectInvalidTwilioWebhook(req, res) {
  if (validateTwilioWebhook(req)) return false;
  res.status(403).type("text/plain").send("Forbidden");
  return true;
}

function prospectPhoneForBusiness(business) {
  const phone = cleanText(business.normalizedPhone) || cleanText(business.phone);
  return normalizePhoneNumber(phone);
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
        if (rejectInvalidTwilioWebhook(req, res)) return;

        const sessionId = sessionIdFromRequest(req);
        const session = sessionId ? await getCallSession(sessionId) : null;
        if (!session) {
          const response = new VoiceResponse();
          response.say("Sorry, this call session is no longer available.");
          response.hangup();
          return res.type("text/xml").send(response.toString());
        }

        const business = await getQualifiedBusiness(session.businessId);
        const prospectPhone = prospectPhoneForBusiness(business ?? {});
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
        if (callSid) {
          await updateCallSession(session.id, { twilioCallSid: callSid });
          await upsertSalesCallOnBusiness(
            session.businessId,
            buildSalesCallRecord({
              id: session.id,
              twilioCallSid: callSid,
              startedAt: session.startedAt,
              status: "in-progress",
            }),
          );
        }

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

        return res.type("text/xml").send(response.toString());
      } catch (err) {
        const response = new VoiceResponse();
        response.say("Sorry, an error occurred while connecting your call.");
        response.hangup();
        return res.type("text/xml").send(response.toString());
      }
    },
  );

  app.post("/api/twilio/voice/recording", parseForm, async (req, res) => {
    try {
      if (rejectInvalidTwilioWebhook(req, res)) return;

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
      }

      return res.type("text/plain").send("OK");
    } catch (err) {
      return res.status(500).type("text/plain").send("Error");
    }
  });

  app.post("/api/twilio/voice/status", parseForm, async (req, res) => {
    try {
      if (rejectInvalidTwilioWebhook(req, res)) return;

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
        } else if (callStatus === "answered" || callStatus === "in-progress") {
          await updateCallSession(session.id, { status: callStatus });
        } else if (callStatus === "ringing" || callStatus === "initiated") {
          await updateCallSession(session.id, { status: callStatus });
        }
      }

      return res.type("text/plain").send("OK");
    } catch (err) {
      return res.status(500).type("text/plain").send("Error");
    }
  });
}

export function registerTwilioCallRoutes(app) {
  app.post("/api/calls/start", async (req, res) => {
    try {
      const businessId = cleanText(req.body?.businessId);
      if (!businessId) {
        return res.status(400).json({ error: "businessId is required" });
      }

      const config = assertTwilioVoiceConfigured();
      const business = await getQualifiedBusiness(businessId);
      if (!business) {
        return res.status(404).json({ error: "Business not found" });
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

      await updateCallSession(session.id, {
        twilioCallSid: call.sid,
        status: cleanText(call.status) || "initiated",
      });

      await upsertSalesCallOnBusiness(
        business.id,
        buildSalesCallRecord({
          id: session.id,
          twilioCallSid: call.sid,
          startedAt: session.startedAt,
          status: cleanText(call.status) || "initiated",
        }),
      );

      return res.json({
        ok: true,
        callSid: call.sid,
        sessionId: session.id,
        status: cleanText(call.status) || "initiated",
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });
}
