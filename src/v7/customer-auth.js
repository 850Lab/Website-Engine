import { cleanText } from "./shared.js";

const COOKIE_PREFIX = "wop_token_";

export function customerTokenCookieName(projectId) {
  return `${COOKIE_PREFIX}${cleanText(projectId)}`;
}

export function readCustomerToken(req, projectId) {
  const fromQuery = cleanText(req.query?.token);
  if (fromQuery) return fromQuery;
  const fromBody = cleanText(req.body?.token);
  if (fromBody) return fromBody;
  return cleanText(req.cookies?.[customerTokenCookieName(projectId)]);
}

export function validateCustomerAccess(project, token) {
  if (!project) return { ok: false, reason: "not_found" };
  const expected = cleanText(project.customerAccessToken);
  const provided = cleanText(token);
  if (!expected) return { ok: false, reason: "no_token" };
  if (!provided || provided !== expected) return { ok: false, reason: "invalid_token" };
  return { ok: true };
}

export function customerDashboardUrl(baseUrl, projectId, token) {
  const base = cleanText(baseUrl).replace(/\/$/, "");
  return `${base}/dashboard/${encodeURIComponent(projectId)}?token=${encodeURIComponent(token)}`;
}
