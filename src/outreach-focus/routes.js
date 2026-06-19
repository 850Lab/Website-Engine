import { cleanText } from "../stage1/shared.js";
import { buildFocusMetrics } from "./metrics.js";
import { getFocus, normalizeFocusMode, updateFocus } from "./store.js";

export function registerOutreachFocusRoutes(app, { requireOperatorApi } = {}) {
  const auth = requireOperatorApi ?? ((_req, _res, next) => next());

  app.get("/api/outreach/focus", auth, async (req, res) => {
    try {
      const mode = normalizeFocusMode(req.query.mode);
      return res.json({ mode, focus: await getFocus(mode) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/outreach/focus", auth, async (req, res) => {
    try {
      const mode = normalizeFocusMode(req.body?.mode ?? req.query.mode);
      const focus = await updateFocus(mode, {
        industry: req.body?.industry,
        city: req.body?.city,
        offer: req.body?.offer,
        salesperson: req.body?.salesperson,
      });
      return res.json({ mode, focus });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/outreach/focus-metrics", auth, async (req, res) => {
    try {
      const mode = normalizeFocusMode(req.query.mode);
      return res.json(await buildFocusMetrics(mode));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
}

export { buildFocusMetrics, buildFocusQueueMeta } from "./metrics.js";
export {
  FOCUS_CALL_TARGET,
  getFocus,
  updateFocus,
  leadMatchesFocus,
  sortLeadsByFocus,
  filterLeadsToFocus,
  recordPwFocusActivity,
  recordWebsiteFocusActivity,
  appendFocusEvent,
} from "./store.js";
