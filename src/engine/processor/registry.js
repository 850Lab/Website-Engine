export const DEFAULT_PROCESSOR_ID = "processor_main";

const handlers = new Map();

export function registerJobHandler(jobType, handler, options = {}) {
  if (!jobType) {
    throw new Error("registerJobHandler requires jobType");
  }
  if (typeof handler !== "function") {
    throw new Error("registerJobHandler requires handler function");
  }

  handlers.set(String(jobType), {
    handler,
    label: options.label || String(jobType),
    registeredAt: new Date().toISOString(),
  });
  return { jobType: String(jobType), registered: true };
}

export function unregisterJobHandler(jobType) {
  const key = String(jobType);
  const removed = handlers.delete(key);
  return { jobType: key, removed };
}

export function getJobHandler(jobType) {
  const entry = handlers.get(String(jobType));
  return entry ? entry.handler : null;
}

export function listJobHandlers() {
  return [...handlers.keys()];
}

export function getJobHandlerEntry(jobType) {
  return handlers.get(String(jobType)) || null;
}

export function clearJobHandlersForTests() {
  handlers.clear();
}
