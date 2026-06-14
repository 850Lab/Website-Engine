import { useEffect, useState } from "react";
import { api } from "../api";

function label(value) {
  return String(value || "").replace(/_/g, " ");
}

export function FounderTimelinePage() {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const payload = await api.founderOsTimeline(300);
      setEntries(payload.entries ?? []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load timeline.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="fo-page">
      <div className="fo-header-row">
        <h2>Activity Timeline</h2>
        <button className="button-ghost" type="button" onClick={load}>Refresh</button>
      </div>
      {error ? <div className="fo-error">{error}</div> : null}

      <div className="fo-list">
        {entries.map((entry) => (
          <div key={entry.id} className="fo-business-card">
            <strong>{label(entry.type)}</strong>
            <div>{entry.message}</div>
            <div className="fo-muted">{new Date(entry.at).toLocaleString()}</div>
          </div>
        ))}
        {!entries.length ? <div className="fo-muted">No activity yet.</div> : null}
      </div>
    </div>
  );
}
