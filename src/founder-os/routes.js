import { cleanText } from "../stage1/shared.js";
import {
  defaultEmailBody,
  defaultEmailSubject,
  defaultFollowUpText,
} from "../sales-brief/outreach-copy.js";
import {
  addFounderTimelineEntry,
  attachFounderAsset,
  founderDashboard,
  founderTimeline,
  getFounderBusiness,
  listFounderBusinesses,
  powerHourQueue,
  updateFounderBusiness,
} from "./store.js";

function normalizeFilters(query = {}) {
  return {
    status: query.status ?? "",
    city: query.city ?? "",
    industry: query.industry ?? "",
    search: query.search ?? "",
  };
}

function encodeSmsBody(text) {
  return encodeURIComponent(cleanText(text));
}

function encodeMail(text) {
  return encodeURIComponent(cleanText(text));
}

function defaultTextMessage(business) {
  return defaultFollowUpText(
    { businessName: business.businessName },
    business.previewUrl || business.website,
  );
}

function actionLinks(business) {
  const phone = cleanText(business.contact.phoneNumber).replace(/[^\d+]/g, "");
  const email = cleanText(business.contact.email);
  const smsMessage = defaultTextMessage(business);
  const emailSubject = defaultEmailSubject(business);
  const emailBody = defaultEmailBody(business);

  return {
    call: phone ? `tel:${phone}` : "",
    text: phone ? `sms:${phone}?body=${encodeSmsBody(smsMessage)}` : "",
    email: email ? `mailto:${email}?subject=${encodeMail(emailSubject)}&body=${encodeMail(emailBody)}` : "",
    facebook: cleanText(business.contact.facebookUrl),
    instagram: cleanText(business.contact.instagramUrl),
    website: cleanText(business.website),
    googleBusinessProfile: cleanText(business.googleBusinessProfileUrl),
  };
}

function recommendedAction(business) {
  if (business.outreachStatus === "new") return "Call — lead with how they get customers, not websites.";
  if (business.outreachStatus === "follow_up") return "Call back or send a growth-first follow-up.";
  if (business.outreachStatus === "contacted") return "Continue discovery — ask how they get new business today.";
  if (business.outreachStatus === "responded") return "Book a short follow-up after discovery.";
  if (business.outreachStatus === "interested") return "Present the right problem (trust, contact path, conversion) — not a generic redesign.";
  if (business.outreachStatus === "appointment_scheduled") return "Prepare discovery notes and emergency question.";
  if (business.outreachStatus === "proposal_sent") return "Follow up on proposal.";
  return "Review sales brief and choose the next discovery step.";
}

function businessView(business) {
  return {
    ...business,
    recommendedAction: recommendedAction(business),
    actions: actionLinks(business),
  };
}

export function registerFounderOsRoutes(app) {
  app.get("/api/founder-os/dashboard", async (_req, res) => {
    return res.json(await founderDashboard());
  });

  app.get("/api/founder-os/businesses", async (req, res) => {
    const filters = normalizeFilters(req.query);
    const rows = await listFounderBusinesses(filters);
    return res.json({
      filters,
      total: rows.length,
      businesses: rows.map(businessView),
    });
  });

  app.get("/api/founder-os/businesses/:id", async (req, res) => {
    const row = await getFounderBusiness(req.params.id);
    if (!row) return res.status(404).json({ error: "Business not found." });
    return res.json(businessView(row));
  });

  app.patch("/api/founder-os/businesses/:id", async (req, res) => {
    const next = await updateFounderBusiness(req.params.id, req.body ?? {});
    if (!next) return res.status(404).json({ error: "Business not found." });
    return res.json(businessView(next));
  });

  app.post("/api/founder-os/businesses/:id/timeline", async (req, res) => {
    const entry = await addFounderTimelineEntry({
      businessId: req.params.id,
      type: req.body?.type,
      message: req.body?.message,
      channel: req.body?.channel,
      meta: req.body?.meta,
    });
    if (!entry) return res.status(404).json({ error: "Business not found." });
    return res.status(201).json(entry);
  });

  app.post("/api/founder-os/businesses/:id/assets", async (req, res) => {
    const asset = await attachFounderAsset(req.params.id, req.body ?? {});
    if (!asset) return res.status(404).json({ error: "Business not found." });
    return res.status(201).json(asset);
  });

  app.get("/api/founder-os/timeline", async (req, res) => {
    const limit = Number(req.query.limit) || 200;
    return res.json({ entries: await founderTimeline(limit) });
  });

  app.get("/api/founder-os/power-hour", async (req, res) => {
    const limit = Number(req.query.limit) || 30;
    const queue = await powerHourQueue(limit);
    return res.json({ total: queue.length, queue: queue.map(businessView) });
  });
}
