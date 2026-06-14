import { useEffect, useState } from "react";
import { api } from "../api";
import { formatDate } from "../components/PillBadge";

function MetricCell({ label, value }) {
  return (
    <div className="card">
      <h4>{label}</h4>
      <div className="value">{value ?? 0}</div>
    </div>
  );
}

export function ReadyForOutreachPage() {
  const [queue, setQueue] = useState({ queue: [], summary: {}, total: 0 });
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const payload = await api.stage1FounderTestQueue("ready_for_outreach");
      setQueue(payload ?? { queue: [], summary: {}, total: 0 });
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load ready-for-outreach queue.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markReady = async (id) => {
    setBusyId(id);
    setError("");
    try {
      await api.stage1MarkReady(id);
      await load();
    } catch (err) {
      setError(err.message || "Failed to mark business ready.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">Ready For Outreach</h2>
          <div className="muted">
            Founder daily work queue. Showing only businesses with Project Created + Preview Generated + Preview Verified.
          </div>
        </div>
        <button className="button-ghost" type="button" onClick={load}>Refresh</button>
      </div>

      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}

      <div className="grid-cards">
        <MetricCell label="Ready For Outreach" value={queue.total} />
        <MetricCell label="Preview Verified" value={queue.summary?.previewVerified} />
        <MetricCell label="Projects Created" value={queue.summary?.projectCreated} />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Business</th>
              <th>City</th>
              <th>Industry</th>
              <th>Qualification Reason</th>
              <th>Contact Route</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Project Status</th>
              <th>Preview Status</th>
              <th>Preview</th>
              <th>Launch</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(queue.queue ?? []).map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.businessName}</strong>
                  <div className="muted compact-meta">Project: {row.opportunityProjectId || "—"}</div>
                  <div className="muted compact-meta">Created: {formatDate(row.projectCreatedAt)}</div>
                </td>
                <td>{row.city || "—"}</td>
                <td>{row.industry || "—"}</td>
                <td>{row.qualificationReason || "—"}</td>
                <td>{row.contactMethodLabel || "—"}</td>
                <td>{row.phone || "—"}</td>
                <td>{row.email || "—"}</td>
                <td>{row.projectStatus || "Project Created"}</td>
                <td>{row.previewStatus || "Preview Generated"}</td>
                <td>{row.previewUrl ? <a href={row.previewUrl} target="_blank" rel="noreferrer">Open Preview</a> : "—"}</td>
                <td>{row.launchUrl ? <a href={row.launchUrl} target="_blank" rel="noreferrer">Open Launch</a> : "—"}</td>
                <td>
                  <button
                    className="button-ghost"
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => markReady(row.id)}
                  >
                    Mark Ready
                  </button>
                </td>
              </tr>
            ))}
            {!(queue.queue ?? []).length ? (
              <tr>
                <td colSpan={12} className="muted">No businesses in today&apos;s outreach queue yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
