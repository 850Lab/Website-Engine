import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { formatDate } from "../components/PillBadge";

function MetricCell({ label, value, hint = "" }) {
  return (
    <div className="card">
      <h4>{label}</h4>
      <div className="value">{value ?? 0}</div>
      {hint ? <div className="muted compact-meta">{hint}</div> : null}
    </div>
  );
}

function StepCard({ step, description, to, action }) {
  const content = (
    <div className="founder-step-card">
      <div className="muted compact-meta">{step}</div>
      <strong>{description}</strong>
      <span className="button-ghost founder-step-cta">{action}</span>
    </div>
  );
  return to ? (
    <Link className="founder-step-link" to={to}>
      {content}
    </Link>
  ) : content;
}

export function HomePage() {
  const [dashboard, setDashboard] = useState(null);
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [dash, founderQueue] = await Promise.all([
        api.opportunityDashboard(),
        api.stage1FounderTestQueue("ready_for_outreach"),
      ]);
      setDashboard(dash);
      setQueue(founderQueue);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load founder home.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const database = dashboard?.database ?? {};
  const progress = useMemo(() => {
    const active = dashboard?.mostRecentCampaign ?? null;
    const progressView = active?.progress ?? {};
    const total = Number(progressView.totalPairs) || 0;
    const completed = Number(progressView.completedPairs) || 0;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      active,
      total,
      completed,
      remaining: Number(progressView.remainingPairs) || 0,
      estimatedMinutesRemaining: Number(progressView.estimatedMinutesRemaining) || 0,
      percent,
    };
  }, [dashboard]);

  const nextAction = useMemo(() => {
    const ready = Number(database.readyForOutreach) || 0;
    const previewsReady = Number(database.previewsReady) || 0;
    const projects = Number(database.projectsGenerated) || 0;
    const qualified = Number(database.qualifiedBusinesses) || 0;
    if (ready > 0) {
      return `Contact ${ready} business${ready === 1 ? "" : "es"} in Ready For Outreach.`;
    }
    if (previewsReady > 0) {
      return `Mark ${previewsReady} preview${previewsReady === 1 ? "" : "s"} as ready for outreach.`;
    }
    if (projects > 0) {
      return "Verify generated previews and push them to ready.";
    }
    if (qualified > 0) {
      return "Generate projects for qualified opportunities.";
    }
    return "Run a discovery campaign to fill today's opportunity pipeline.";
  }, [database]);

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">Founder Home</h2>
          <div className="muted">If you log in at 6:00 AM, this is your operating view.</div>
        </div>
        <button className="button-ghost" type="button" onClick={load}>Refresh</button>
      </div>

      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}

      <div className="card founder-priority">
        <div className="muted compact-meta">What should I do next?</div>
        <div className="value" style={{ fontSize: "1.05rem", marginTop: 6 }}>{nextAction}</div>
      </div>

      <div className="grid-cards">
        <MetricCell label="Total Opportunities" value={database.totalBusinesses} />
        <MetricCell label="Qualified Opportunities" value={database.qualifiedBusinesses} />
        <MetricCell label="Projects Generated" value={database.projectsGenerated} />
        <MetricCell label="Previews Ready" value={database.previewsReady} />
        <MetricCell label="Ready For Outreach" value={database.readyForOutreach} />
        <MetricCell label="Opportunities Found Today" value={database.opportunitiesFoundToday} />
      </div>

      <div className="detail-grid">
        <div className="card stack">
          <h3 className="section-title">Campaign Progress</h3>
          <div className="section-row">
            <span>Status</span>
            <strong>{progress.active?.status ?? "No active campaign"}</strong>
          </div>
          <div className="section-row">
            <span>Completed / Total</span>
            <strong>{progress.completed}/{progress.total || "—"}</strong>
          </div>
          <div className="section-row">
            <span>Remaining</span>
            <strong>{progress.remaining}</strong>
          </div>
          <div className="section-row">
            <span>Estimated time remaining</span>
            <strong>{progress.estimatedMinutesRemaining} min</strong>
          </div>
          <div className="muted compact-meta">Progress: {progress.percent}%</div>
        </div>

        <div className="card stack">
          <h3 className="section-title">Top Cities</h3>
          {(dashboard?.topOpportunityCities ?? []).slice(0, 6).map((row) => (
            <div key={row.name} className="section-row">
              <span>{row.name}</span>
              <strong>{row.count}</strong>
            </div>
          ))}
        </div>

        <div className="card stack">
          <h3 className="section-title">Top Industries</h3>
          {(dashboard?.topOpportunityIndustries ?? []).slice(0, 6).map((row) => (
            <div key={row.name} className="section-row">
              <span>{row.name}</span>
              <strong>{row.count}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="card stack">
        <h3 className="section-title">Founder Workflow</h3>
        <div className="founder-workflow-grid">
          <StepCard step="1. Discover" description="Run campaigns and add opportunities" to="/qualified-database" action="Open QBD" />
          <StepCard step="2. Review" description="Filter and inspect qualified opportunities" to="/qualified-database" action="Review Database" />
          <StepCard step="3. Generate Projects" description="Create previews from qualified rows" to="/qualified-database" action="Generate" />
          <StepCard step="4. Review Previews" description="Open preview and launch pages" to="/qualified-database" action="Review" />
          <StepCard step="5. Mark Ready" description="Mark verified previews ready for outreach" to="/qualified-database" action="Mark Ready" />
          <StepCard step="6. Contact Business" description="Work outreach queue for today" to="/ready-for-outreach" action="Open Queue" />
        </div>
      </div>

      <div className="card stack">
        <h3 className="section-title">Ready For Outreach Today</h3>
        <div className="muted compact-meta">
          {queue?.total ?? 0} businesses currently meet: Project Created + Preview Generated + Preview Verified.
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>City</th>
                <th>Industry</th>
                <th>Preview</th>
                <th>Launch</th>
                <th>Project Created</th>
              </tr>
            </thead>
            <tbody>
              {(queue?.queue ?? []).slice(0, 12).map((row) => (
                <tr key={row.id}>
                  <td>{row.businessName}</td>
                  <td>{row.city || "—"}</td>
                  <td>{row.industry || "—"}</td>
                  <td>{row.previewUrl ? <a href={row.previewUrl} target="_blank" rel="noreferrer">Open Preview</a> : "—"}</td>
                  <td>{row.launchUrl ? <a href={row.launchUrl} target="_blank" rel="noreferrer">Open Launch</a> : "—"}</td>
                  <td>{formatDate(row.projectCreatedAt)}</td>
                </tr>
              ))}
              {!(queue?.queue ?? []).length ? (
                <tr>
                  <td colSpan={6} className="muted">No businesses ready yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div>
          <Link className="button" to="/ready-for-outreach">Open Full Ready For Outreach Queue</Link>
        </div>
      </div>
    </div>
  );
}
