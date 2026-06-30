import { requireOperatorApi, requireOperatorPage } from "./middleware.js";

const OPERATOR_PAGE_PATHS = new Set([
  "/",
  "/call-queue",
  "/pipeline",
  "/opportunities",
  "/settings",
  "/pw",
  "/pw/queue",
  "/pw/search-targets",
  "/outreach",
  "/founder",
  "/mission-control",
  "/mission-control/sales",
  "/angle-folders",
]);

function isTwilioVoiceWebhookPath(path, method) {
  if (method !== "POST") return false;
  return (
    path === "/api/twilio/voice/connect" ||
    path === "/api/twilio/voice/recording" ||
    path === "/api/twilio/voice/status" ||
    path === "/api/twilio/voice/dial-status"
  );
}

function isOperatorPagePath(path) {
  if (OPERATOR_PAGE_PATHS.has(path)) return true;
  return path.startsWith("/pw/");
}

function isOperatorApiPath(path) {
  return (
    path.startsWith("/api/pivotal-os") ||
    path.startsWith("/api/pw/") ||
    path.startsWith("/api/pressure-washing") ||
    path.startsWith("/api/mission-control") ||
    path.startsWith("/api/public/outreach") ||
    path.startsWith("/api/public/angle-folders") ||
    path.startsWith("/api/public/founder") ||
    path.startsWith("/api/calls") ||
    path.startsWith("/api/operators") ||
    path.startsWith("/api/twilio/voice/settings")
  );
}

function isPublicApiPath(path, method) {
  if (path === "/api/health") return true;
  if (path === "/api/auth/status") return true;
  if (path === "/api/me") return true;
  if (path === "/api/login" && method === "POST") return true;
  if (path === "/api/signup" && method === "POST") return true;
  if (path === "/api/logout" && method === "POST") return true;
  if (path.startsWith("/api/public/projects/")) return true;
  if (path === "/api/public/funnel/event" && method === "POST") return true;
  if (path.startsWith("/api/stripe/")) return true;
  if (isTwilioVoiceWebhookPath(path, method)) return true;
  if (path.startsWith("/api/customer/")) return true;
  return false;
}

function isPublicPagePath(path) {
  if (path === "/login") return true;
  if (path === "/privacy") return true;
  if (path.startsWith("/legal/")) return true;
  if (path.startsWith("/p/")) return true;
  if (path.startsWith("/launch/")) return true;
  if (path.startsWith("/activate/")) return true;
  if (path.startsWith("/dashboard/")) return true;
  return false;
}

export function registerOperatorAppGuard(app) {
  app.use(async (req, res, next) => {
    const path = req.path;

    if (path.startsWith("/api/")) {
      if (isPublicApiPath(path, req.method)) return next();
      if (isOperatorApiPath(path)) return requireOperatorApi(req, res, next);
      return next();
    }

    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (isPublicPagePath(path)) return next();
    if (isOperatorPagePath(path)) return requireOperatorPage(req, res, next);

    return next();
  });
}
