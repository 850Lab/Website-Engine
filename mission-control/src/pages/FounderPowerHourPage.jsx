import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

function statusLabel(value) {
  return String(value || "").replace(/_/g, " ");
}

export function FounderPowerHourPage() {
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const payload = await api.founderOsPowerHour(100);
      setQueue(payload.queue ?? []);
      setIndex(0);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load power hour queue.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const current = useMemo(() => queue[index] ?? null, [queue, index]);

  const next = () => {
    setIndex((currentIndex) => (currentIndex + 1 >= queue.length ? currentIndex : currentIndex + 1));
  };

  const log = async (type, message, status) => {
    if (!current) return;
    await api.founderOsAddTimeline(current.id, { type, message, channel: type });
    if (status) {
      await api.founderOsUpdateBusiness(current.id, { outreachStatus: status });
    }
    next();
  };

  return (
    <div className="fo-page">
      <div className="fo-header-row">
        <h2>Power Hour</h2>
        <button className="button-ghost" type="button" onClick={load}>Reload Queue</button>
      </div>
      {error ? <div className="fo-error">{error}</div> : null}
      <div className="fo-muted">{index + 1} / {queue.length}</div>

      {current ? (
        <div className="fo-power-card">
          <strong>{current.businessName}</strong>
          <div className="fo-muted">{current.industry} · {current.city}, {current.state}</div>
          <div className="fo-inline-two">
            <div>Website Score: {current.websiteAnalysis?.websiteScore ?? 0}</div>
            <div>Status: {statusLabel(current.outreachStatus)}</div>
          </div>

          <div className="fo-power-actions">
            <a
              className="fo-power-btn"
              href={current.actions?.call || "#"}
              onClick={() => log("call", "Called business from Power Hour.", "contacted")}
            >
              Call → Next
            </a>
            <a
              className="fo-power-btn"
              href={current.actions?.email || "#"}
              onClick={() => log("email", "Sent email from Power Hour.", "contacted")}
            >
              Email → Next
            </a>
            <a
              className="fo-power-btn"
              href={current.actions?.text || "#"}
              onClick={() => log("text", "Sent text from Power Hour.", "contacted")}
            >
              Text → Next
            </a>
            <button
              className="fo-power-btn ghost"
              type="button"
              onClick={() => log("skip", "Skipped in Power Hour.", "follow_up")}
            >
              Skip → Next
            </button>
          </div>
        </div>
      ) : (
        <div className="fo-business-card">
          <div className="fo-muted">No businesses in queue.</div>
        </div>
      )}
    </div>
  );
}
