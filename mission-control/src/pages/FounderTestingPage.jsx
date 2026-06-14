import { useEffect, useState } from "react";
import { api } from "../api";
import { PillBadge, formatDate } from "../components/PillBadge";

function ReadinessScoreBar({ label, value }) {
  const score = Number(value) || 0;
  const tone = score >= 8 ? "#2dd4bf" : score >= 6 ? "#4f8cff" : score >= 4 ? "#ffd28a" : "#ff8fa3";
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="section-row">
        <span className="muted">{label}</span>
        <strong>{score.toFixed(1)}/10</strong>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ width: `${Math.min(100, score * 10)}%`, height: "100%", borderRadius: 999, background: tone }} />
      </div>
    </div>
  );
}

function MetricCell({ label, value, suffix = "" }) {
  return (
    <div className="card">
      <h4>{label}</h4>
      <div className="value">{value ?? 0}{suffix}</div>
    </div>
  );
}

export function FounderTestingPage() {
  const [data, setData] = useState(null);
  const [opportunity, setOpportunity] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});
  const [walk, setWalk] = useState(null);
  const [queueFilter, setQueueFilter] = useState("");
  const [queue, setQueue] = useState({ queue: [], summary: {} });

  const load = async () => {
    try {
      const [payload, dashboard, founderQueue] = await Promise.all([
        api.founderTesting(),
        api.opportunityDashboard(),
        api.stage1FounderTestQueue(queueFilter),
      ]);
      setOpportunity(dashboard);
      setData(payload);
      setQueue(founderQueue);
      const drafts = {};
      for (const project of payload.projects ?? []) {
        drafts[project.id] = { ...project.notes };
      }
      setNoteDrafts(drafts);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load founder testing center.");
    }
  };

  useEffect(() => {
    load();
  }, [queueFilter]);

  const saveNotes = async (projectId) => {
    setBusyId(projectId);
    setError("");
    try {
      const draft = noteDrafts[projectId] ?? {};
      const result = await api.saveFounderNotes(projectId, draft);
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          projects: current.projects.map((project) =>
            project.id === projectId
              ? { ...project, notes: result.notes, readiness: result.readiness ?? project.readiness }
              : project
          ),
        };
      });
    } catch (err) {
      setError(err.message || "Failed to save notes.");
    } finally {
      setBusyId("");
    }
  };

  const updateDraft = (projectId, field, value) => {
    setNoteDrafts((current) => ({
      ...current,
      [projectId]: { ...(current[projectId] ?? {}), [field]: value },
    }));
  };

  const openLink = (url) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const startWalk = async (project) => {
    setBusyId(project.id);
    setError("");
    try {
      const payload = await api.founderWalk(project.id);
      const first = payload.steps?.[0];
      if (first?.url) openLink(first.url);
      setWalk({
        projectId: project.id,
        businessName: project.businessName,
        steps: payload.steps ?? [],
        stepIndex: 0,
      });
    } catch (err) {
      setError(err.message || "Could not start funnel walk.");
    } finally {
      setBusyId("");
    }
  };

  const advanceWalk = async () => {
    if (!walk) return;
    const nextIndex = walk.stepIndex + 1;
    if (nextIndex >= walk.steps.length) {
      setWalk(null);
      await load();
      return;
    }
    const nextStep = walk.steps[nextIndex];
    setBusyId(walk.projectId);
    setError("");
    try {
      let url = nextStep.url;
      if (nextStep.key === "activation") {
        await api.founderWalkSimulatePurchase(walk.projectId);
      }
      if (nextStep.key === "dashboard") {
        const activated = await api.founderWalkActivate(walk.projectId);
        url = activated.dashboardUrl || activated.links?.dashboard || url;
        const refreshed = await api.founderWalk(walk.projectId);
        setWalk((current) => ({
          ...current,
          steps: refreshed.steps ?? current.steps,
          stepIndex: nextIndex,
        }));
        openLink(url);
        await load();
        return;
      }
      setWalk((current) => ({ ...current, stepIndex: nextIndex }));
      openLink(url);
    } catch (err) {
      setError(err.message || "Could not advance funnel walk.");
    } finally {
      setBusyId("");
    }
  };

  const summary = data?.summary;
  const projects = data?.projects ?? [];

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">Founder Testing</h2>
          <div className="muted">Evaluate the business — funnel metrics, readiness, and prospect walkthrough.</div>
        </div>
        <button className="button-ghost" type="button" onClick={load}>Refresh</button>
      </div>
      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
      {opportunity ? (
        <>
          <h3 className="section-title">Opportunity database growth</h3>
          <div className="grid-cards">
            <MetricCell label="Database growth" value={opportunity.growth?.databaseGrowth} />
            <MetricCell label="Added today" value={opportunity.growth?.opportunitiesAddedToday} />
            <MetricCell label="Added this week" value={opportunity.growth?.opportunitiesAddedThisWeek} />
            <MetricCell label="Qualified %" value={opportunity.database?.qualifiedPercent ?? 0} suffix="%" />
          </div>
          <div className="detail-grid">
            <div className="card stack">
              <h4>Top cities</h4>
              {(opportunity.topCities ?? []).slice(0, 6).map((row) => (
                <div key={row.name} className="section-row"><span>{row.name}</span><strong>{row.count}</strong></div>
              ))}
            </div>
            <div className="card stack">
              <h4>Top industries</h4>
              {(opportunity.topIndustries ?? []).slice(0, 6).map((row) => (
                <div key={row.name} className="section-row"><span>{row.name}</span><strong>{row.count}</strong></div>
              ))}
            </div>
            <div className="card stack">
              <h4>Recent discoveries</h4>
              {(opportunity.recentDiscoveries ?? []).slice(0, 6).map((row) => (
                <div key={row.id} className="muted compact-meta">{row.businessName} · {row.city} · {row.industry}</div>
              ))}
            </div>
          </div>
        </>
      ) : null}
      {summary ? (
        <div className="grid-cards">
          <div className="card"><h4>Active projects</h4><div className="value">{summary.projectCount}</div></div>
          <div className="card"><h4>Avg readiness</h4><div className="value">{summary.averageReadiness ?? "—"}</div></div>
          <div className="card"><h4>Purchases</h4><div className="value">{summary.totalPurchases}</div></div>
        </div>
      ) : null}
      <div className="card stack">
        <div className="section-row">
          <h3 className="section-title">Founder Test Queue</h3>
          <select value={queueFilter} onChange={(e) => setQueueFilter(e.target.value)}>
            <option value="">All</option>
            <option value="no_project">No Project</option>
            <option value="project_created">Project Created</option>
            <option value="preview_generated">Preview Generated</option>
          </select>
        </div>
        <div className="grid-cards">
          <MetricCell label="No Project" value={queue.summary?.noProject} />
          <MetricCell label="Project Created" value={queue.summary?.projectCreated} />
          <MetricCell label="Preview Generated" value={queue.summary?.previewGenerated} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Qualified Business</th>
                <th>Project ID</th>
                <th>Preview URL</th>
                <th>Launch URL</th>
                <th>Project Status</th>
              </tr>
            </thead>
            <tbody>
              {(queue.queue ?? []).slice(0, 100).map((row) => (
                <tr key={row.id}>
                  <td>{row.businessName}</td>
                  <td>{row.opportunityProjectId || "—"}</td>
                  <td>{row.previewUrl ? <a href={row.previewUrl} target="_blank" rel="noreferrer">Preview</a> : "—"}</td>
                  <td>{row.launchUrl ? <a href={row.launchUrl} target="_blank" rel="noreferrer">Launch</a> : "—"}</td>
                  <td>{row.previewStatus || row.projectStatus || "No Project"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!projects.length ? (
        <div className="card muted">No projects yet. Create one under V7 Launch Funnel.</div>
      ) : null}
      {projects.map((project) => {
        const draft = noteDrafts[project.id] ?? project.notes ?? {};
        const metrics = project.metrics ?? {};
        return (
          <div key={project.id} className="card stack">
            <div className="section-row">
              <div>
                <h3 className="section-title">{project.businessName}</h3>
                <div className="muted compact-meta">{project.id} · {project.city} · Created {formatDate(project.createdAt)}</div>
              </div>
              <PillBadge value={project.status} />
            </div>
            <div className="btn-row">
              <button className="button-ghost" type="button" onClick={() => openLink(project.links?.preview)}>Preview</button>
              <button className="button-ghost" type="button" onClick={() => openLink(project.links?.launch)}>Launch</button>
              <button className="button-ghost" type="button" onClick={() => openLink(project.links?.dashboard)}>Dashboard</button>
              <button className="button" type="button" disabled={busyId === project.id} onClick={() => startWalk(project)}>Walk The Funnel</button>
            </div>
            <div>
              <h4 className="section-title">Funnel metrics</h4>
              <div className="grid-cards">
                <MetricCell label="Preview views" value={metrics.previewViews} />
                <MetricCell label="Launch page views" value={metrics.launchPageViews} />
                <MetricCell label="Price views" value={metrics.priceViews} />
                <MetricCell label="Tell me more" value={metrics.tellMeMoreClicks} />
                <MetricCell label="Launch clicks" value={metrics.launchClicks} />
                <MetricCell label="Purchases" value={metrics.purchases} />
                <MetricCell label="Conversion" value={metrics.conversionPercent ?? "—"} suffix={metrics.conversionPercent == null ? "" : "%"} />
              </div>
            </div>
            <div>
              <h4 className="section-title">Sales readiness</h4>
              <div className="muted" style={{ marginBottom: 12 }}>{project.readiness?.summary}</div>
              <div className="form-grid">
                <ReadinessScoreBar label="Preview quality" value={project.readiness?.previewQuality} />
                <ReadinessScoreBar label="Offer clarity" value={project.readiness?.offerClarity} />
                <ReadinessScoreBar label="Trust" value={project.readiness?.trust} />
                <ReadinessScoreBar label="Call to action" value={project.readiness?.callToAction} />
              </div>
            </div>
            <div>
              <h4 className="section-title">Founder notes</h4>
              <div className="form-grid">
                <label>What felt confusing?<textarea rows={2} value={draft.confusing ?? ""} onChange={(e) => updateDraft(project.id, "confusing", e.target.value)} /></label>
                <label>What built trust?<textarea rows={2} value={draft.trust ?? ""} onChange={(e) => updateDraft(project.id, "trust", e.target.value)} /></label>
                <label>What questions did I have?<textarea rows={2} value={draft.questions ?? ""} onChange={(e) => updateDraft(project.id, "questions", e.target.value)} /></label>
                <label>Would I buy?<textarea rows={2} value={draft.wouldBuy ?? ""} onChange={(e) => updateDraft(project.id, "wouldBuy", e.target.value)} /></label>
                <label>Score (1–10)<input type="number" min={1} max={10} value={draft.score ?? ""} onChange={(e) => updateDraft(project.id, "score", e.target.value)} /></label>
              </div>
              <button className="button" type="button" disabled={busyId === project.id} onClick={() => saveNotes(project.id)}>Save notes</button>
            </div>
          </div>
        );
      })}
      {walk ? (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, padding: 16, background: "rgba(8,12,22,0.96)", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <div className="section-row">
              <div>
                <div className="muted">Walk the funnel · Step {walk.stepIndex + 1} of {walk.steps.length}</div>
                <strong>{walk.businessName}</strong>
                <div className="muted">{walk.steps[walk.stepIndex]?.label}</div>
              </div>
              <div className="btn-row">
                <button className="button-ghost" type="button" onClick={() => setWalk(null)}>End walk</button>
                <button className="button" type="button" disabled={busyId === walk.projectId} onClick={advanceWalk}>
                  {walk.stepIndex >= walk.steps.length - 1 ? "Finish" : `Next: ${walk.steps[walk.stepIndex + 1]?.label}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
