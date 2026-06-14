import { useEffect, useState } from "react";
import { api } from "../api";
import { PillBadge } from "../components/PillBadge";

export function SettingsPage() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setStatus(await api.adminSystemStatus());
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load system status.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">Settings</h2>
          <div className="muted">Environment status for the active product stack.</div>
        </div>
        <button className="button-ghost" type="button" onClick={load}>Refresh</button>
      </div>
      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
      {!status ? (
        <div className="card muted">Loading system status...</div>
      ) : (
        <>
          <div className="grid-cards">
            <div className="card">
              <h4>Admin account</h4>
              <div className="value">{status.admin?.hasAdminAccount ? "Ready" : "Missing"}</div>
              <div className="muted">{status.admin?.email ?? status.admin?.authMode}</div>
            </div>
            <div className="card">
              <h4>Qualified businesses</h4>
              <div className="value">{status.counts?.qualifiedBusinesses ?? 0}</div>
            </div>
            <div className="card">
              <h4>V7 projects</h4>
              <div className="value">{status.counts?.opportunityProjects ?? 0}</div>
            </div>
            <div className="card">
              <h4>Preview folders</h4>
              <div className="value">{status.counts?.previewFolders ?? 0}</div>
            </div>
            <div className="card">
              <h4>Stripe launch</h4>
              <div className="value">{status.integrations?.stripeLaunch?.configured ? "Ready" : "Missing"}</div>
            </div>
            <div className="card">
              <h4>Playwright</h4>
              <div className="value">{status.integrations?.playwrightAvailable ? "Ready" : "Missing"}</div>
            </div>
          </div>
          <div className="card stack">
            <h3 className="section-title">Integrations</h3>
            <div className="detail-grid">
              <div><b>PageSpeed API:</b> <PillBadge value={status.integrations?.pageSpeedConfigured ? "yes" : "no"} /></div>
              <div><b>Public base URL:</b> {status.integrations?.publicBaseUrl || "auto-detect"}</div>
              <div><b>Stripe launch missing:</b> {(status.integrations?.stripeLaunch?.missing ?? []).join(", ") || "none"}</div>
              <div><b>Webhook configured:</b> <PillBadge value={status.integrations?.stripeWebhook?.configured ? "yes" : "no"} /></div>
              <div><b>Last data backup:</b> {status.storage?.lastBackupAt ? new Date(status.storage.lastBackupAt).toLocaleString() : "None yet"}</div>
              <div><b>Data folder:</b> <span className="muted">{status.storage?.dataDir}</span></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
