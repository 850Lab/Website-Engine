import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

function StatCard({ label, value }) {
  return (
    <div className="fo-stat-card">
      <div className="fo-stat-label">{label}</div>
      <div className="fo-stat-value">{value ?? 0}</div>
    </div>
  );
}

export function FounderDashboardPage() {
  const [dash, setDash] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const payload = await api.founderOsDashboard();
      setDash(payload);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load dashboard.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="fo-page">
      <div className="fo-header-row">
        <h2>Founder Dashboard</h2>
        <button className="button-ghost" type="button" onClick={load}>Refresh</button>
      </div>
      {error ? <div className="fo-error">{error}</div> : null}

      <div className="fo-section-title">Pipeline</div>
      <div className="fo-grid">
        <StatCard label="Total Businesses" value={dash?.totalBusinesses} />
        <StatCard label="New Opportunities" value={dash?.newOpportunities} />
        <StatCard label="Contacted" value={dash?.contacted} />
        <StatCard label="Responded" value={dash?.responded} />
        <StatCard label="Interested" value={dash?.interested} />
        <StatCard label="Appointments" value={dash?.appointmentsScheduled} />
        <StatCard label="Sales Closed" value={dash?.salesClosed} />
      </div>

      <div className="fo-section-title">Today</div>
      <div className="fo-grid">
        <StatCard label="Calls Made" value={dash?.callsMade} />
        <StatCard label="Texts Sent" value={dash?.textsSent} />
        <StatCard label="Emails Sent" value={dash?.emailsSent} />
        <StatCard label="DMs Sent" value={dash?.dmsSent} />
        <StatCard label="Total Offers Made" value={dash?.totalOffersMade} />
      </div>

      <div className="fo-next-card">
        <div className="fo-next-title">What should I do next?</div>
        <div className="fo-next-text">{dash?.nextAction || "Open Power Hour and begin outreach."}</div>
        <div className="fo-next-meta">
          <div>You have {dash?.uncontactedBusinesses ?? 0} uncontacted businesses.</div>
          <div>You have {dash?.followUpsDueToday ?? 0} follow-ups due today.</div>
        </div>
      </div>

      <div className="fo-action-row">
        <Link className="button" to="/power-hour">Start Power Hour</Link>
        <Link className="button-ghost" to="/businesses">Open Business Database</Link>
      </div>
    </div>
  );
}
