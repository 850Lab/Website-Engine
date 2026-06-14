function configuredWorkerKeys() {
  const single = String(process.env.WORKER_API_KEY ?? "").trim();
  const multi = String(process.env.WORKER_API_KEYS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const keys = new Set(multi);
  if (single) keys.add(single);
  return keys;
}

function bearerToken(value = "") {
  const input = String(value ?? "").trim();
  if (!input.toLowerCase().startsWith("bearer ")) return "";
  return input.slice(7).trim();
}

export function isWorkerJobPath(path = "") {
  const value = String(path ?? "");
  return value === "/opportunity-engine/jobs/claim" || value.startsWith("/opportunity-engine/jobs/");
}

export function readWorkerAuthToken(req) {
  const header = req.get("x-worker-key") || "";
  if (header) return String(header).trim();
  return bearerToken(req.get("authorization"));
}

export function validateWorkerAuth(req) {
  const keys = configuredWorkerKeys();
  if (!keys.size) {
    return { ok: false, status: 503, error: "Worker API keys not configured." };
  }
  const token = readWorkerAuthToken(req);
  if (!token) {
    return { ok: false, status: 401, error: "Missing worker API key." };
  }
  if (!keys.has(token)) {
    return { ok: false, status: 403, error: "Invalid worker API key." };
  }
  return { ok: true };
}

export function requireWorkerApiKey(req, res, next) {
  const result = validateWorkerAuth(req);
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }
  return next();
}
