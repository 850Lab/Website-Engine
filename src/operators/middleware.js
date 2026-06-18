import {
  getSessionForRequest,
  operatorFromSession,
} from "./session.js";

export async function attachOperatorSession(req, res, next) {
  const session = await getSessionForRequest(req);
  req.session = session;
  req.operator = operatorFromSession(session);
  return next();
}

export async function requireOperatorApi(req, res, next) {
  const session = await getSessionForRequest(req);
  if (!session?.operatorId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.session = session;
  req.operator = operatorFromSession(session);
  return next();
}

export async function requireOperatorPage(req, res, next) {
  const session = await getSessionForRequest(req);
  if (!session?.operatorId) {
    const returnTo = encodeURIComponent(req.originalUrl || "/");
    return res.redirect(302, `/login?return=${returnTo}`);
  }
  req.session = session;
  req.operator = operatorFromSession(session);
  return next();
}

export async function requireOwnerApi(req, res, next) {
  const session = await getSessionForRequest(req);
  if (!session?.operatorId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.session = session;
  req.operator = operatorFromSession(session);
  if (req.operator?.role !== "owner") {
    return res.status(403).json({ error: "Owner access required." });
  }
  return next();
}
