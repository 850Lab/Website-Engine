import {
  getSessionForRequest,
  operatorFromSession,
} from "./session.js";

function localOperator() {
  return { id: "local", name: "Local Operator", role: "owner" };
}

export async function attachOperatorSession(req, res, next) {
  const session = await getSessionForRequest(req);
  req.session = session;
  req.operator = operatorFromSession(session);
  return next();
}

export async function requireOperatorApi(req, res, next) {
  if (process.env.NODE_ENV !== "production") {
    req.operator = localOperator();
    return next();
  }

  const session = await getSessionForRequest(req);
  if (!session?.operatorId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.session = session;
  req.operator = operatorFromSession(session);
  return next();
}

export async function requireOperatorPage(req, res, next) {
  if (process.env.NODE_ENV !== "production") {
    req.operator = localOperator();
    return next();
  }

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
  if (process.env.NODE_ENV !== "production") {
    req.operator = localOperator();
    return next();
  }

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
