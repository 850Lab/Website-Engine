/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */
import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api } from "./api";
import "./styles.css";

function StatusBadge({ status }) {
  const cls =
    status === "TARGET" ? "target" : status === "HOLD" ? "hold" : status === "SKIP" ? "skip" : "";
  return <span className={`badge ${cls}`}>{status}</span>;
}

function PillBadge({ value }) {
  const key = String(value ?? "unknown").replace(/_/g, "-").toLowerCase();
  return <span className={`badge small ${key}`}>{value ?? "unknown"}</span>;
}

function priorityRank(lead) {
  return lead.outreachPriority === "High Priority"
    ? 3
    : lead.outreachPriority === "Medium Priority"
      ? 2
      : 1;
}

function sortByPriority(rows) {
  return [...rows].sort(
    (a, b) =>
      priorityRank(b) - priorityRank(a) ||
      (Number(b.urgencyScore) || 0) - (Number(a.urgencyScore) || 0) ||
      (Number(b.closeLikelihood) || 0) - (Number(a.closeLikelihood) || 0) ||
      (Number(b.score) || 0) - (Number(a.score) || 0)
  );
}

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

async function copyText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) {
    notify(`${label} is not available.`, "error");
    return;
  }
  await navigator.clipboard.writeText(text);
  notify(`${label} copied.`);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read selected image."));
    reader.readAsDataURL(file);
  });
}

function notify(message, type = "success") {
  window.dispatchEvent(new CustomEvent("operator-toast", { detail: { message, type } }));
}

function confirmAction({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent("operator-confirm", {
        detail: { title, message, confirmLabel, danger, resolve },
      })
    );
  });
}

function promptAction({
  title,
  message,
  label = "Value",
  initialValue = "",
  multiline = false,
  confirmLabel = "Save",
}) {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent("operator-prompt", {
        detail: { title, message, label, initialValue, multiline, confirmLabel, resolve },
      })
    );
  });
}

function FeedbackCenter() {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [promptState, setPromptState] = useState(null);
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    const onToast = (event) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((current) => [...current, { id, ...event.detail }].slice(-4));
      setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4200);
    };
    const onConfirm = (event) => setConfirmState(event.detail);
    const onPrompt = (event) => {
      setPromptValue(event.detail.initialValue ?? "");
      setPromptState(event.detail);
    };
    window.addEventListener("operator-toast", onToast);
    window.addEventListener("operator-confirm", onConfirm);
    window.addEventListener("operator-prompt", onPrompt);
    return () => {
      window.removeEventListener("operator-toast", onToast);
      window.removeEventListener("operator-confirm", onConfirm);
      window.removeEventListener("operator-prompt", onPrompt);
    };
  }, []);

  const closeConfirm = (value) => {
    confirmState?.resolve(Boolean(value));
    setConfirmState(null);
  };

  const closePrompt = (value) => {
    promptState?.resolve(value);
    setPromptState(null);
    setPromptValue("");
  };

  return (
    <>
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type ?? "success"}`}>
            {toast.message}
          </div>
        ))}
      </div>
      {confirmState ? (
        <div className="modal-backdrop">
          <div className="modal-card stack">
            <h3 className="section-title">{confirmState.title}</h3>
            <p className="muted">{confirmState.message}</p>
            <div className="btn-row modal-actions">
              <button className="button-ghost" onClick={() => closeConfirm(false)}>Cancel</button>
              <button
                className={confirmState.danger ? "button-danger" : "button-primary"}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {promptState ? (
        <div className="modal-backdrop">
          <div className="modal-card stack">
            <h3 className="section-title">{promptState.title}</h3>
            {promptState.message ? <p className="muted">{promptState.message}</p> : null}
            <div className="field">
              <label>{promptState.label}</label>
              {promptState.multiline ? (
                <textarea value={promptValue} onChange={(e) => setPromptValue(e.target.value)} autoFocus />
              ) : (
                <input value={promptValue} onChange={(e) => setPromptValue(e.target.value)} autoFocus />
              )}
            </div>
            <div className="btn-row modal-actions">
              <button className="button-ghost" onClick={() => closePrompt(null)}>Cancel</button>
              <button className="button-primary" onClick={() => closePrompt(promptValue)}>
                {promptState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function useAuth() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const me = await api.me();
      setAuthenticated(Boolean(me.authenticated));
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { loading, authenticated, setAuthenticated };
}

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(email, password);
      onLogin(true);
      navigate("/mission-control");
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card stack" onSubmit={submit}>
        <h2 className="section-title">Mission Control Login</h2>
        <p className="muted">Enter your admin email/password to access dashboard controls.</p>
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
        <button className="button-primary" disabled={busy}>
          {busy ? "Signing in..." : "Login"}
        </button>
        <Link className="button-link" to="/signup">
          Create admin account
        </Link>
      </form>
    </div>
  );
}

function SignupPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState({ loading: true, signupRequired: true });
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    api
      .authStatus()
      .then((data) => {
        if (!alive) return;
        setStatus({ loading: false, ...data });
      })
      .catch(() => {
        if (!alive) return;
        setStatus({ loading: false, signupRequired: true });
      });
    return () => {
      alive = false;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.signup(email, password);
      onLogin(true);
      navigate("/mission-control");
    } catch (err) {
      setError(err.message || "Signup failed.");
    } finally {
      setBusy(false);
    }
  };

  if (status.loading) {
    return <div className="login-wrap"><div className="login-card">Checking signup status...</div></div>;
  }

  if (!status.signupRequired) {
    return (
      <div className="login-wrap">
        <div className="login-card stack">
          <h2 className="section-title">Admin account already exists</h2>
          <p className="muted">
            Signup is disabled because an admin account is already configured
            {status.adminEmail ? ` (${status.adminEmail})` : ""}.
          </p>
          <Link className="button-link" to="/login">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form className="login-card stack" onSubmit={submit}>
        <h2 className="section-title">Create Admin Account</h2>
        <p className="muted">One-time setup for Mission Control access.</p>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Password (min 8 chars)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
        <button className="button-primary" disabled={busy}>
          {busy ? "Creating..." : "Create Admin Account"}
        </button>
        <Link className="button-link" to="/login">
          Back to login
        </Link>
      </form>
    </div>
  );
}

function DevServerHealthBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let active = true;
    api.devServerHealth()
      .then((result) => {
        if (active) setStatus({ ok: true, ...result });
      })
      .catch((err) => {
        if (active) {
          setStatus({
            ok: false,
            error: err.message || "Backend health check failed.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (!status) return null;

  const routeAvailable =
    Boolean(status.health?.routes?.autonomousFieldTest) &&
    Boolean(status.autonomousFieldTest?.available);
  const healthy = status.ok && routeAvailable;
  const origin = status.health?.origin ?? "unknown backend";
  const routeStatus = status.autonomousFieldTest?.status ?? "unknown";

  return (
    <div className={`dev-health-banner ${healthy ? "healthy" : "warning"}`}>
      <span>
        {healthy
          ? "Backend connected"
          : "You may be connected to a stale backend. Restart the server."}
      </span>
      <span className="muted">
        {origin}
        {status.health?.port ? ` · port ${status.health.port}` : ""} · autonomous route{" "}
        {routeAvailable ? "available" : `missing/status ${routeStatus}`}
      </span>
    </div>
  );
}

function Shell({ children, onLogout }) {
  return (
    <div className="page-shell">
      <aside className="sidebar">
        <div className="brand">Website Engine Mission Control</div>
        <NavLink className="nav-link" to="/mission-control">
          Mission Control
        </NavLink>
        <NavLink className="nav-link" to="/lead-generation">
          Lead Generation
        </NavLink>
        <NavLink className="nav-link" to="/lead-generation/runs">
          Run History
        </NavLink>
        <NavLink className="nav-link" to="/autopilot">
          Autopilot
        </NavLink>
        <NavLink className="nav-link" to="/opportunities">
          Opportunities
        </NavLink>
        <NavLink className="nav-link" to="/projects">
          Demo Projects
        </NavLink>
        <NavLink className="nav-link" to="/field-test">
          Field Test
        </NavLink>
        <NavLink className="nav-link" to="/autonomous-field-test">
          Autonomous Test
        </NavLink>
        <NavLink className="nav-link" to="/leads/new">
          Create Lead
        </NavLink>
        <NavLink className="nav-link" to="/targets">
          Targets
        </NavLink>
        <NavLink className="nav-link" to="/outreach">
          Outreach
        </NavLink>
        <NavLink className="nav-link" to="/operations">
          Operations
        </NavLink>
        <NavLink className="nav-link" to="/settings">
          Settings
        </NavLink>
        <div style={{ marginTop: "auto" }}>
          <button className="button-danger" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>
      <main className="main">
        <DevServerHealthBanner />
        {children}
      </main>
      <FeedbackCenter />
    </div>
  );
}

function MissionControlPage() {
  const [summary, setSummary] = useState(null);
  const [leads, setLeads] = useState([]);
  const [busyLeadId, setBusyLeadId] = useState("");

  const load = async () => {
    const [s, l] = await Promise.all([api.dashboardSummary(), api.leads()]);
    setSummary(s);
    setLeads(l);
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (leadId, fn, successMessage = "Action completed.") => {
    setBusyLeadId(leadId);
    try {
      await fn();
      await load();
      notify(successMessage);
    } catch (err) {
      notify(err.message || "Action failed.", "error");
    } finally {
      setBusyLeadId("");
    }
  };

  return (
    <div className="stack">
      <div className="topbar">
        <h2 className="section-title">Mission Control</h2>
        <button className="button-ghost" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="card muted">
        What to do next: review recent Target Lead Groups, open approved previews, then work today&apos;s leads in Outreach.
      </div>

      {summary?.dailyMission ? (
        <div className="card stack mission-panel">
          <div className="topbar" style={{ marginBottom: 0 }}>
            <div>
              <h3 className="section-title">Today&apos;s Mission</h3>
              <div className="muted">
                {summary.dailyMission.progress.completedToday} actions completed against{" "}
                {summary.dailyMission.progress.totalToday} open mission items.
              </div>
            </div>
            <PillBadge value={`${summary.dailyMission.progress.percent}% complete`} />
          </div>
          <div className="mission-grid">
            {summary.dailyMission.cards.map((card) => (
              <div key={card.id} className={`mission-card ${card.urgency}`}>
                <div className="mission-count">{card.count}</div>
                <div>
                  <b>{card.title}</b>
                  <div className="muted">Urgency: {card.urgency}</div>
                </div>
                <Link className="button-link" to={card.route}>{card.actionLabel}</Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {summary?.recovery?.warningCount ? (
        <div className="card stack warning-card">
          <div className="topbar" style={{ marginBottom: 0 }}>
            <div>
              <h3 className="section-title">Recovery Warnings</h3>
              <div className="muted">
                {summary.recovery.warningCount} warning(s), {summary.recovery.criticalCount} critical.
              </div>
            </div>
            <Link className="button-link" to="/settings">Open Recovery Queue</Link>
          </div>
          {summary.recovery.recommendations?.slice(0, 3).map((item) => (
            <div key={item.id} className="velocity-action">
              <span>{item.businessName ? `${item.businessName}: ` : ""}{item.message}</span>
              <PillBadge value={item.severity} />
            </div>
          ))}
        </div>
      ) : null}

      {summary?.autopilot ? (
        <div className="card stack">
          <div className="topbar" style={{ marginBottom: 0 }}>
            <div>
              <h3 className="section-title">Autopilot</h3>
              <div className="muted">
                {summary.autopilot.enabled ? "Running scheduled discovery" : "Paused"} ·{" "}
                {summary.autopilot.running ? "job in progress" : "idle"}
              </div>
            </div>
            <PillBadge value={summary.autopilot.enabled ? "on" : "off"} />
          </div>
          <div className="grid-cards compact-cards">
            <div className="card"><h4>Last Run</h4><div className="value">{summary.autopilot.lastRun?.status ?? "none"}</div></div>
            <div className="card"><h4>Next Run</h4><div className="value">{summary.autopilot.nextRunAt ? new Date(summary.autopilot.nextRunAt).toLocaleTimeString() : "paused"}</div></div>
            <div className="card"><h4>Opps Today</h4><div className="value">{summary.autopilot.opportunitiesFoundToday}</div></div>
            <div className="card"><h4>Previews Today</h4><div className="value">{summary.autopilot.previewsGeneratedToday}</div></div>
          </div>
          {summary.autopilot.errorsToday?.length || summary.autopilot.warnings?.length ? (
            <div className="muted">
              Warnings/errors: {[...(summary.autopilot.warnings ?? []), ...(summary.autopilot.errorsToday ?? [])].slice(0, 3).join(" | ")}
            </div>
          ) : null}
          <div className="btn-row">
            <button disabled={busyLeadId === "autopilot"} onClick={() => act("autopilot", () => api.runAutopilotNow(), "Autopilot run completed.")}>Run Autopilot Now</button>
            <button disabled={busyLeadId === "autopilot"} onClick={() => act("autopilot", () => api.pauseAutopilot(), "Autopilot paused.")}>Pause Autopilot</button>
            <Link className="button-link" to="/autopilot">Configure</Link>
            <Link className="button-link" to="/opportunities">Open Opportunity Inbox</Link>
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="grid-cards">
          <div className="card"><h4>Total Leads</h4><div className="value">{summary.totalLeads}</div></div>
          <div className="card"><h4>TARGET</h4><div className="value">{summary.targetLeads}</div></div>
          <div className="card"><h4>HOLD</h4><div className="value">{summary.holdLeads}</div></div>
          <div className="card"><h4>SKIP</h4><div className="value">{summary.skipLeads}</div></div>
          <div className="card"><h4>Contacted</h4><div className="value">{summary.leadsContacted}</div></div>
          <div className="card"><h4>Replied</h4><div className="value">{summary.leadsReplied}</div></div>
          <div className="card"><h4>Won</h4><div className="value">{summary.leadsWon}</div></div>
          <div className="card"><h4>Lost</h4><div className="value">{summary.leadsLost}</div></div>
          <div className="card"><h4>Due Today</h4><div className="value">{summary.outreachDueToday ?? 0}</div></div>
          <div className="card"><h4>Overdue</h4><div className="value">{summary.overdueFollowUps ?? 0}</div></div>
          <div className="card"><h4>Need Previews</h4><div className="value">{summary.leadsNeedingPreviews ?? 0}</div></div>
          <div className="card"><h4>Approved, Not Contacted</h4><div className="value">{summary.approvedAwaitingContact ?? 0}</div></div>
          <div className="card"><h4>Active Groups</h4><div className="value">{summary.activeTargetLeadGroups ?? 0}</div></div>
        </div>
      ) : null}

      {summary?.nextBestActions?.length ? (
        <div className="card stack">
          <h3 className="section-title">Next Best Actions</h3>
          <div className="stack">
            {summary.nextBestActions.map((action) => (
              <div key={action.label} className="velocity-action">
                <span>{action.label}</span>
                <Link className="button-link" to={action.route}>Open</Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {summary?.operatorAnalytics ? (
        <div className="card stack">
          <h3 className="section-title">Operator Analytics</h3>
          <div className="grid-cards compact-cards">
            <div className="card"><h4>Contacted Today</h4><div className="value">{summary.operatorAnalytics.contactedToday}</div></div>
            <div className="card"><h4>Replies Today</h4><div className="value">{summary.operatorAnalytics.repliesToday}</div></div>
            <div className="card"><h4>Follow-Ups Done</h4><div className="value">{summary.operatorAnalytics.followUpsCompletedToday}</div></div>
            <div className="card"><h4>Win Rate</h4><div className="value">{summary.operatorAnalytics.winRate}%</div></div>
            <div className="card"><h4>Reply Rate</h4><div className="value">{summary.operatorAnalytics.outreachConversion}%</div></div>
            <div className="card"><h4>Approved Previews</h4><div className="value">{summary.operatorAnalytics.previewsApprovedRate}%</div></div>
            <div className="card"><h4>Backlog</h4><div className="value">{summary.operatorAnalytics.outreachBacklogCount}</div></div>
          </div>
        </div>
      ) : null}

      {summary?.dealPipeline ? (
        <div className="card stack">
          <h3 className="section-title">Active Deal Pipeline</h3>
          <div className="grid-cards compact-cards">
            <div className="card"><h4>Active Deals</h4><div className="value">{summary.dealPipeline.activeDeals}</div></div>
            <div className="card"><h4>Estimated Value</h4><div className="value">${summary.dealPipeline.estimatedValue}</div></div>
            <div className="card"><h4>Weighted Value</h4><div className="value">${summary.dealPipeline.weightedValue}</div></div>
          </div>
          {summary.dealPipeline.likelyClosesThisWeek?.length ? (
            <div className="stack">
              <b>Likely closes this week</b>
              {summary.dealPipeline.likelyClosesThisWeek.map((deal) => (
                <div key={deal.id} className="velocity-action">
                  <Link to={`/leads/${deal.id}`}>{deal.businessName}</Link>
                  <span className="muted">${deal.estimatedDealValue} · {deal.closeProbability}%</span>
                </div>
              ))}
            </div>
          ) : <div className="muted">No likely closes scheduled this week.</div>}
        </div>
      ) : null}

      {summary?.performanceIntelligence ? (
        <div className="card stack">
          <h3 className="section-title">Performance Intelligence</h3>
          <div className="grid-cards compact-cards">
            {summary.performanceIntelligence.trendCards.map((card) => (
              <div className="card" key={card.label}><h4>{card.label}</h4><div className="value">{card.value}</div></div>
            ))}
          </div>
          <div className="split-two">
            <div className="card stack">
              <b>Best Niches</b>
              {(summary.performanceIntelligence.bestNiches ?? []).map((item) => (
                <div key={item.name} className="muted">{item.name}: {item.replyRate}% reply · {item.won} won</div>
              ))}
            </div>
            <div className="card stack">
              <b>Best Cities</b>
              {(summary.performanceIntelligence.bestCities ?? []).map((item) => (
                <div key={item.name} className="muted">{item.name}: {item.replyRate}% reply · {item.won} won</div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {summary?.reactivationQueue?.length ? (
        <div className="card stack">
          <h3 className="section-title">Reactivation Queue</h3>
          {summary.reactivationQueue.slice(0, 6).map((item) => (
            <div key={item.id} className="velocity-action">
              <span>
                <Link to={`/leads/${item.id}`}>{item.businessName}</Link> · {item.reason}
                <span className="muted"> · {item.suggestedAction}</span>
              </span>
              <Link className="button-link" to="/outreach">Work</Link>
            </div>
          ))}
        </div>
      ) : null}

      <div className="card">
        <h3 className="section-title">Latest Generated Previews</h3>
        {summary?.latestGeneratedPreviews?.length ? (
          <div className="stack">
            {summary.latestGeneratedPreviews.map((item) => (
              <div key={item.id} className="muted">
                <Link to={`/leads/${item.id}`}>{item.businessName}</Link> · {item.previewStatus}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No previews generated yet.</p>
        )}
      </div>

      <div className="card">
        <h3 className="section-title">Recent Target Lead Groups</h3>
        {summary?.recentTargetLeadGroups?.length ? (
          <div className="stack">
            {summary.recentTargetLeadGroups.map((group) => (
              <div key={group.id} className="card">
                <div className="topbar" style={{ marginBottom: 0 }}>
                  <div>
                    <Link to={`/targets/${group.id}`}>
                      <b>{group.title}</b>
                    </Link>
                    <div className="muted">
                      Qualified {group.qualified} · Contacted {group.contacted} · Replied{" "}
                      {group.replied} · Won {group.won}
                    </div>
                  </div>
                  <Link className="button-link" to={`/targets/${group.id}`}>
                    View Group
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No saved Target Lead Groups yet.</p>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Business</th>
              <th>City</th>
              <th>Category</th>
              <th>Website Status</th>
              <th>Score</th>
              <th>Status</th>
              <th>Pipeline</th>
              <th>Preview</th>
                <th>Priority</th>
              <th>Last Contacted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const busy = busyLeadId === lead.id;
              return (
                <tr key={lead.id}>
                  <td>{lead.businessName}</td>
                  <td>{lead.city}</td>
                  <td>{lead.category}</td>
                  <td>{lead.websiteQuality ?? (lead.websiteUrl ? "has_site" : "no_site")}</td>
                  <td>{lead.score}</td>
                  <td><StatusBadge status={lead.status} /></td>
                    <td><PillBadge value={lead.pipelineStage} /></td>
                    <td><PillBadge value={lead.previewStatus} /></td>
                  <td>
                    {lead.preview?.desktopRenderUrl ? (
                      <img className="thumb-shot" src={lead.preview.desktopRenderUrl} alt="" />
                    ) : null}
                    <PillBadge value={lead.outreachPriority} />
                    {lead.likelyFranchise ? <div><PillBadge value="chain warning" /></div> : null}
                  </td>
                  <td>{lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleString() : "—"}</td>
                  <td>
                    <div className="btn-row">
                      <Link className="button-link" to={`/leads/${lead.id}`}>View</Link>
                      <button disabled={busy} title={busy ? "Another action is running for this lead." : ""} onClick={() => act(lead.id, () => api.generatePreview(lead.id), "Preview generated.")}>Generate</button>
                      <Link className="button-link" to={`/leads/${lead.id}/preview`}>Preview</Link>
                      <button disabled={busy} title={busy ? "Another action is running for this lead." : ""} onClick={() => act(lead.id, () => api.patchLead(lead.id, { pipelineStage: "contacted", replyStatus: "contacted", contactedAt: new Date().toISOString() }), "Lead marked contacted.")}>Contacted</button>
                      <button disabled={busy} title={busy ? "Another action is running for this lead." : ""} onClick={() => act(lead.id, () => api.patchLead(lead.id, { pipelineStage: "replied", replyStatus: "replied" }), "Lead marked replied.")}>Replied</button>
                      <button disabled={busy} title={busy ? "Another action is running for this lead." : ""} onClick={() => act(lead.id, () => api.patchLead(lead.id, { pipelineStage: "won", replyStatus: "won" }), "Lead marked won.")}>Won</button>
                      <button disabled={busy} title={busy ? "Another action is running for this lead." : ""} onClick={() => act(lead.id, () => api.patchLead(lead.id, { pipelineStage: "lost", replyStatus: "lost" }), "Lead marked lost.")}>Lost</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeadGenerationPage() {
  const navigate = useNavigate();
  const [runTitle, setRunTitle] = useState("");
  const [searchTerm, setSearchTerm] = useState("tree service");
  const [city, setCity] = useState("Beaumont");
  const [state, setState] = useState("TX");
  const [zipCode, setZipCode] = useState("");
  const [searchRadiusMiles, setSearchRadiusMiles] = useState("");
  const [maxResults, setMaxResults] = useState(15);
  const [runMode, setRunMode] = useState("research_score_enrich");
  const [excludedNichesText, setExcludedNichesText] = useState(
    "franchise, national chain, corporate office"
  );
  const [filters, setFilters] = useState({
    websiteStatus: "weak_or_missing",
    excludeStrongWebsites: true,
    minScore: 15,
    minReviews: 10,
    minRating: 4.0,
    mustHavePhone: true,
    mustHaveWebsite: false,
    mustHaveEmail: false,
    mustHaveSocialPresence: false,
    excludeDuplicates: true,
    excludeChains: true,
  });
  const [opportunitySignals, setOpportunitySignals] = useState({
    missingCTA: false,
    noBookingForm: false,
    noMobileFriendlySignal: false,
    lowTrustSignals: false,
    weakHomepageCopy: false,
    noBeforeAfterGallery: false,
    noServiceAreaPage: false,
    noReviewsTestimonialsShown: false,
    noGoogleBusinessProfileWebsiteLink: false,
  });
  const [outreachReadiness, setOutreachReadiness] = useState({
    hasPhone: false,
    hasEmail: false,
    hasFacebookPage: false,
    hasInstagramPage: false,
    enoughPublicInfoForPersonalization: true,
    enoughInfoForPreview: true,
  });
  const [previewSettings, setPreviewSettings] = useState({
    autoGeneratePreview: false,
    autoPrepareAssets: false,
    autoRenderScreenshots: false,
    useAIImagesWhenRealImagesLowConfidence: true,
    requireApprovalBeforeOutreach: true,
  });
  const [runId, setRunId] = useState("");
  const [run, setRun] = useState(null);
  const [runModes, setRunModes] = useState([]);
  const [workload, setWorkload] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const parseExcludedNiches = () =>
    excludedNichesText
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

  const buildConfigPayload = () => ({
    runTitle,
    searchTerm,
    city,
    state,
    zipCode,
    searchRadiusMiles:
      searchRadiusMiles === "" || Number.isNaN(Number(searchRadiusMiles))
        ? null
        : Number(searchRadiusMiles),
    maxResults: Number(maxResults),
    runMode,
    filters: {
      ...filters,
      minScore: Number(filters.minScore),
      minReviews: Number(filters.minReviews),
      minRating: Number(filters.minRating),
      excludedNiches: parseExcludedNiches(),
    },
    opportunitySignals,
    outreachReadiness,
    previewSettings,
  });

  useEffect(() => {
    const presetRaw = window.localStorage.getItem("leadGenerationPreset");
    if (presetRaw) {
      try {
        const preset = JSON.parse(presetRaw);
        setRunTitle(`${preset.title ?? "Duplicated Target Lead Group"} - rerun`);
        setSearchTerm(preset.searchTerm ?? "tree service");
        setCity(preset.city ?? "Beaumont");
        setState(preset.state ?? "TX");
        setRunMode(preset.runMode ?? "research_score_enrich");
        if (preset.filters) {
          setFilters((current) => ({ ...current, ...preset.filters }));
          setExcludedNichesText((preset.filters.excludedNiches ?? []).join(", "));
        }
        if (preset.previewSettings) {
          setPreviewSettings((current) => ({ ...current, ...preset.previewSettings }));
        }
      } catch {
        // Ignore invalid saved preset.
      }
      window.localStorage.removeItem("leadGenerationPreset");
    }
    api
      .leadGenerationRunModes()
      .then((data) => setRunModes(data?.runModes ?? []))
      .catch(() => setRunModes([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const next = await api.leadGenerationWorkload(buildConfigPayload());
        setWorkload(next);
      } catch {
        setWorkload(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [
    runTitle,
    searchTerm,
    city,
    state,
    zipCode,
    searchRadiusMiles,
    maxResults,
    runMode,
    excludedNichesText,
    filters,
    opportunitySignals,
    outreachReadiness,
    previewSettings,
  ]);

  useEffect(() => {
    if (runMode !== "full_preview_package") {
      setPreviewSettings((prev) => ({
        ...prev,
        autoGeneratePreview: false,
        autoPrepareAssets: false,
        autoRenderScreenshots: false,
      }));
    }
  }, [runMode]);

  const launch = async () => {
    setBusy(true);
    setError("");
    setRun(null);
    if (!runTitle.trim()) {
      setError("Run Title is required.");
      notify("Run Title is required before launching lead generation.", "error");
      setBusy(false);
      return;
    }
    try {
      const started = await api.discover(buildConfigPayload());
      setRunId(started.runId);
      notify("Lead generation run started.");
    } catch (err) {
      setError(err.message);
      notify(err.message || "Failed to start lead generation.", "error");
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!runId) return;
    let alive = true;
    const tick = async () => {
      try {
        const data = await api.discoverRun(runId);
        if (!alive) return;
        setRun(data);
        if (data.status === "completed" || data.status === "failed") {
          notify(
            data.status === "completed"
              ? "Lead generation run completed."
              : data.error || "Lead generation run failed.",
            data.status === "completed" ? "success" : "error"
          );
          setBusy(false);
          return;
        }
      } catch {
        notify("Lost connection while polling lead generation status.", "error");
        if (alive) setBusy(false);
      }
      if (alive) setTimeout(tick, 1600);
    };
    tick();
    return () => {
      alive = false;
    };
  }, [runId]);

  const selectedMode =
    runModes.find((mode) => mode.id === runMode) ??
    ({ id: runMode, description: "Custom run mode" });

  const previewModeLocked = runMode !== "full_preview_package";
  const rejectedLeads = run?.rejectedLeads ?? [];
  const liveLogs = run?.logs ?? [];

  return (
    <div className="stack">
      <div className="topbar">
        <h2 className="section-title">Lead Generation</h2>
        <div className="btn-row">
          <button className="button-ghost" onClick={() => navigate("/lead-generation/runs")}>
            View Saved Runs
          </button>
          <button className="button-ghost" onClick={() => navigate("/leads/new")}>
            Create Manual Lead
          </button>
        </div>
      </div>
      <div className="card muted">
        What to do next: name the run, choose filters that match your offer, then run discovery. Completed runs save as Target Lead Groups.
      </div>

      <div className="card stack">
        <h3 className="section-title">Lead Search Filter Panel</h3>
        <div className="detail-grid">
          <div className="field">
            <label>Run Title</label>
            <input
              value={runTitle}
              onChange={(e) => setRunTitle(e.target.value)}
              placeholder="Houston Pressure Washing - Weak Websites"
            />
          </div>
          <div className="field">
            <label>Primary niche / search term</label>
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="field">
            <label>City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label>State</label>
            <input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
          </div>
          <div className="field">
            <label>ZIP code (optional)</label>
            <input value={zipCode} disabled onChange={(e) => setZipCode(e.target.value)} />
            <div className="muted">Disabled until ZIP/radius search is implemented.</div>
          </div>
          <div className="field">
            <label>Search radius miles (optional)</label>
            <input
              type="number"
              min={1}
              max={500}
              value={searchRadiusMiles}
              disabled
              onChange={(e) => setSearchRadiusMiles(e.target.value)}
            />
            <div className="muted">Disabled until Google Maps radius queries are implemented.</div>
          </div>
          <div className="field">
            <label>Max results</label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxResults}
              onChange={(e) => setMaxResults(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Excluded niches (comma separated)</label>
            <input
              value={excludedNichesText}
              onChange={(e) => setExcludedNichesText(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Website filter</label>
            <select
              value={filters.websiteStatus}
              onChange={(e) => setFilters((f) => ({ ...f, websiteStatus: e.target.value }))}
            >
              <option value="any">Any website status</option>
              <option value="missing_only">Only no website</option>
              <option value="weak_only">Only weak websites</option>
              <option value="weak_or_missing">Weak or missing websites</option>
              <option value="exclude_strong">Exclude strong websites</option>
            </select>
          </div>
          <div className="field">
            <label>Minimum score</label>
            <input
              type="number"
              min={0}
              max={30}
              value={filters.minScore}
              onChange={(e) => setFilters((f) => ({ ...f, minScore: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Minimum review count</label>
            <input
              type="number"
              min={0}
              value={filters.minReviews}
              onChange={(e) => setFilters((f) => ({ ...f, minReviews: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Minimum star rating</label>
            <input
              type="number"
              min={0}
              max={5}
              step="0.1"
              value={filters.minRating}
              onChange={(e) => setFilters((f) => ({ ...f, minRating: e.target.value }))}
            />
          </div>
        </div>

        <div className="checkbox-grid">
          <label className="checkline">
            <input
              type="checkbox"
              checked={filters.excludeStrongWebsites}
              onChange={(e) => setFilters((f) => ({ ...f, excludeStrongWebsites: e.target.checked }))}
            />
            Exclude strong websites
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={filters.mustHavePhone}
              onChange={(e) => setFilters((f) => ({ ...f, mustHavePhone: e.target.checked }))}
            />
            Must have phone number
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={filters.mustHaveWebsite}
              onChange={(e) => setFilters((f) => ({ ...f, mustHaveWebsite: e.target.checked }))}
            />
            Must have website
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={filters.mustHaveEmail}
              onChange={(e) => setFilters((f) => ({ ...f, mustHaveEmail: e.target.checked }))}
            />
            Must have email if found
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={filters.mustHaveSocialPresence}
              onChange={(e) =>
                setFilters((f) => ({ ...f, mustHaveSocialPresence: e.target.checked }))
              }
            />
            Must have social presence
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={filters.excludeDuplicates}
              onChange={(e) => setFilters((f) => ({ ...f, excludeDuplicates: e.target.checked }))}
            />
            Exclude duplicates
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={filters.excludeChains}
              onChange={(e) => setFilters((f) => ({ ...f, excludeChains: e.target.checked }))}
            />
            Exclude likely franchises/chains
          </label>
        </div>
      </div>

      <div className="card stack">
        <h3 className="section-title">Opportunity + Outreach Readiness Filters</h3>
        <div className="checkbox-grid">
          <label className="checkline"><input type="checkbox" checked={opportunitySignals.missingCTA} onChange={(e) => setOpportunitySignals((s) => ({ ...s, missingCTA: e.target.checked }))} />Missing clear CTA</label>
          <label className="checkline"><input type="checkbox" checked={opportunitySignals.noBookingForm} onChange={(e) => setOpportunitySignals((s) => ({ ...s, noBookingForm: e.target.checked }))} />No visible booking form</label>
          <label className="checkline"><input type="checkbox" checked={opportunitySignals.noMobileFriendlySignal} onChange={(e) => setOpportunitySignals((s) => ({ ...s, noMobileFriendlySignal: e.target.checked }))} />No mobile-friendly signal</label>
          <label className="checkline"><input type="checkbox" checked={opportunitySignals.lowTrustSignals} onChange={(e) => setOpportunitySignals((s) => ({ ...s, lowTrustSignals: e.target.checked }))} />Low trust signals</label>
          <label className="checkline"><input type="checkbox" checked={opportunitySignals.weakHomepageCopy} onChange={(e) => setOpportunitySignals((s) => ({ ...s, weakHomepageCopy: e.target.checked }))} />Weak homepage copy</label>
          <label className="checkline"><input type="checkbox" checked={opportunitySignals.noBeforeAfterGallery} onChange={(e) => setOpportunitySignals((s) => ({ ...s, noBeforeAfterGallery: e.target.checked }))} />No before/after gallery</label>
          <label className="checkline"><input type="checkbox" checked={opportunitySignals.noServiceAreaPage} onChange={(e) => setOpportunitySignals((s) => ({ ...s, noServiceAreaPage: e.target.checked }))} />No service area page</label>
          <label className="checkline"><input type="checkbox" checked={opportunitySignals.noReviewsTestimonialsShown} onChange={(e) => setOpportunitySignals((s) => ({ ...s, noReviewsTestimonialsShown: e.target.checked }))} />No reviews/testimonials shown</label>
          <label className="checkline"><input type="checkbox" checked={opportunitySignals.noGoogleBusinessProfileWebsiteLink} onChange={(e) => setOpportunitySignals((s) => ({ ...s, noGoogleBusinessProfileWebsiteLink: e.target.checked }))} />No GBP website link</label>
          <label className="checkline"><input type="checkbox" checked={outreachReadiness.hasPhone} onChange={(e) => setOutreachReadiness((r) => ({ ...r, hasPhone: e.target.checked }))} />Outreach ready: has phone</label>
          <label className="checkline"><input type="checkbox" checked={outreachReadiness.hasEmail} onChange={(e) => setOutreachReadiness((r) => ({ ...r, hasEmail: e.target.checked }))} />Outreach ready: has email</label>
          <label className="checkline"><input type="checkbox" checked={outreachReadiness.hasFacebookPage} onChange={(e) => setOutreachReadiness((r) => ({ ...r, hasFacebookPage: e.target.checked }))} />Has Facebook page</label>
          <label className="checkline"><input type="checkbox" checked={outreachReadiness.hasInstagramPage} onChange={(e) => setOutreachReadiness((r) => ({ ...r, hasInstagramPage: e.target.checked }))} />Has Instagram page</label>
          <label className="checkline"><input type="checkbox" checked={outreachReadiness.enoughPublicInfoForPersonalization} onChange={(e) => setOutreachReadiness((r) => ({ ...r, enoughPublicInfoForPersonalization: e.target.checked }))} />Enough info to personalize outreach</label>
          <label className="checkline"><input type="checkbox" checked={outreachReadiness.enoughInfoForPreview} onChange={(e) => setOutreachReadiness((r) => ({ ...r, enoughInfoForPreview: e.target.checked }))} />Enough info to generate preview</label>
        </div>
      </div>

      <div className="card stack">
        <h3 className="section-title">Preview Settings + Run Mode</h3>
        <div className="field">
          <label>Agent run mode</label>
          <select value={runMode} onChange={(e) => setRunMode(e.target.value)}>
            <option value="research_only">Research only</option>
            <option value="research_score">Research + score</option>
            <option value="research_score_enrich">Research + score + enrich</option>
            <option value="full_preview_package">Full preview package</option>
          </select>
          <div className="muted">{selectedMode.description}</div>
        </div>

        <div className="checkbox-grid">
          <label className="checkline">
            <input
              type="checkbox"
              checked={previewSettings.autoGeneratePreview}
              disabled={previewModeLocked}
              onChange={(e) =>
                setPreviewSettings((p) => ({ ...p, autoGeneratePreview: e.target.checked }))
              }
            />
            Auto generate previews
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={previewSettings.autoPrepareAssets}
              disabled={previewModeLocked || !previewSettings.autoGeneratePreview}
              onChange={(e) =>
                setPreviewSettings((p) => ({ ...p, autoPrepareAssets: e.target.checked }))
              }
            />
            Auto prepare assets
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={previewSettings.autoRenderScreenshots}
              disabled={previewModeLocked || !previewSettings.autoGeneratePreview}
              onChange={(e) =>
                setPreviewSettings((p) => ({ ...p, autoRenderScreenshots: e.target.checked }))
              }
            />
            Auto render screenshots
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={previewSettings.useAIImagesWhenRealImagesLowConfidence}
              onChange={(e) =>
                setPreviewSettings((p) => ({
                  ...p,
                  useAIImagesWhenRealImagesLowConfidence: e.target.checked,
                }))
              }
            />
            Use AI images when real images are low confidence
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={previewSettings.requireApprovalBeforeOutreach}
              onChange={(e) =>
                setPreviewSettings((p) => ({
                  ...p,
                  requireApprovalBeforeOutreach: e.target.checked,
                }))
              }
            />
            Require approval before outreach
          </label>
        </div>

        <div className="card">
          <h4>Estimated workload</h4>
          {workload ? (
            <div className="stack">
              <div className="muted">{workload.modeDescription}</div>
              <div className="muted">Estimated candidates: {workload.estimatedCandidates}</div>
              <div className="muted">Pipeline: {(workload.estimatedSteps ?? []).join(" -> ")}</div>
            </div>
          ) : (
            <div className="muted">Fill filters to calculate workload estimate.</div>
          )}
        </div>

        <button className="button-primary" onClick={launch} disabled={busy}>
          {busy ? "Running..." : "Run Lead Generation"}
        </button>
        {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
      </div>

      <div className="card stack">
        <h3 className="section-title">Run Status</h3>
        {run ? (
          <div className="muted">
            Status: <span className="badge small">{run.status}</span>
          </div>
        ) : (
          <div className="muted">No run started yet.</div>
        )}
        <div className="log-box">
          {liveLogs.map((log, i) => (
            <div key={i}>
              [{new Date(log.at).toLocaleTimeString()}] {log.step}: {log.message}
            </div>
          ))}
        </div>
        {run?.summary ? (
          <div className="muted">
            Discovered {run.summary.discovered}, Enriched {run.summary.enriched}, Qualified{" "}
            {run.summary.qualified}, Rejected {run.summary.rejected}, Previews{" "}
            {run.summary.previewsGenerated}, Assets {run.summary.assetsPrepared}, Screenshots{" "}
            {run.summary.screenshotsRendered}
          </div>
        ) : null}
        {run?.targetLeadGroup?.id ? (
          <Link className="button-link" to={`/targets/${run.targetLeadGroup.id}`}>
            View Saved Target Lead Group
          </Link>
        ) : null}
      </div>

      <div className="card stack">
        <h3 className="section-title">Rejected Leads (with reasons)</h3>
        {!rejectedLeads.length ? (
          <div className="muted">No rejected leads in this run.</div>
        ) : (
          <div className="stack">
            {rejectedLeads.map((item, idx) => (
              <div key={`${item.lead?.businessName ?? "lead"}-${idx}`} className="card">
                <div>
                  <b>{item.lead?.businessName ?? "Unknown business"}</b> · {item.lead?.city} ·{" "}
                  {item.lead?.category}
                </div>
                <div className="muted">Reason(s): {(item.reasons ?? []).join(" | ")}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LeadDetailPage() {
  const { id } = useParams();
  const [lead, setLead] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState({ subject: "", body: "" });
  const [salesSupport, setSalesSupport] = useState(null);
  const [customImageSlot, setCustomImageSlot] = useState("hero");
  const [deal, setDeal] = useState({
    dealStage: "discovery",
    dealNotes: "",
    estimatedDealValue: "",
    expectedCloseDate: "",
    closeProbability: "",
    serviceType: "",
    websitePackageType: "",
    assignedTo: "",
    ownedBy: "",
  });
  const [memory, setMemory] = useState({
    interactionSummary: "",
    objections: "",
    preferredContactMethod: "",
    bestOutreachAngle: "",
    closeBlockers: "",
  });
  const [outreach, setOutreach] = useState({
    channel: "email",
    replyStatus: "contacted",
    followUpNeeded: false,
    nextFollowUpAt: "",
    notes: "",
  });

  const load = async () => {
    const [data, sales] = await Promise.all([api.lead(id), api.salesSupport(id)]);
    setLead(data);
    setSalesSupport(sales);
    setNotes(data.notes ?? "");
    setDeal({
      dealStage: data.dealStage ?? "discovery",
      dealNotes: data.dealNotes ?? "",
      estimatedDealValue: data.estimatedDealValue ?? "",
      expectedCloseDate: toDateInput(data.expectedCloseDate),
      closeProbability: data.closeProbability ?? "",
      serviceType: data.serviceType ?? "",
      websitePackageType: data.websitePackageType ?? "",
      assignedTo: data.assignedTo ?? "",
      ownedBy: data.ownedBy ?? "",
    });
    setMemory({
      interactionSummary: data.interactionSummary ?? "",
      objections: data.objections ?? "",
      preferredContactMethod: data.preferredContactMethod ?? "",
      bestOutreachAngle: data.bestOutreachAngle ?? "",
      closeBlockers: data.closeBlockers ?? "",
    });
  };

  useEffect(() => {
    load();
  }, [id]);

  const run = async (fn, successMessage = "Action completed.") => {
    setBusy(true);
    try {
      await fn();
      await load();
      notify(successMessage);
    } catch (err) {
      notify(err.message || "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const uploadCustomImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await run(async () => {
      const dataUrl = await fileToDataUrl(file);
      await api.uploadCustomImage(lead.id, {
        slot: customImageSlot,
        filename: file.name,
        dataUrl,
      });
    }, "Custom image saved into preview assets.");
  };

  if (!lead) return <div className="muted">Loading lead...</div>;

  return (
    <div className="stack">
      <div className="topbar">
        <h2 className="section-title">{lead.businessName}</h2>
        <div className="btn-row">
          <Link className="button-link" to={`/leads/${lead.id}/preview`}>Open Preview Page</Link>
          <button title={busy ? "A lead action is already running." : ""} onClick={() => run(() => api.generatePreview(lead.id), "Preview generated.")} disabled={busy}>Generate/Refresh Preview</button>
          <button title={busy ? "A lead action is already running." : ""} onClick={() => run(() => api.prepareAssets(lead.id), "Assets prepared.")} disabled={busy}>Prepare Assets</button>
          <button title={busy ? "A lead action is already running." : ""} onClick={() => run(() => api.renderPreview(lead.id), "Screenshots rendered.")} disabled={busy}>Render Screenshots</button>
          <button title={busy ? "A lead action is already running." : ""} onClick={() => run(async () => { const d = await api.outreachDraft(lead.id); setDraft(d); }, "Outreach draft generated.")} disabled={busy}>Generate Outreach Draft</button>
          <button title={busy ? "A lead action is already running." : ""} onClick={() => run(() => api.saveDemoProject(lead.id), "Demo project saved.")} disabled={busy}>Save Demo Project</button>
          <button
            title={
              busy
                ? "A lead action is already running."
                : !(lead.pipelineStage === "won" || lead.replyStatus === "won" || lead.dealStage === "won")
                  ? "Only won deals can become clients."
                  : ""
            }
            onClick={() => run(() => api.convertLeadToClient(lead.id, {
              plan: deal.websitePackageType || deal.serviceType || "maintenance",
            }), "Won deal converted to client.")}
            disabled={busy || !(lead.pipelineStage === "won" || lead.replyStatus === "won" || lead.dealStage === "won")}
          >
            Convert to Client
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card stack">
          <h3 className="section-title">Business Profile</h3>
          <div><b>City:</b> {lead.city}</div>
          <div><b>Category:</b> {lead.category}</div>
          <div><b>Phone:</b> {lead.phone || "—"}</div>
          <div><b>Website:</b> {lead.websiteUrl || "—"}</div>
          <div><b>Website quality:</b> {lead.websiteQuality || "unknown"}</div>
          <div><b>Social evidence:</b> {String(Boolean(lead.socialEvidence))}</div>
          <div><b>Outreach angle:</b> {lead.outreachAngle}</div>
          <div><b>Pipeline:</b> <PillBadge value={lead.pipelineStage} /></div>
          <div><b>Preview status:</b> <PillBadge value={lead.previewStatus} /></div>
          <div><b>Reply status:</b> <PillBadge value={lead.replyStatus} /></div>
          <div><b>Deal stage:</b> <PillBadge value={lead.dealStage} /></div>
          <div><b>Assigned:</b> {lead.assignedTo || "Unassigned"}</div>
        </div>

        <div className="card stack">
          <h3 className="section-title">Score Breakdown</h3>
          {(lead.scoreBreakdown ?? []).map((item, idx) => (
            <div key={idx}>- {item.rule}: +{item.points}</div>
          ))}
          <div><b>Total:</b> {lead.score} ({lead.status})</div>
        </div>

        <div className="card stack">
          <h3 className="section-title">Preview + Renders</h3>
          <div><b>Preview:</b> {lead.preview?.previewUrl ? <a href={lead.preview.previewUrl} target="_blank">Open</a> : "not generated"}</div>
          <div><b>Desktop screenshot:</b> {lead.preview?.desktopRenderUrl ? <a href={lead.preview.desktopRenderUrl} target="_blank">Open</a> : "not rendered"}</div>
          <div><b>Mobile screenshot:</b> {lead.preview?.mobileRenderUrl ? <a href={lead.preview.mobileRenderUrl} target="_blank">Open</a> : "not rendered"}</div>
        </div>

        <div id="custom-images" className="card stack">
          <h3 className="section-title">Custom Images</h3>
          <div className="muted">
            If OpenAI is missing or image generation fails, upload a local image and it will replace the selected preview slot.
          </div>
          <div className="field">
            <label>Preview image slot</label>
            <select value={customImageSlot} onChange={(e) => setCustomImageSlot(e.target.value)}>
              <option value="hero">hero</option>
              <option value="support">support/trust</option>
              <option value="cta">final CTA</option>
              <option value="gallery">gallery</option>
            </select>
          </div>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadCustomImage} disabled={busy} />
        </div>

        <div className="card stack">
          <h3 className="section-title">Operator Memory</h3>
          <div>{lead.operatorMemorySummary}</div>
          <div className="muted">This updates from the memory fields below and travels with the lead.</div>
        </div>
      </div>

      <div className="card stack">
        <h3 className="section-title">Deal Pipeline</h3>
        <div className="detail-grid">
          <div className="field">
            <label>Deal stage</label>
            <select value={deal.dealStage} onChange={(e) => setDeal((d) => ({ ...d, dealStage: e.target.value }))}>
              {["discovery", "contacted", "replied", "interested", "quoting", "negotiating", "won", "onboarding", "fulfilled", "retained", "lost"].map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Estimated deal value</label>
            <input value={deal.estimatedDealValue} onChange={(e) => setDeal((d) => ({ ...d, estimatedDealValue: e.target.value }))} />
          </div>
          <div className="field">
            <label>Expected close date</label>
            <input type="date" value={deal.expectedCloseDate} onChange={(e) => setDeal((d) => ({ ...d, expectedCloseDate: e.target.value }))} />
          </div>
          <div className="field">
            <label>Close probability %</label>
            <input value={deal.closeProbability} onChange={(e) => setDeal((d) => ({ ...d, closeProbability: e.target.value }))} />
          </div>
          <div className="field">
            <label>Service type</label>
            <input value={deal.serviceType} onChange={(e) => setDeal((d) => ({ ...d, serviceType: e.target.value }))} placeholder="Website rebuild, landing page, SEO support" />
          </div>
          <div className="field">
            <label>Website package type</label>
            <input value={deal.websitePackageType} onChange={(e) => setDeal((d) => ({ ...d, websitePackageType: e.target.value }))} placeholder="Standard, premium, landing page" />
          </div>
          <div className="field">
            <label>Assigned to</label>
            <input value={deal.assignedTo} onChange={(e) => setDeal((d) => ({ ...d, assignedTo: e.target.value }))} />
          </div>
          <div className="field">
            <label>Owned by</label>
            <input value={deal.ownedBy} onChange={(e) => setDeal((d) => ({ ...d, ownedBy: e.target.value }))} />
          </div>
        </div>
        <div className="field">
          <label>Deal notes</label>
          <textarea value={deal.dealNotes} onChange={(e) => setDeal((d) => ({ ...d, dealNotes: e.target.value }))} />
        </div>
        <button onClick={() => run(() => api.patchLead(lead.id, {
          ...deal,
          expectedCloseDate: deal.expectedCloseDate || null,
          activity: { type: "deal_update", summary: `Deal moved to ${deal.dealStage}` },
        }), "Deal pipeline saved.")} disabled={busy}>Save Deal Pipeline</button>
      </div>

      <div className="card stack">
        <h3 className="section-title">Proposal + Quote</h3>
        <div className="btn-row">
          <button onClick={() => run(() => api.generateProposal(lead.id, deal), "Proposal generated.")} disabled={busy}>Generate Proposal</button>
          <button onClick={() => run(() => api.patchLead(lead.id, { proposalStatus: "accepted", dealStage: "won", activity: { type: "proposal_accepted", summary: "Proposal accepted" } }), "Proposal accepted.")} disabled={busy || lead.proposalStatus === "not_generated"}>Mark Accepted</button>
          <button onClick={() => run(() => api.patchLead(lead.id, { proposalStatus: "rejected", activity: { type: "proposal_rejected", summary: "Proposal rejected" } }), "Proposal rejected.")} disabled={busy || lead.proposalStatus === "not_generated"}>Mark Rejected</button>
        </div>
        <div><b>Status:</b> <PillBadge value={lead.proposalStatus} /></div>
        {lead.currentProposal ? (
          <div className="card stack">
            <div><b>Summary:</b> {lead.currentProposal.summary}</div>
            <div><b>Pricing:</b> ${lead.currentProposal.pricingEstimate} · <b>Turnaround:</b> {lead.currentProposal.turnaround}</div>
            <div><b>Services:</b> {(lead.currentProposal.servicesIncluded ?? []).join(", ")}</div>
            <div><b>Deliverables:</b> {(lead.currentProposal.deliverables ?? []).join(", ")}</div>
            <div><b>Add-ons:</b> {(lead.currentProposal.optionalAddOns ?? []).join(", ")}</div>
          </div>
        ) : <div className="muted">No proposal generated yet.</div>}
        {(lead.proposalHistory ?? []).length ? (
          <details>
            <summary>Proposal history ({lead.proposalHistory.length})</summary>
            <div className="stack details-actions">
              {lead.proposalHistory.slice().reverse().map((proposal) => (
                <div key={proposal.id} className="card">
                  {proposal.generatedAt ? new Date(proposal.generatedAt).toLocaleString() : "Proposal"} · ${proposal.pricingEstimate} · {proposal.status}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      <div className="card stack">
        <h3 className="section-title">Sales Support</h3>
        {salesSupport ? (
          <>
            <div><b>Offer:</b> {salesSupport.offerFraming}</div>
            <div><b>Pitch:</b> {salesSupport.pitchScript}</div>
            <div><b>Close CTA:</b> {salesSupport.closeCta}</div>
            <div className="split-two">
              <div className="card stack">
                <b>Objection Handling</b>
                {(salesSupport.objectionHandling ?? []).map((item) => (
                  <div key={item.objection}>
                    <div><b>{item.objection}</b></div>
                    <div className="muted">{item.response}</div>
                  </div>
                ))}
              </div>
              <div className="card stack">
                <b>Follow-Up Scripts</b>
                {(salesSupport.followUpScripts ?? []).map((script, idx) => (
                  <div key={idx} className="muted">{script}</div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="muted">Loading sales support...</div>
        )}
      </div>

      <div className="card stack">
        <h3 className="section-title">Operator Memory</h3>
        <div className="detail-grid">
          <div className="field">
            <label>Interaction summary</label>
            <textarea value={memory.interactionSummary} onChange={(e) => setMemory((m) => ({ ...m, interactionSummary: e.target.value }))} />
          </div>
          <div className="field">
            <label>Objections</label>
            <textarea value={memory.objections} onChange={(e) => setMemory((m) => ({ ...m, objections: e.target.value }))} />
          </div>
          <div className="field">
            <label>Preferred contact method</label>
            <input value={memory.preferredContactMethod} onChange={(e) => setMemory((m) => ({ ...m, preferredContactMethod: e.target.value }))} />
          </div>
          <div className="field">
            <label>Best outreach angle</label>
            <input value={memory.bestOutreachAngle} onChange={(e) => setMemory((m) => ({ ...m, bestOutreachAngle: e.target.value }))} />
          </div>
        </div>
        <div className="field">
          <label>Close blockers</label>
          <textarea value={memory.closeBlockers} onChange={(e) => setMemory((m) => ({ ...m, closeBlockers: e.target.value }))} />
        </div>
        <button onClick={() => run(() => api.patchLead(lead.id, {
          ...memory,
          activity: { type: "memory_update", summary: "Updated operator memory" },
        }), "Operator memory saved.")} disabled={busy}>Save Operator Memory</button>
      </div>

      <div className="card stack">
        <h3 className="section-title">Notes</h3>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button onClick={() => run(() => api.patchLead(lead.id, { notes }), "Notes saved.")} disabled={busy}>Save Notes</button>
      </div>

      <div className="card stack">
        <h3 className="section-title">Outreach Flow</h3>
        <div className="detail-grid">
          <div className="field">
            <label>Outreach draft subject</label>
            <input value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
          </div>
          <div className="field">
            <label>Contact channel</label>
            <select value={outreach.channel} onChange={(e) => setOutreach((o) => ({ ...o, channel: e.target.value }))}>
              <option value="email">email</option>
              <option value="phone">phone</option>
              <option value="facebook">facebook</option>
              <option value="instagram">instagram</option>
              <option value="in-person">in-person</option>
            </select>
          </div>
          <div className="field">
            <label>Reply status</label>
            <select value={outreach.replyStatus} onChange={(e) => setOutreach((o) => ({ ...o, replyStatus: e.target.value }))}>
              <option value="not_contacted">not_contacted</option>
              <option value="contacted">contacted</option>
              <option value="replied">replied</option>
              <option value="no_response">no_response</option>
              <option value="won">won</option>
              <option value="lost">lost</option>
            </select>
          </div>
          <div className="field">
            <label>Next follow-up date</label>
            <input type="datetime-local" value={outreach.nextFollowUpAt} onChange={(e) => setOutreach((o) => ({ ...o, nextFollowUpAt: e.target.value }))} />
          </div>
        </div>
        <div className="field">
          <label>Outreach draft body</label>
          <textarea value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
        </div>
        <div className="field">
          <label>Outreach notes</label>
          <textarea value={outreach.notes} onChange={(e) => setOutreach((o) => ({ ...o, notes: e.target.value }))} />
        </div>
        <div className="btn-row">
          <button onClick={() => run(() => api.appendOutreach(lead.id, {
            subject: draft.subject,
            body: draft.body,
            channel: outreach.channel,
            replyStatus: outreach.replyStatus,
            followUpNeeded: outreach.followUpNeeded,
            nextFollowUpAt: outreach.nextFollowUpAt || null,
            notes: outreach.notes,
          }), "Outreach history saved.")} disabled={busy}>Save Outreach History</button>
          <button onClick={() => run(() => api.patchLead(lead.id, { pipelineStage: "contacted", replyStatus: "contacted", contactedAt: new Date().toISOString() }), "Lead marked contacted.")} disabled={busy}>Mark Contacted</button>
          <button onClick={() => run(() => api.patchLead(lead.id, { pipelineStage: "replied", replyStatus: "replied" }), "Lead marked replied.")} disabled={busy}>Mark Replied</button>
          <button onClick={() => run(() => api.patchLead(lead.id, { pipelineStage: "won", replyStatus: "won" }), "Lead marked won.")} disabled={busy}>Mark Won</button>
          <button onClick={() => run(() => api.patchLead(lead.id, { pipelineStage: "lost", replyStatus: "lost" }), "Lead marked lost.")} disabled={busy}>Mark Lost</button>
        </div>
      </div>

      <div className="card stack">
        <h3 className="section-title">Outreach History</h3>
        {(lead.outreachHistory ?? []).length === 0 ? (
          <div className="muted">No outreach history yet.</div>
        ) : (
          (lead.outreachHistory ?? []).map((item, idx) => (
            <div key={idx} className="card">
              <div><b>{item.channel}</b> · {item.replyStatus} · {item.at ? new Date(item.at).toLocaleString() : "—"}</div>
              <div className="muted">{item.subject}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{item.body}</div>
            </div>
          ))
        )}
      </div>

      <div className="card stack">
        <h3 className="section-title">Operator Activity Log</h3>
        {(lead.operatorActivityLog ?? []).length === 0 ? (
          <div className="muted">No operator activity logged yet.</div>
        ) : (
          lead.operatorActivityLog.slice().reverse().map((item, idx) => (
            <div key={`${item.at}-${idx}`} className="card">
              <div><b>{item.type}</b> · {item.at ? new Date(item.at).toLocaleString() : "—"} · {item.by || "operator"}</div>
              <div className="muted">{item.summary}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SitePreviewPage() {
  const { id } = useParams();
  const [lead, setLead] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const data = await api.lead(id);
    setLead(data);
  };

  useEffect(() => {
    load();
  }, [id]);

  const run = async (fn, successMessage = "Action completed.") => {
    setBusy(true);
    try {
      await fn();
      await load();
      notify(successMessage);
    } catch (err) {
      notify(err.message || "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!lead) return <div className="muted">Loading preview...</div>;

  return (
    <div className="stack">
      <div className="topbar">
        <h2 className="section-title">Site Preview: {lead.businessName}</h2>
        <div className="btn-row">
          {lead.preview?.previewUrl ? (
            <a className="button-link" href={lead.preview.previewUrl} target="_blank">
              Open Preview in New Tab
            </a>
          ) : null}
          <button title={busy ? "A preview action is already running." : ""} onClick={() => run(() => api.generatePreview(lead.id), "Preview regenerated.")} disabled={busy}>Regenerate Preview</button>
          <button title={busy ? "A preview action is already running." : ""} onClick={() => run(() => api.prepareAssets(lead.id), "Assets prepared.")} disabled={busy}>Prepare Assets</button>
          <button title={busy ? "A preview action is already running." : ""} onClick={() => run(() => api.renderPreview(lead.id), "Screenshots rendered.")} disabled={busy}>Render Screenshots</button>
          <button className="button-primary" title={busy ? "A preview action is already running." : ""} onClick={() => run(() => api.approvePreview(lead.id), "Preview approved for outreach.")} disabled={busy}>
            Approve for Outreach
          </button>
        </div>
      </div>

      <div className="card">
        <div><b>Preview status:</b> <PillBadge value={lead.previewStatus} /></div>
      </div>

      <div className="card">
        <h3 className="section-title">Live Preview</h3>
        {lead.preview?.previewUrl ? (
          <div className="iframe-wrap">
            <iframe src={lead.preview.previewUrl} title="lead-preview" />
          </div>
        ) : (
          <div className="muted">Preview not generated yet.</div>
        )}
      </div>

      <div className="split-two">
        <div className="card">
          <h3 className="section-title">Desktop Screenshot</h3>
          {lead.preview?.desktopRenderUrl ? (
            <img className="preview-shot" src={lead.preview.desktopRenderUrl} alt="Desktop preview" />
          ) : (
            <div className="muted">Desktop screenshot not rendered.</div>
          )}
        </div>
        <div className="card">
          <h3 className="section-title">Mobile Screenshot</h3>
          {lead.preview?.mobileRenderUrl ? (
            <img className="preview-shot" src={lead.preview.mobileRenderUrl} alt="Mobile preview" />
          ) : (
            <div className="muted">Mobile screenshot not rendered.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function TargetLeadGroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setGroups(await api.leadRuns(100));
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load Target Lead Groups.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="stack">
      <div className="topbar">
        <h2 className="section-title">Target Lead Groups</h2>
        <button className="button-ghost" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="card muted">
        What to do next: open a group, inspect qualified leads, generate previews, then move approved leads into outreach.
      </div>
      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
      {!groups.length ? (
        <div className="card muted">No saved Target Lead Groups yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Run Title</th>
                <th>Search Term</th>
                <th>City/State</th>
                <th>Created</th>
                <th>Qualified</th>
                <th>Rejected</th>
                <th>Preview Ready</th>
                <th>Contacted</th>
                <th>Replied</th>
                <th>Won</th>
                <th>Lost</th>
                <th>Archived</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td>{group.title}</td>
                  <td>{group.searchTerm}</td>
                  <td>{[group.city, group.state].filter(Boolean).join(", ")}</td>
                  <td>{group.createdAt ? new Date(group.createdAt).toLocaleString() : "—"}</td>
                  <td>{group.stats?.qualified ?? 0}</td>
                  <td>{group.stats?.rejected ?? 0}</td>
                  <td>{group.stats?.previewReady ?? 0}</td>
                  <td>{group.stats?.contacted ?? 0}</td>
                  <td>{group.stats?.replied ?? 0}</td>
                  <td>{group.stats?.won ?? 0}</td>
                  <td>{group.stats?.lost ?? 0}</td>
                  <td><PillBadge value={group.archived ? "archived" : "active"} /></td>
                  <td>
                    <div className="btn-row">
                      <Link className="button-link" to={`/targets/${group.id}`}>View Group</Link>
                      <button onClick={async () => {
                        const title = await promptAction({
                          title: "Rename Target Lead Group",
                          label: "Group title",
                          initialValue: group.title,
                        });
                        if (!title) return;
                        try {
                          await api.patchLeadRun(group.id, { title });
                          await load();
                          notify("Target Lead Group renamed.");
                        } catch (err) {
                          notify(err.message || "Rename failed.", "error");
                        }
                      }}>Rename</button>
                      <button onClick={async () => {
                        try {
                          await api.archiveLeadRun(group.id, !group.archived);
                          await load();
                          notify(group.archived ? "Target Lead Group unarchived." : "Target Lead Group archived.");
                        } catch (err) {
                          notify(err.message || "Archive action failed.", "error");
                        }
                      }}>{group.archived ? "Unarchive" : "Archive"}</button>
                      <button onClick={() => {
                        window.localStorage.setItem("leadGenerationPreset", JSON.stringify(group));
                        navigate("/lead-generation");
                      }}>Duplicate filters</button>
                      <a className="button-link" href={`/api/lead-runs/${group.id}/export.csv`}>Export CSV</a>
                      <button className="button-danger" onClick={async () => {
                        const ok = await confirmAction({
                          title: "Delete Target Lead Group?",
                          message: `Delete "${group.title}"? Leads stay saved in leads.json.`,
                          confirmLabel: "Delete group",
                          danger: true,
                        });
                        if (!ok) return;
                        try {
                          await api.deleteLeadRun(group.id);
                          await load();
                          notify("Target Lead Group deleted.");
                        } catch (err) {
                          notify(err.message || "Delete failed.", "error");
                        }
                      }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TargetLeadGroupDetailPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [busyLeadId, setBusyLeadId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setGroup(await api.leadRun(runId));
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load Target Lead Group.");
    }
  };

  useEffect(() => {
    load();
  }, [runId]);

  const act = async (leadId, fn, successMessage = "Action completed.") => {
    setBusyLeadId(leadId);
    try {
      await fn();
      await load();
      notify(successMessage);
    } catch (err) {
      notify(err.message || "Action failed.", "error");
    } finally {
      setBusyLeadId("");
    }
  };

  const rejectedAction = async (fn, successMessage = "Rejected lead updated.") => {
    try {
      await fn();
      await load();
      notify(successMessage);
    } catch (err) {
      notify(err.message || "Rejected lead action failed.", "error");
    }
  };

  if (!group && !error) return <div className="muted">Loading Target Lead Group...</div>;

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">{group?.title ?? "Target Lead Group"}</h2>
          <div className="muted">Saved Run · {group?.runMode}</div>
        </div>
        <Link className="button-link" to="/targets">
          Back to Target Lead Groups
        </Link>
      </div>
      <div className="card muted">
        What to do next: work qualified leads from top to bottom, generate previews, approve the strongest ones, then contact them from Outreach.
      </div>

      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
      {!group ? null : (
        <>
          <div className="grid-cards">
            <div className="card"><h4>Saved Leads</h4><div className="value">{group.stats?.qualified ?? 0}</div></div>
            <div className="card"><h4>Rejected Leads</h4><div className="value">{group.stats?.rejected ?? 0}</div></div>
            <div className="card"><h4>Preview Ready</h4><div className="value">{group.stats?.previewReady ?? 0}</div></div>
            <div className="card"><h4>Contacted</h4><div className="value">{group.stats?.contacted ?? 0}</div></div>
            <div className="card"><h4>Replied</h4><div className="value">{group.stats?.replied ?? 0}</div></div>
            <div className="card"><h4>Won</h4><div className="value">{group.stats?.won ?? 0}</div></div>
            <div className="card"><h4>Lost</h4><div className="value">{group.stats?.lost ?? 0}</div></div>
          </div>

          <div className="card">
            <div className="btn-row">
              <button onClick={async () => {
                const title = await promptAction({
                  title: "Rename Target Lead Group",
                  label: "Group title",
                  initialValue: group.title,
                });
                if (!title) return;
                try {
                  await api.patchLeadRun(group.id, { title });
                  await load();
                  notify("Target Lead Group renamed.");
                } catch (err) {
                  notify(err.message || "Rename failed.", "error");
                }
              }}>Rename group</button>
              <button onClick={async () => {
                try {
                  await api.archiveLeadRun(group.id, !group.archived);
                  await load();
                  notify(group.archived ? "Target Lead Group unarchived." : "Target Lead Group archived.");
                } catch (err) {
                  notify(err.message || "Archive action failed.", "error");
                }
              }}>{group.archived ? "Unarchive group" : "Archive group"}</button>
              <button onClick={() => {
                window.localStorage.setItem("leadGenerationPreset", JSON.stringify(group));
                navigate("/lead-generation");
              }}>Duplicate filters into new run</button>
              <a className="button-link" href={`/api/lead-runs/${group.id}/export.csv`}>Export group CSV</a>
              <button className="button-danger" onClick={async () => {
                const ok = await confirmAction({
                  title: "Delete Target Lead Group?",
                  message: `Delete "${group.title}"? Leads remain saved.`,
                  confirmLabel: "Delete group",
                  danger: true,
                });
                if (!ok) return;
                try {
                  await api.deleteLeadRun(group.id);
                  notify("Target Lead Group deleted.");
                  navigate("/targets");
                } catch (err) {
                  notify(err.message || "Delete failed.", "error");
                }
              }}>Delete group</button>
            </div>
          </div>

          <div className="card stack">
            <h3 className="section-title">Run Filters</h3>
            <div className="detail-grid">
              <div><b>Search term:</b> {group.searchTerm}</div>
              <div><b>City/state:</b> {[group.city, group.state].filter(Boolean).join(", ")}</div>
              <div><b>Run mode:</b> {group.runMode}</div>
              <div><b>Created:</b> {group.createdAt ? new Date(group.createdAt).toLocaleString() : "—"}</div>
            </div>
            <pre className="log-box">{JSON.stringify(group.filters ?? {}, null, 2)}</pre>
            <h3 className="section-title">Original Run Config</h3>
            <pre className="log-box">{JSON.stringify({
              searchTerm: group.searchTerm,
              city: group.city,
              state: group.state,
              runMode: group.runMode,
              filters: group.filters,
              previewSettings: group.previewSettings,
            }, null, 2)}</pre>
          </div>

          <div className="card stack">
            <h3 className="section-title">Qualified Leads</h3>
            {!group.qualifiedLeads?.length ? (
              <div className="muted">No Qualified Leads in this Target Lead Group.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Business</th>
                      <th>City</th>
                      <th>Category</th>
                      <th>Score</th>
                      <th>Website Status</th>
                      <th>Preview</th>
                      <th>Priority</th>
                      <th>Pipeline</th>
                      <th>Last Contacted</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.qualifiedLeads.map((lead) => {
                      const busy = busyLeadId === lead.id;
                      return (
                        <tr key={lead.id}>
                          <td>{lead.businessName}</td>
                          <td>{lead.city}</td>
                          <td>{lead.category}</td>
                          <td>{lead.score}</td>
                          <td>{lead.websiteQuality ?? (lead.websiteUrl ? "has_site" : "no_site")}</td>
                          <td><PillBadge value={lead.previewStatus} /></td>
                          <td>
                            <PillBadge value={lead.outreachPriority} />
                            {lead.likelyFranchise ? <div><PillBadge value={`chain ${lead.chainConfidence}%`} /></div> : null}
                          </td>
                          <td><PillBadge value={lead.pipelineStage} /></td>
                          <td>{lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleString() : "—"}</td>
                          <td>
                            <div className="btn-row">
                              <Link className="button-link" to={`/leads/${lead.id}`}>View lead</Link>
                              <button disabled={busy} title={busy ? "Another action is running for this lead." : ""} onClick={() => act(lead.id, () => api.generatePreview(lead.id), "Preview generated.")}>Generate preview</button>
                              <button disabled={busy || lead.previewStatus === "not_generated"} title={lead.previewStatus === "not_generated" ? "Generate a preview before approving." : ""} onClick={() => act(lead.id, () => api.approvePreview(lead.id), "Preview approved.")}>Approve</button>
                              <Link className="button-link" to={`/leads/${lead.id}/preview`}>View preview</Link>
                              <button disabled={busy} title={busy ? "Another action is running for this lead." : ""} onClick={() => act(lead.id, () => api.patchLead(lead.id, { pipelineStage: "contacted", replyStatus: "contacted", contactedAt: new Date().toISOString() }), "Lead marked contacted.")}>Mark contacted</button>
                              <button disabled={busy} title={busy ? "Another action is running for this lead." : ""} onClick={() => act(lead.id, () => api.patchLead(lead.id, { pipelineStage: "replied", replyStatus: "replied" }), "Lead marked replied.")}>Mark replied</button>
                              <button disabled={busy} title={busy ? "Another action is running for this lead." : ""} onClick={() => act(lead.id, () => api.patchLead(lead.id, { pipelineStage: "won", replyStatus: "won" }), "Lead marked won.")}>Mark won</button>
                              <button disabled={busy} title={busy ? "Another action is running for this lead." : ""} onClick={() => act(lead.id, () => api.patchLead(lead.id, { pipelineStage: "lost", replyStatus: "lost" }), "Lead marked lost.")}>Mark lost</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card stack">
            <h3 className="section-title">Rejected Leads</h3>
            {!group.rejectedLeads?.length ? (
              <div className="muted">No Rejected Leads in this Target Lead Group.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Business</th>
                      <th>Score</th>
                      <th>Rejection Reasons</th>
                      <th>Website Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rejectedLeads.map((lead) => (
                      <tr key={lead.leadId ?? lead.businessName}>
                        <td>{lead.businessName}</td>
                        <td>{lead.score}</td>
                        <td>{(lead.reasons ?? []).join(" | ")}</td>
                        <td>{lead.websiteStatus}</td>
                        <td>
                          <div className="btn-row">
                            <button onClick={() => rejectedAction(() => api.reconsiderLead(group.id, { leadId: lead.leadId, businessName: lead.businessName }), "Lead moved out of rejected list.")}>
                              Reconsider
                            </button>
                            <button disabled={!lead.leadId} title={!lead.leadId ? "Only rejected leads with saved lead IDs can move to qualified." : ""} onClick={() => rejectedAction(() => api.moveToQualified(group.id, lead.leadId), "Lead moved to qualified.")}>
                              Move to qualified
                            </button>
                            <button className="button-danger" onClick={async () => {
                              const ok = await confirmAction({
                                title: "Delete from rejected list?",
                                message: `Remove "${lead.businessName}" from this group's rejected list?`,
                                confirmLabel: "Remove",
                                danger: true,
                              });
                              if (!ok) return;
                              await rejectedAction(() => api.reconsiderLead(group.id, { leadId: lead.leadId, businessName: lead.businessName }), "Lead removed from rejected list.");
                            }}>
                              Delete from rejected list
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function OutreachQueuePage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [groups, setGroups] = useState([]);
  const [busyLeadId, setBusyLeadId] = useState("");
  const [error, setError] = useState("");
  const [compactMode, setCompactMode] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeLeadId, setActiveLeadId] = useState("");

  const load = async () => {
    try {
      const [leadRows, groupRows] = await Promise.all([api.leads(), api.leadRuns(200)]);
      setLeads(leadRows);
      setGroups(groupRows);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load outreach queue.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const groupByLeadId = new Map();
  for (const group of groups) {
    for (const id of group.qualifiedLeadIds ?? []) {
      if (!groupByLeadId.has(id)) groupByLeadId.set(id, group);
    }
  }

  const withGroup = leads.map((lead) => {
    const group = groupByLeadId.get(lead.id);
    return {
      ...lead,
      targetLeadGroup: group,
      approvalRequired: Boolean(group?.previewSettings?.requireApprovalBeforeOutreach),
    };
  });

  const isApprovedEnough = (lead) => !lead.approvalRequired || lead.previewStatus === "approved";
  const readyRows = withGroup.filter(
    (lead) =>
      isApprovedEnough(lead) &&
      (lead.pipelineStage === "preview_ready" || lead.previewStatus === "approved") &&
      !["contacted", "replied", "won", "lost"].includes(lead.pipelineStage)
  );
  const dueRows = withGroup.filter((lead) => lead.followUpDue && !lead.followUpOverdue);
  const overdueRows = withGroup.filter((lead) => lead.followUpOverdue);
  const waitingRows = withGroup.filter(
    (lead) =>
      (lead.pipelineStage === "contacted" ||
        lead.replyStatus === "contacted" ||
        lead.replyStatus === "no_response") &&
      !lead.followUpDue &&
      !lead.followUpOverdue
  );
  const hotRows = withGroup.filter(
    (lead) => lead.hotLead && !["won", "lost"].includes(lead.pipelineStage)
  );

  const sections = [
    { title: "Ready Now", rows: sortByPriority(readyRows) },
    { title: "Follow-Up Due Today", rows: sortByPriority(dueRows) },
    { title: "Overdue Follow-Ups", rows: sortByPriority(overdueRows) },
    { title: "Waiting for Reply", rows: sortByPriority(waitingRows) },
    { title: "Hot Leads", rows: sortByPriority(hotRows) },
    {
      title: "Won",
      rows: sortByPriority(withGroup.filter((lead) => lead.pipelineStage === "won" || lead.replyStatus === "won")),
    },
    {
      title: "Lost",
      rows: sortByPriority(withGroup.filter((lead) => lead.pipelineStage === "lost" || lead.replyStatus === "lost")),
    },
  ];
  const operationalRows = sections.flatMap((section) => section.rows);
  const selectedRows = withGroup.filter((lead) => selectedIds.includes(lead.id));
  const activeLead = operationalRows.find((lead) => lead.id === activeLeadId) ?? operationalRows[0];

  useEffect(() => {
    if (!activeLeadId && operationalRows[0]) setActiveLeadId(operationalRows[0].id);
  }, [activeLeadId, operationalRows]);

  const act = async (leadId, fn, successMessage = "Action completed.") => {
    setBusyLeadId(leadId);
    try {
      await fn();
      await load();
      notify(successMessage);
    } catch (err) {
      notify(err.message || "Action failed.", "error");
    } finally {
      setBusyLeadId("");
    }
  };

  const scheduleFollowUp = async (lead) => {
    const value = await promptAction({
      title: "Schedule Follow-Up",
      message: `Set the next follow-up for ${lead.businessName}.`,
      label: "Date/time (YYYY-MM-DDTHH:mm)",
    });
    if (!value) return;
    return api.patchLead(lead.id, {
      followUpNeeded: true,
      nextFollowUpAt: new Date(value).toISOString(),
      replyStatus: lead.replyStatus === "not_contacted" ? "contacted" : lead.replyStatus,
    });
  };

  const snoozeFollowUp = (lead, days = 1) =>
    api.patchLead(lead.id, {
      followUpNeeded: true,
      nextFollowUpAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    });

  const draft = async (lead) => {
    const d = await api.outreachDraft(lead.id);
    await promptAction({
      title: "Copy Outreach Draft",
      label: "Draft",
      initialValue: `${d.subject}\n\n${d.body}`,
      multiline: true,
      confirmLabel: "Close",
    });
  };

  const toggleSelected = (leadId) => {
    setSelectedIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]
    );
  };

  const bulkPatch = async (patch, label) => {
    if (!selectedRows.length) return notify("Select at least one lead first.", "error");
    for (const lead of selectedRows) await api.patchLead(lead.id, patch(lead));
    setSelectedIds([]);
    await load();
    notify(label);
  };

  const bulkApprove = async () => {
    if (!selectedRows.length) return notify("Select at least one lead first.", "error");
    for (const lead of selectedRows) await api.approvePreview(lead.id);
    setSelectedIds([]);
    await load();
    notify("Selected previews approved.");
  };

  const bulkExport = () => {
    if (!selectedRows.length) return notify("Select at least one lead first.", "error");
    const header = ["Business", "Phone", "Website", "Priority", "Stage", "Next Follow-Up"];
    const csv = [
      header.join(","),
      ...selectedRows.map((lead) =>
        [lead.businessName, lead.phone, lead.websiteUrl, lead.outreachPriority, lead.pipelineStage, lead.nextFollowUpAt]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "selected-outreach-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
    notify("Selected leads exported.");
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.target?.matches?.("input, textarea, select")) return;
      if (!operationalRows.length) return;
      const index = Math.max(0, operationalRows.findIndex((lead) => lead.id === activeLead?.id));
      if (event.key === "n") {
        setActiveLeadId(operationalRows[Math.min(operationalRows.length - 1, index + 1)].id);
      }
      if (event.key === "p") {
        setActiveLeadId(operationalRows[Math.max(0, index - 1)].id);
      }
      if (event.key === "o" && activeLead) navigate(`/leads/${activeLead.id}/preview`);
      if (event.key === "c" && activeLead) {
        act(
          activeLead.id,
          () =>
            api.patchLead(activeLead.id, {
              pipelineStage: "contacted",
              replyStatus: "contacted",
              contactedAt: new Date().toISOString(),
              lastContactedAt: new Date().toISOString(),
            }),
          "Lead marked contacted."
        );
      }
      if (event.key === "s" && activeLead) {
        act(activeLead.id, () => snoozeFollowUp(activeLead, 1), "Follow-up snoozed 1 day.");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [operationalRows, activeLead, navigate]);

  const renderRows = (rows) => {
    if (!rows.length) return <div className="muted">Clear. No leads in this section.</div>;
    return (
      <div className="table-wrap compact-table">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Lead</th>
              <th>Priority</th>
              <th>Signal</th>
              <th>Touch</th>
              <th>Quick Actions</th>
              <th>More</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((lead) => {
              const busy = busyLeadId === lead.id;
              return (
                <tr
                  key={lead.id}
                  className={activeLead?.id === lead.id ? "active-row" : ""}
                  onClick={() => setActiveLeadId(lead.id)}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(lead.id)}
                      onChange={() => toggleSelected(lead.id)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
                  <td>
                    <div><Link to={`/leads/${lead.id}`}><b>{lead.businessName}</b></Link></div>
                    <div className="muted compact-meta">{lead.city} · {lead.category}</div>
                    {lead.likelyFranchise ? <PillBadge value={`chain ${lead.chainConfidence}%`} /> : null}
                  </td>
                  <td>
                    {lead.preview?.desktopRenderUrl ? (
                      <img className="thumb-shot" src={lead.preview.desktopRenderUrl} alt="" />
                    ) : null}
                    <PillBadge value={lead.outreachPriority} />
                    <div className="muted compact-meta">Urgency {lead.urgencyScore} · Close {lead.closeLikelihood}</div>
                  </td>
                  <td>
                    <div>{lead.suggestedNextAction}</div>
                    <div className="muted compact-meta">{(lead.intelligence ?? []).slice(0, 2).join(" · ")}</div>
                  </td>
                  <td>
                    <div>{lead.daysSinceLastTouch === null ? "No touch" : `${lead.daysSinceLastTouch}d since touch`}</div>
                    <div className="muted compact-meta">{lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString() : "No follow-up set"}</div>
                  </td>
                  <td>
                    <div className="btn-row">
                      <button disabled={busy} onClick={() => act(lead.id, () => draft(lead), "Outreach draft opened.")}>Draft</button>
                      <Link className="button-link" to={`/leads/${lead.id}/preview`}>Preview</Link>
                      <button disabled={busy} onClick={() => act(lead.id, () => api.patchLead(lead.id, { pipelineStage: "contacted", replyStatus: "contacted", contactedAt: new Date().toISOString(), lastContactedAt: new Date().toISOString() }), "Lead marked contacted.")}>Contacted</button>
                      <button disabled={busy} onClick={() => act(lead.id, () => snoozeFollowUp(lead, 1), "Snoozed 1 day.")}>+1d</button>
                      <button disabled={busy} onClick={() => act(lead.id, () => api.approvePreview(lead.id), "Preview approved.")}>Approve</button>
                    </div>
                  </td>
                  <td>
                    <details>
                      <summary>More</summary>
                      <div className="btn-row details-actions">
                        <button disabled={busy} onClick={() => act(lead.id, () => api.patchLead(lead.id, { pipelineStage: "replied", replyStatus: "replied", followUpNeeded: false }), "Lead marked replied.")}>Replied</button>
                        <button disabled={busy} onClick={() => act(lead.id, () => api.patchLead(lead.id, { replyStatus: "no_response", followUpNeeded: true }), "Lead marked no response.")}>No response</button>
                        <button disabled={busy} onClick={() => act(lead.id, () => api.patchLead(lead.id, { pipelineStage: "won", replyStatus: "won", followUpNeeded: false }), "Lead marked won.")}>Won</button>
                        <button disabled={busy} onClick={() => act(lead.id, () => api.patchLead(lead.id, { pipelineStage: "lost", replyStatus: "lost", followUpNeeded: false }), "Lead marked lost.")}>Lost</button>
                        <button disabled={busy} onClick={() => act(lead.id, () => scheduleFollowUp(lead), "Follow-up scheduled.")}>Schedule</button>
                        <button disabled={busy} onClick={() => act(lead.id, () => snoozeFollowUp(lead, 3), "Snoozed 3 days.")}>+3d</button>
                        <button disabled={busy} onClick={() => act(lead.id, () => snoozeFollowUp(lead, 7), "Snoozed 7 days.")}>+7d</button>
                        <button onClick={() => copyText(lead.websiteUrl, "Website URL")}>Copy website</button>
                        <button onClick={() => copyText(lead.phone, "Phone number")}>Copy phone</button>
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={`stack ${compactMode ? "compact-mode" : ""}`}>
      <div className="topbar">
        <div>
          <h2 className="section-title">Outreach Command Center</h2>
          <div className="muted">Shortcuts: n next, p previous, o preview, c contacted, s snooze 1d.</div>
        </div>
        <div className="btn-row">
          <button className="button-ghost" onClick={() => setCompactMode((value) => !value)}>
            {compactMode ? "Comfort Mode" : "Compact Mode"}
          </button>
          <button className="button-ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="card bulk-bar">
        <div><b>{selectedRows.length}</b> selected</div>
        <div className="btn-row">
          <button onClick={bulkApprove}>Approve previews</button>
          <button onClick={() => bulkPatch(() => ({ pipelineStage: "contacted", replyStatus: "contacted", contactedAt: new Date().toISOString(), lastContactedAt: new Date().toISOString() }), "Selected leads marked contacted.")}>Mark contacted</button>
          <button onClick={() => bulkPatch(() => ({ followUpNeeded: true, nextFollowUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }), "Selected follow-ups scheduled for tomorrow.")}>Follow-up tomorrow</button>
          <button onClick={() => bulkPatch(() => ({ pipelineStage: "preview_ready" }), "Selected leads moved to outreach-ready.")}>Move outreach-ready</button>
          <button onClick={() => bulkPatch(() => ({ pipelineStage: "lost", replyStatus: "lost", followUpNeeded: false }), "Selected leads archived as lost.")}>Archive selected</button>
          <button onClick={bulkExport}>Export selected</button>
        </div>
      </div>

      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
      {sections.map((section) => (
        <div key={section.title} className="card stack">
          <div className="section-row">
            <h3 className="section-title">{section.title}</h3>
            <PillBadge value={`${section.rows.length} leads`} />
          </div>
          {renderRows(section.rows)}
        </div>
      ))}
    </div>
  );
}

function LeadGenerationRunsPage() {
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setRuns(await api.leadGenerationRuns(100));
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load Saved Runs.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="stack">
      <div className="topbar">
        <h2 className="section-title">Lead Generation Saved Runs</h2>
        <button className="button-ghost" onClick={load}>Refresh</button>
      </div>
      <div className="card muted">
        What to do next: audit past runs, open the linked Target Lead Group, and compare qualified vs rejected counts.
      </div>
      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Run Title</th>
              <th>Date</th>
              <th>Search Term</th>
              <th>City/State</th>
              <th>Run Mode</th>
              <th>Qualified</th>
              <th>Rejected</th>
              <th>Preview Ready</th>
              <th>Status</th>
              <th>Target Group</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{run.title ?? run.config?.runTitle ?? "Untitled Saved Run"}</td>
                <td>{run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}</td>
                <td>{run.config?.searchTerm}</td>
                <td>{[run.config?.city, run.config?.state].filter(Boolean).join(", ")}</td>
                <td>{run.config?.runMode}</td>
                <td>{run.summary?.qualified ?? 0}</td>
                <td>{run.summary?.rejected ?? 0}</td>
                <td>{run.summary?.previewsGenerated ?? 0}</td>
                <td>{run.status}</td>
                <td>
                  <Link className="button-link" to={`/targets/${run.id}`}>Open Target Group</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!runs.length ? <div className="card muted">No Saved Runs yet.</div> : null}
    </div>
  );
}

function splitConfigList(value) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function AutopilotPage() {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [cfg, stat, history] = await Promise.all([
        api.autopilotConfig(),
        api.autopilotStatus(),
        api.autopilotRuns(50),
      ]);
      setConfig({
        ...cfg,
        nichesText: (cfg.niches ?? []).join("\n"),
        citiesText: (cfg.cities ?? []).join("\n"),
      });
      setStatus(stat);
      setRuns(history);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load Autopilot.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api.patchAutopilotConfig({
        ...config,
        niches: splitConfigList(config.nichesText),
        cities: splitConfigList(config.citiesText),
      });
      await load();
      notify("Autopilot settings saved.");
    } catch (err) {
      notify(err.message || "Failed to save Autopilot settings.", "error");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      await load();
      notify(message);
    } catch (err) {
      notify(err.message || "Autopilot action failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!config) {
    return (
      <div className="stack">
        <div className="topbar">
          <div>
            <h2 className="section-title">Autopilot</h2>
            <div className="muted">Loading Autopilot settings and run history.</div>
          </div>
          <button className="button-ghost" onClick={load}>Retry</button>
        </div>
        {error ? (
          <div className="card stack warning-card">
            <h3 className="section-title">Autopilot failed to load</h3>
            <div>{error}</div>
            {error.toLowerCase().includes("unauthorized") ? (
              <Link className="button-link" to="/login">Go to Login</Link>
            ) : null}
          </div>
        ) : (
          <div className="card muted">Loading Autopilot...</div>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">Autopilot</h2>
          <div className="muted">Runs lead discovery while the server is on. It never contacts businesses automatically.</div>
        </div>
        <div className="btn-row">
          <button className="button-ghost" onClick={load}>Refresh</button>
          <button className="button-primary" disabled={busy} onClick={() => runAction(() => api.runAutopilotNow(), "Autopilot run completed.")}>Run Once Now</button>
        </div>
      </div>

      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}

      <div className="grid-cards compact-cards">
        <div className="card"><h4>Status</h4><div className="value">{status?.enabled ? "On" : "Off"}</div><div className="muted">{status?.running ? "Running now" : "Idle"}</div></div>
        <div className="card"><h4>Last Run</h4><div className="value">{status?.lastRun?.status ?? "none"}</div><div className="muted">{status?.lastRun?.title ?? "No runs yet"}</div></div>
        <div className="card"><h4>Next Run</h4><div className="value">{status?.nextRunAt ? new Date(status.nextRunAt).toLocaleString() : "Paused"}</div></div>
        <div className="card"><h4>Today</h4><div className="value">{status?.opportunitiesFoundToday ?? 0}</div><div className="muted">opportunities · {status?.previewsGeneratedToday ?? 0} previews</div></div>
      </div>

      <div className="card stack">
        <h3 className="section-title">Controls</h3>
        <div className="detail-grid">
          <label className="checkline">
            <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))} />
            Enable Autopilot
          </label>
          <div className="field">
            <label>Run frequency</label>
            <select value={config.runFrequency} onChange={(e) => setConfig((c) => ({ ...c, runFrequency: e.target.value }))}>
              <option value="once_now">once now</option>
              <option value="every_30_minutes">every 30 minutes</option>
              <option value="hourly">hourly</option>
              <option value="every_2_hours">every 2 hours</option>
              <option value="daily">daily</option>
            </select>
          </div>
          <div className="field">
            <label>Max results per run</label>
            <input value={config.maxResults} onChange={(e) => setConfig((c) => ({ ...c, maxResults: e.target.value }))} />
          </div>
          <div className="field">
            <label>Minimum score</label>
            <input value={config.minScore} onChange={(e) => setConfig((c) => ({ ...c, minScore: e.target.value }))} />
          </div>
        </div>

        <div className="split-two">
          <div className="field">
            <label>Niches to search</label>
            <textarea value={config.nichesText} onChange={(e) => setConfig((c) => ({ ...c, nichesText: e.target.value }))} placeholder="tree service&#10;plumber&#10;pest control" />
          </div>
          <div className="field">
            <label>Cities to search</label>
            <textarea value={config.citiesText} onChange={(e) => setConfig((c) => ({ ...c, citiesText: e.target.value }))} placeholder="Austin, TX&#10;Round Rock, TX" />
          </div>
        </div>

        <div className="checkbox-grid">
          <label className="checkline"><input type="checkbox" checked={config.excludeChains} onChange={(e) => setConfig((c) => ({ ...c, excludeChains: e.target.checked }))} />Exclude likely franchises/chains</label>
          <label className="checkline"><input type="checkbox" checked={config.requirePhone} onChange={(e) => setConfig((c) => ({ ...c, requirePhone: e.target.checked }))} />Require phone</label>
          <label className="checkline"><input type="checkbox" checked={config.requireWeakOrMissingWebsite} onChange={(e) => setConfig((c) => ({ ...c, requireWeakOrMissingWebsite: e.target.checked }))} />Require weak/missing website</label>
          <label className="checkline"><input type="checkbox" checked={config.autoGeneratePreviews} onChange={(e) => setConfig((c) => ({ ...c, autoGeneratePreviews: e.target.checked }))} />Auto-generate previews</label>
          <label className="checkline"><input type="checkbox" checked={config.autoPrepareAssets} onChange={(e) => setConfig((c) => ({ ...c, autoPrepareAssets: e.target.checked }))} />Auto-prepare assets</label>
          <label className="checkline"><input type="checkbox" checked={config.autoRenderScreenshots} onChange={(e) => setConfig((c) => ({ ...c, autoRenderScreenshots: e.target.checked }))} />Auto-render screenshots</label>
          <label className="checkline"><input type="checkbox" checked readOnly />Require manual approval before outreach</label>
        </div>

        <h3 className="section-title">Safety Caps</h3>
        <div className="detail-grid">
          <div className="field"><label>Max runs/day</label><input value={config.maxRunsPerDay} onChange={(e) => setConfig((c) => ({ ...c, maxRunsPerDay: e.target.value }))} /></div>
          <div className="field"><label>Max leads/day</label><input value={config.maxLeadsPerDay} onChange={(e) => setConfig((c) => ({ ...c, maxLeadsPerDay: e.target.value }))} /></div>
          <div className="field"><label>Max previews/day</label><input value={config.maxPreviewsPerDay} onChange={(e) => setConfig((c) => ({ ...c, maxPreviewsPerDay: e.target.value }))} /></div>
          <div className="field"><label>Error cooldown minutes</label><input value={config.errorCooldownMinutes} onChange={(e) => setConfig((c) => ({ ...c, errorCooldownMinutes: e.target.value }))} /></div>
        </div>

        <div className="btn-row">
          <button className="button-primary" disabled={busy} onClick={save}>Save Settings</button>
          <button disabled={busy} onClick={() => runAction(() => api.resumeAutopilot(), "Autopilot resumed.")}>Resume</button>
          <button className="button-danger" disabled={busy} onClick={() => runAction(() => api.pauseAutopilot(), "Autopilot paused.")}>Pause</button>
        </div>
      </div>

      <div className="card stack">
        <h3 className="section-title">Autopilot Run Log</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Started</th>
                <th>Niche</th>
                <th>City</th>
                <th>Status</th>
                <th>Discovered</th>
                <th>Qualified</th>
                <th>Rejected</th>
                <th>Previews</th>
                <th>Target Group</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.title}</td>
                  <td>{run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}</td>
                  <td>{run.niche}</td>
                  <td>{run.city}</td>
                  <td><PillBadge value={run.status} /></td>
                  <td>{run.totalDiscovered}</td>
                  <td>{run.qualified}</td>
                  <td>{run.rejected}</td>
                  <td>{run.previewsGenerated}</td>
                  <td>{run.targetLeadGroupId ? <Link className="button-link" to={`/targets/${run.targetLeadGroupId}`}>Open</Link> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!runs.length ? <div className="muted">No Autopilot runs yet.</div> : null}
      </div>
    </div>
  );
}

function OpportunitiesPage() {
  const [inbox, setInbox] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setInbox(await api.opportunities());
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load opportunities.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id, fn, message) => {
    setBusyId(id);
    try {
      await fn();
      await load();
      notify(message);
    } catch (err) {
      notify(err.message || "Opportunity action failed.", "error");
    } finally {
      setBusyId("");
    }
  };

  const addNote = async (lead) => {
    const note = await promptAction({
      title: "Add opportunity note",
      message: lead.businessName,
      label: "Note",
      initialValue: lead.notes ?? "",
      multiline: true,
      confirmLabel: "Save note",
    });
    if (note === null) return;
    return act(lead.id, () => api.patchLead(lead.id, { notes: note }), "Note saved.");
  };

  const renderLeadRows = (rows) => (
    <div className="table-wrap compact-table">
      <table>
        <thead>
          <tr>
            <th>Business</th>
            <th>City/Niche</th>
            <th>Score</th>
            <th>Priority</th>
            <th>Weakness</th>
            <th>Preview</th>
            <th>Source Run</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => {
            const busy = busyId === lead.id;
            return (
              <tr key={lead.id}>
                <td>
                  <Link to={`/leads/${lead.id}`}>{lead.businessName}</Link>
                  {lead.likelyFranchise ? <div><PillBadge value="chain warning" /></div> : null}
                </td>
                <td>{lead.city}<div className="muted compact-meta">{lead.sourceNiche}</div></td>
                <td>{lead.score}</td>
                <td><PillBadge value={lead.outreachPriority} /></td>
                <td>{lead.websiteQuality || "unknown"}</td>
                <td><PillBadge value={lead.previewStatus} /></td>
                <td><span className="muted compact-meta">{lead.sourceRunTitle}</span></td>
                <td>
                  <div className="btn-row">
                    <Link className="button-link" to={`/leads/${lead.id}`}>Lead</Link>
                    <Link className="button-link" to={`/leads/${lead.id}/preview`}>Preview</Link>
                    <button disabled={busy || lead.previewStatus === "not_generated"} onClick={() => act(lead.id, () => api.approvePreview(lead.id), "Preview approved.")}>Approve</button>
                    <button disabled={busy} onClick={() => act(lead.id, () => api.patchLead(lead.id, { pipelineStage: "preview_ready", manualStatus: "TARGET" }), "Moved to outreach-ready.")}>Move to Outreach</button>
                    <button disabled={busy} onClick={() => act(lead.id, () => api.patchLead(lead.id, { manualStatus: "SKIP", notes: `${lead.notes ?? ""}\nRejected from Opportunity Inbox`.trim() }), "Opportunity rejected.")}>Reject</button>
                    <button disabled={busy} onClick={() => addNote(lead)}>Note</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderRejected = (rows) => (
    <div className="stack">
      {rows.map((item, idx) => (
        <div key={`${item.sourceRunId}-${idx}`} className="card">
          <b>{item.lead?.businessName ?? item.businessName ?? "Unknown business"}</b>
          <div className="muted">{item.sourceNiche} · {item.sourceCity} · {item.sourceRunTitle}</div>
          <div>Reason(s): {(item.reasons ?? []).join(" | ")}</div>
        </div>
      ))}
    </div>
  );

  const renderErrors = (rows) => (
    <div className="stack">
      {rows.map((run) => (
        <div key={run.id} className="card">
          <b>{run.title}</b> · <PillBadge value={run.status} />
          <div className="muted">{run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}</div>
          <div>{(run.errors ?? []).join(" | ") || "No detailed error captured."}</div>
        </div>
      ))}
    </div>
  );

  const sections = inbox?.sections ?? {};
  const leadSections = [
    ["New Opportunities", sections.newOpportunities ?? []],
    ["Preview Ready", sections.previewReady ?? []],
    ["Needs Review", sections.needsReview ?? []],
    ["High Priority", sections.highPriority ?? []],
  ];

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">Opportunity Inbox</h2>
          <div className="muted">Autopilot-found opportunities only. Review, approve, reject, or move them into outreach.</div>
        </div>
        <button className="button-ghost" onClick={load}>Refresh</button>
      </div>
      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
      {!inbox ? <div className="card muted">Loading opportunities...</div> : null}
      {leadSections.map(([title, rows]) => (
        <div key={title} className="card stack">
          <div className="section-row">
            <h3 className="section-title">{title}</h3>
            <PillBadge value={`${rows.length} items`} />
          </div>
          {rows.length ? renderLeadRows(rows) : <div className="muted">No items in this section.</div>}
        </div>
      ))}
      <div className="card stack">
        <div className="section-row">
          <h3 className="section-title">Rejected by Filter</h3>
          <PillBadge value={`${(sections.rejectedByFilter ?? []).length} items`} />
        </div>
        {(sections.rejectedByFilter ?? []).length ? renderRejected(sections.rejectedByFilter) : <div className="muted">No rejected Autopilot records yet.</div>}
      </div>
      <div className="card stack">
        <div className="section-row">
          <h3 className="section-title">Errors</h3>
          <PillBadge value={`${(sections.errors ?? []).length} runs`} />
        </div>
        {(sections.errors ?? []).length ? renderErrors(sections.errors) : <div className="muted">No Autopilot errors.</div>}
      </div>
    </div>
  );
}

function DemoProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setProjects(await api.demoProjects());
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load demo projects.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">Demo Projects</h2>
          <div className="muted">Saved website demos with outreach, pitch, objections, and reply status.</div>
        </div>
        <button className="button-ghost" onClick={load}>Refresh</button>
      </div>
      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
      <div className="card muted">
        First real-world test: save 3 lead previews as projects, generate outreach, mark contacted, and track reply status from Lead Detail or Outreach.
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>City/Niche</th>
              <th>Score</th>
              <th>Preview</th>
              <th>Contacted</th>
              <th>Reply</th>
              <th>Sales CTA</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>
                  <Link to={`/leads/${project.leadId}`}>{project.businessName}</Link>
                  <div className="muted compact-meta">Updated {project.updatedAt ? new Date(project.updatedAt).toLocaleString() : "—"}</div>
                </td>
                <td>{project.city}<div className="muted compact-meta">{project.category}</div></td>
                <td>{project.score}</td>
                <td><PillBadge value={project.previewStatus} /></td>
                <td><PillBadge value={project.contacted ? "yes" : "no"} /></td>
                <td><PillBadge value={project.replyStatus} /></td>
                <td className="compact-meta">{project.closeCta}</td>
                <td>
                  <div className="btn-row">
                    <Link className="button-link" to={`/leads/${project.leadId}`}>Open Lead</Link>
                    <Link className="button-link" to={`/leads/${project.leadId}/preview`}>Preview</Link>
                    {project.previewUrl ? <a className="button-link" href={project.previewUrl} target="_blank">Share Preview</a> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!projects.length ? (
        <div className="card muted">No demo projects saved yet. Open a Lead Detail page and click Save Demo Project.</div>
      ) : null}
    </div>
  );
}

function FieldTestPage() {
  const [test, setTest] = useState(null);
  const [leads, setLeads] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [forms, setForms] = useState({});
  const [attachForms, setAttachForms] = useState({});
  const [executionForms, setExecutionForms] = useState({});
  const [outcomeForms, setOutcomeForms] = useState({});

  const load = async () => {
    try {
      const [data, leadRows] = await Promise.all([api.fieldTest(), api.leads()]);
      setTest(data);
      setLeads(leadRows);
      const nextForms = {};
      const nextAttach = {};
      const nextExecution = {};
      const nextOutcomes = {};
      for (const slot of data.slots ?? []) {
        nextForms[slot.slotNumber] = {
          businessName: slot.leadInput?.businessName ?? "",
          niche: slot.leadInput?.niche ?? "",
          websiteUrl: slot.leadInput?.websiteUrl ?? "",
          phone: slot.leadInput?.phone ?? "",
          email: slot.leadInput?.email ?? "",
          social: slot.leadInput?.social ?? "",
          city: slot.leadInput?.city ?? "",
        };
        nextAttach[slot.slotNumber] = slot.leadId ?? "";
        nextExecution[slot.slotNumber] = {
          contactMethod: slot.execution?.contactMethod || "phone",
          followUpNeeded: Boolean(slot.execution?.followUpNeeded),
          nextFollowUpAt: "",
          notes: "",
        };
        nextOutcomes[slot.slotNumber] = {
          status: slot.outcome?.status || "no_response",
          notes: slot.outcome?.notes ?? "",
        };
      }
      setForms(nextForms);
      setAttachForms(nextAttach);
      setExecutionForms(nextExecution);
      setOutcomeForms(nextOutcomes);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load field test.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (key, fn, success) => {
    setBusy(key);
    try {
      const data = await fn();
      setTest(data);
      notify(success);
      await load();
    } catch (err) {
      notify(err.message || "Field test action failed.", "error");
    } finally {
      setBusy("");
    }
  };

  const updateForm = (slotNumber, patch) => {
    setForms((current) => ({ ...current, [slotNumber]: { ...(current[slotNumber] ?? {}), ...patch } }));
  };
  const updateAttach = (slotNumber, leadId) => {
    setAttachForms((current) => ({ ...current, [slotNumber]: leadId }));
  };
  const updateExecution = (slotNumber, patch) => {
    setExecutionForms((current) => ({ ...current, [slotNumber]: { ...(current[slotNumber] ?? {}), ...patch } }));
  };
  const updateOutcome = (slotNumber, patch) => {
    setOutcomeForms((current) => ({ ...current, [slotNumber]: { ...(current[slotNumber] ?? {}), ...patch } }));
  };

  if (!test) {
    return <div className="card muted">Loading 3-Business Field Test Mode...</div>;
  }

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">3-Business Field Test Mode</h2>
          <div className="muted">Execution mode for proving whether Traffic, System, or Skill breaks first.</div>
        </div>
        <div className="btn-row">
          <button className="button-ghost" onClick={load}>Refresh</button>
          <button className="button-danger" onClick={() => act("reset", () => api.resetFieldTest(), "Field test reset.")}>Reset Test</button>
        </div>
      </div>
      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}

      <div className="grid-cards compact-cards">
        <div className="card"><h4>Progress</h4><div className="value">{test.progress.complete}/{test.progress.total}</div><div className="muted">{test.progress.percent}% complete</div></div>
        <div className="card"><h4>Status</h4><div className="value">{test.status}</div></div>
        <div className="card"><h4>Bottleneck</h4><div className="value">{test.bottleneck.primary}</div></div>
        <div className="card"><h4>Demos</h4><div className="value">{test.stats.demosGenerated}</div></div>
        <div className="card"><h4>Outreach Sent</h4><div className="value">{test.stats.outreachSent}</div></div>
        <div className="card"><h4>Replies</h4><div className="value">{test.stats.repliesReceived}</div></div>
        <div className="card"><h4>Meetings</h4><div className="value">{test.stats.meetingsBooked}</div></div>
        <div className="card"><h4>Failures</h4><div className="value">{test.stats.failures}</div></div>
      </div>

      <div className="card stack">
        <h3 className="section-title">Next Recommended Action</h3>
        <div>{test.nextRecommendedAction}</div>
        <div className="muted">{test.bottleneck.suggestedNextImprovement}</div>
        {(test.bottleneck.evidence ?? []).length ? (
          <div className="stack">
            {(test.bottleneck.evidence ?? []).map((item, idx) => (
              <div key={idx} className="muted">- {item}</div>
            ))}
          </div>
        ) : null}
      </div>

      {test.slots.map((slot) => {
        const form = forms[slot.slotNumber] ?? {};
        const exec = executionForms[slot.slotNumber] ?? {};
        const outcome = outcomeForms[slot.slotNumber] ?? {};
        return (
          <div key={slot.slotNumber} className="card stack">
            <div className="section-row">
              <h3 className="section-title">{slot.label}</h3>
              <div className="btn-row">
                <PillBadge value={slot.readyToContact ? "ready to contact" : "not ready"} />
                {slot.leadId ? <Link className="button-link" to={`/leads/${slot.leadId}`}>Open Lead</Link> : null}
                {slot.leadId ? <Link className="button-link" to={`/leads/${slot.leadId}/preview`}>Preview</Link> : null}
              </div>
            </div>
            {slot.contactPathWarning ? (
              <div className="card warning-card">
                <b>Contact path warning:</b> {slot.contactPathWarning}
              </div>
            ) : (
              <div className="muted">Contact paths: {(slot.contactPaths ?? []).join(", ")}</div>
            )}

            <div className="grid-cards compact-cards">
              {Object.entries(slot.steps).map(([key, step]) => (
                <div className="card" key={key}>
                  <h4>{key.replace(/[A-Z]/g, (m) => ` ${m}`).trim()}</h4>
                  <PillBadge value={step.status} />
                  <div className="muted compact-meta">Retries {step.retries ?? 0} · {step.durationMs ? `${Math.round(step.durationMs / 1000)}s` : "—"}</div>
                </div>
              ))}
            </div>

            <div className="card stack">
              <h4>Step 1 - Lead Creation</h4>
              <div className="field">
                <label>Attach existing lead</label>
                <select value={attachForms[slot.slotNumber] ?? ""} onChange={(e) => updateAttach(slot.slotNumber, e.target.value)}>
                  <option value="">Select an existing lead...</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.businessName} · {lead.city} · {lead.category}
                    </option>
                  ))}
                </select>
              </div>
              <button
                disabled={Boolean(busy) || !attachForms[slot.slotNumber]}
                onClick={() => act(
                  `attach-${slot.slotNumber}`,
                  () => api.fieldTestAttachLead(slot.slotNumber, attachForms[slot.slotNumber]),
                  "Existing lead attached to field test."
                )}
              >
                Attach Existing Lead
              </button>
              <div className="muted">Or create a new lead for this slot:</div>
              <div className="detail-grid">
                <div className="field"><label>Business name</label><input value={form.businessName ?? ""} onChange={(e) => updateForm(slot.slotNumber, { businessName: e.target.value })} /></div>
                <div className="field"><label>Niche</label><input value={form.niche ?? ""} onChange={(e) => updateForm(slot.slotNumber, { niche: e.target.value })} /></div>
                <div className="field"><label>City</label><input value={form.city ?? ""} onChange={(e) => updateForm(slot.slotNumber, { city: e.target.value })} /></div>
                <div className="field"><label>Website</label><input value={form.websiteUrl ?? ""} onChange={(e) => updateForm(slot.slotNumber, { websiteUrl: e.target.value })} /></div>
                <div className="field"><label>Phone</label><input value={form.phone ?? ""} onChange={(e) => updateForm(slot.slotNumber, { phone: e.target.value })} /></div>
                <div className="field"><label>Email</label><input value={form.email ?? ""} onChange={(e) => updateForm(slot.slotNumber, { email: e.target.value })} /></div>
                <div className="field"><label>Social</label><input value={form.social ?? ""} onChange={(e) => updateForm(slot.slotNumber, { social: e.target.value })} /></div>
              </div>
              <button disabled={Boolean(busy)} onClick={() => act(`lead-${slot.slotNumber}`, () => api.fieldTestCreateLead(slot.slotNumber, form), "Lead saved for field test.")}>Save Lead</button>
            </div>

            <div className="card stack">
              <h4>Step 2 - Demo Generation</h4>
              <div className="muted">Generates preview, prepares assets, falls back if AI is unavailable, and can render screenshots.</div>
              <div className="btn-row">
                <button disabled={Boolean(busy) || !slot.leadId} onClick={() => act(`demo-${slot.slotNumber}`, () => api.fieldTestGenerateDemo(slot.slotNumber, { prepareAssets: true, renderScreenshots: false }), "Demo generated.")}>Generate Demo</button>
                <button disabled={Boolean(busy) || !slot.leadId} onClick={() => act(`demo-render-${slot.slotNumber}`, () => api.fieldTestGenerateDemo(slot.slotNumber, { prepareAssets: true, renderScreenshots: true }), "Demo generated and rendered.")}>Generate + Render</button>
                {slot.leadId ? (
                  <Link className="button-link" to={`/leads/${slot.leadId}#custom-images`}>
                    Upload Custom Image
                  </Link>
                ) : null}
              </div>
              <div className="muted">
                If assets look weak or missing, open Lead Detail and use the Custom Images section.
              </div>
              {slot.steps.demoGeneration.errors?.length ? <div className="muted" style={{ color: "#ffb4c0" }}>{slot.steps.demoGeneration.errors.join(" | ")}</div> : null}
            </div>

            <div className="card stack">
              <h4>Step 3 - Outreach Preparation</h4>
              <button disabled={Boolean(busy) || !slot.leadId} onClick={() => act(`prep-${slot.slotNumber}`, () => api.fieldTestPrepareOutreach(slot.slotNumber), "Outreach assets prepared.")}>Generate Outreach Assets</button>
              {slot.outreach.body ? (
                <div className="stack">
                  <div><b>Subject:</b> {slot.outreach.subject}</div>
                  <div className="muted">{slot.outreach.body}</div>
                  <div><b>Pitch:</b> {slot.outreach.pitchScript}</div>
                  <div><b>CTA:</b> {slot.outreach.closeCta}</div>
                </div>
              ) : null}
            </div>

            <div className="card stack">
              <h4>Step 4 - Outreach Execution</h4>
              {slot.contactPathWarning ? (
                <div className="card warning-card">
                  <b>Before contacting:</b> {slot.contactPathWarning}
                </div>
              ) : null}
              <div>
                <b>Ready to contact:</b> <PillBadge value={slot.readyToContact ? "yes" : "no"} />
              </div>
              <div className="detail-grid">
                <div className="field">
                  <label>Contact method</label>
                  <select value={exec.contactMethod ?? "phone"} onChange={(e) => updateExecution(slot.slotNumber, { contactMethod: e.target.value })}>
                    <option value="phone">phone</option>
                    <option value="email">email</option>
                    <option value="facebook">facebook</option>
                    <option value="instagram">instagram</option>
                    <option value="in-person">in-person</option>
                  </select>
                </div>
                <label className="checkline"><input type="checkbox" checked={Boolean(exec.followUpNeeded)} onChange={(e) => updateExecution(slot.slotNumber, { followUpNeeded: e.target.checked })} />Follow-up needed</label>
                <div className="field"><label>Next follow-up</label><input type="datetime-local" value={exec.nextFollowUpAt ?? ""} onChange={(e) => updateExecution(slot.slotNumber, { nextFollowUpAt: e.target.value })} /></div>
              </div>
              <div className="field"><label>Execution notes</label><textarea value={exec.notes ?? ""} onChange={(e) => updateExecution(slot.slotNumber, { notes: e.target.value })} /></div>
              <button disabled={Boolean(busy) || !slot.leadId || !slot.readyToContact} onClick={() => act(`exec-${slot.slotNumber}`, () => api.fieldTestExecuteOutreach(slot.slotNumber, exec), "Outreach execution recorded.")}>Mark Outreach Completed</button>
            </div>

            <div className="card stack">
              <h4>Step 5 - Outcome Tracking</h4>
              <div className="field">
                <label>Outcome</label>
                <select value={outcome.status ?? "no_response"} onChange={(e) => updateOutcome(slot.slotNumber, { status: e.target.value })}>
                  <option value="no_response">no response</option>
                  <option value="replied">replied</option>
                  <option value="interested">interested</option>
                  <option value="meeting_booked">meeting/booked</option>
                  <option value="rejected">rejected</option>
                </select>
              </div>
              <div className="field"><label>Outcome notes</label><textarea value={outcome.notes ?? ""} onChange={(e) => updateOutcome(slot.slotNumber, { notes: e.target.value })} /></div>
              <button disabled={Boolean(busy) || slot.steps.outreachExecution.status !== "passed"} onClick={() => act(`outcome-${slot.slotNumber}`, () => api.fieldTestRecordOutcome(slot.slotNumber, outcome), "Outcome recorded.")}>Record Outcome</button>
            </div>
          </div>
        );
      })}

      {test.finalReport ? (
        <div className="card stack">
          <h3 className="section-title">Final Field Test Report</h3>
          <PillBadge value={test.finalReport.pass ? "PASS" : "FAIL"} />
          <div>{test.finalReport.summary}</div>
          {(test.finalReport.recommendations ?? []).map((item, idx) => (
            <div key={idx} className="muted">- {item}</div>
          ))}
          <div className="field">
            <label>Copyable summary</label>
            <textarea readOnly value={test.finalReport.exportText ?? ""} />
          </div>
          <button onClick={() => copyText(test.finalReport.exportText, "Final report summary")}>
            Copy Final Report
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AutonomousFieldTestPage() {
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [contactApprovals, setContactApprovals] = useState({});
  const [form, setForm] = useState({
    objective: "Book 3 meetings with local pressure washing companies.",
    location: "Houston, Texas",
    maxProspects: 8,
  });

  const mission = view?.mission;

  const load = async () => {
    try {
      setView(await api.autonomousFieldTest());
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load autonomous field test mission.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startMission = async () => {
    setBusy("start");
    try {
      const next = await api.startAutonomousFieldTest(form);
      setView(next);
      notify("Autonomous mission created.");
    } catch (err) {
      notify(err.message || "Mission creation failed.", "error");
    } finally {
      setBusy("");
    }
  };

  const runCycle = async () => {
    setBusy("cycle");
    try {
      const next = await api.runAutonomousFieldTestCycle();
      setView(next);
      notify("Autonomous mission cycle completed.");
    } catch (err) {
      notify(err.message || "Autonomous mission cycle failed.", "error");
      await load();
    } finally {
      setBusy("");
    }
  };

  const refreshRouting = async () => {
    setBusy("routing");
    try {
      const next = await api.refreshAutonomousContactRouting(true);
      setView(next);
      notify("Compliance contact routing refreshed.");
    } catch (err) {
      notify(err.message || "Contact routing refresh failed.", "error");
    } finally {
      setBusy("");
    }
  };

  const patchLeadAndReload = async (leadId, patch, message) => {
    setBusy(leadId);
    try {
      await api.patchLead(leadId, patch);
      await load();
      notify(message);
    } catch (err) {
      notify(err.message || "Lead update failed.", "error");
    } finally {
      setBusy("");
    }
  };

  const markMissionContacted = async (lead) => {
    if (!contactApprovals[lead.id]) {
      notify("Confirm manual approval before marking this lead contacted.", "error");
      return;
    }
    if (lead.contactAllowed === false) {
      notify("This lead is blocked from contact.", "error");
      return;
    }
    await patchLeadAndReload(lead.id, {
      pipelineStage: "contacted",
      replyStatus: "contacted",
      contactedAt: new Date().toISOString(),
      lastContactedAt: new Date().toISOString(),
      lastContactAttemptAt: new Date().toISOString(),
      lastContactChannel: "phone",
    }, "Mission outreach marked contacted.");
    setContactApprovals((current) => ({ ...current, [lead.id]: false }));
  };

  if (!view) {
    return <div className="card muted">{error || "Loading autonomous field test..."}</div>;
  }

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">Autonomous Field Test Mode</h2>
          <div className="muted">
            Mission-level orchestration for discovery, demos, outreach packages, and execution tracking.
          </div>
        </div>
        <PillBadge value={mission?.status ?? "not_started"} />
      </div>

      <div className="card stack mission-panel">
        <h3 className="section-title">Mission Objective</h3>
        <div className="field">
          <label>Mission</label>
          <input
            value={form.objective}
            onChange={(e) => setForm({ ...form, objective: e.target.value })}
            placeholder="Book 3 meetings with local pressure washing companies."
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Houston, Texas"
            />
          </div>
          <div className="field">
            <label>Max prospects this cycle</label>
            <input
              type="number"
              min="1"
              max="50"
              value={form.maxProspects}
              onChange={(e) => setForm({ ...form, maxProspects: e.target.value })}
            />
          </div>
        </div>
        <div className="btn-row">
          <button disabled={Boolean(busy)} onClick={startMission}>
            {busy === "start" ? "Creating..." : "Create Mission"}
          </button>
          <button disabled={Boolean(busy) || !mission?.objective} onClick={runCycle}>
            {busy === "cycle" ? "Running Cycle..." : "Run Autonomous Cycle"}
          </button>
          <button disabled={Boolean(busy) || !mission?.objective} onClick={refreshRouting}>
            {busy === "routing" ? "Routing..." : "Refresh Contact Routing"}
          </button>
          <button className="button-ghost" disabled={Boolean(busy)} onClick={load}>Refresh</button>
        </div>
        {mission?.objective ? (
          <div className="muted">
            Active mission: {mission.objective} · {mission.location} · target {mission.targetMeetings} meeting(s)
          </div>
        ) : null}
      </div>

      <div className="grid-cards">
        <div className="card"><h4>Prospects Found</h4><div className="value">{view.stats.prospectsFound}</div></div>
        <div className="card"><h4>Demos Generated</h4><div className="value">{view.stats.demosGenerated}</div></div>
        <div className="card"><h4>Outreach Completed</h4><div className="value">{view.stats.outreachCompleted}</div></div>
        <div className="card"><h4>Replies</h4><div className="value">{view.stats.replies}</div></div>
        <div className="card"><h4>Meetings Booked</h4><div className="value">{view.stats.meetingsBooked}</div></div>
        <div className="card"><h4>Confidence</h4><div className="value">{view.confidenceScore}%</div></div>
      </div>

      <div className="card stack">
        <h3 className="section-title">Mission Dashboard</h3>
        <div><b>Current bottleneck:</b> <PillBadge value={view.bottleneck.primary} /></div>
        <div><b>Next recommended action:</b> {view.nextRecommendedAction}</div>
        {(view.bottleneck.evidence ?? []).length ? (
          <div className="log-box">
            {view.bottleneck.evidence.map((item) => <div key={item}>{item}</div>)}
          </div>
        ) : (
          <div className="muted">No bottleneck evidence yet.</div>
        )}
      </div>

      <div className="card stack">
        <h3 className="section-title">Execution Queue</h3>
        {!view.executionQueue.length ? (
          <div className="muted">No mission prospects yet. Create a mission, then run the autonomous cycle.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Status</th>
                  <th>Compliance Routing</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {view.executionQueue.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <Link to={`/leads/${lead.id}`}>{lead.businessName}</Link>
                      <div className="muted compact-meta">{lead.city} · {lead.category} · score {lead.score ?? 0}</div>
                    </td>
                    <td>
                      <PillBadge value={lead.previewStatus} /> <PillBadge value={lead.pipelineStage} /> <PillBadge value={lead.replyStatus} />
                    </td>
                    <td>
                      <PillBadge value={lead.readyToContact ? "ready" : "not_ready"} />
                      <PillBadge value={lead.contactAllowed === false ? "blocked" : "contact_allowed"} />
                      <PillBadge value={lead.contactRisk ?? "medium"} />
                      <div className="muted compact-meta">Paths: {lead.contactPaths.length ? lead.contactPaths.join(", ") : "No contact path"}</div>
                      <div className="muted compact-meta">Phone: {lead.phoneType ?? "unknown"} · consent: {lead.consentStatus ?? "unknown"}</div>
                      <div className="compact-meta">Route: {lead.recommendedChannel || "manual_review"}</div>
                      <div className="muted compact-meta">{lead.recommendedAction || "Manual review required."}</div>
                      {lead.phoneType === "unknown" || lead.consentStatus === "unknown" || lead.complianceWarning ? (
                        <div className="card warning-card compact-meta">
                          {lead.complianceWarning || "Phone type or consent is unknown. Review manually before contact."}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className="btn-row">
                        <Link className="button-link" to={`/leads/${lead.id}/preview`}>Preview</Link>
                        <label className="checkline" title="Required because this system prepares outreach only; the operator must approve any manual contact.">
                          <input
                            type="checkbox"
                            checked={Boolean(contactApprovals[lead.id])}
                            onChange={(e) => setContactApprovals((current) => ({
                              ...current,
                              [lead.id]: e.target.checked,
                            }))}
                          />
                          Manual approval
                        </label>
                        <button
                          disabled={Boolean(busy) || !lead.readyToContact || lead.contactAllowed === false || !contactApprovals[lead.id]}
                          onClick={() => markMissionContacted(lead)}
                          title={
                            lead.contactAllowed === false
                              ? "Contact is blocked."
                              : !contactApprovals[lead.id]
                                ? "Manual approval is required before marking contacted."
                                : ""
                          }
                        >
                          Mark Contacted
                        </button>
                        <button
                          disabled={Boolean(busy)}
                          onClick={() => patchLeadAndReload(lead.id, {
                            pipelineStage: "replied",
                            replyStatus: "replied",
                          }, "Mission lead marked replied.")}
                        >
                          Mark Replied
                        </button>
                        <button
                          disabled={Boolean(busy)}
                          onClick={() => patchLeadAndReload(lead.id, {
                            dealStage: "interested",
                            pipelineStage: "replied",
                            replyStatus: "replied",
                          }, "Mission meeting/interest recorded.")}
                        >
                          Meeting Booked
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card stack">
        <h3 className="section-title">Outreach Packages</h3>
        {(mission?.packages ?? []).length ? (
          <div className="grid-cards">
            {mission.packages.map((pkg) => (
              <div key={pkg.leadId} className="card stack">
                <div>
                  <b>{pkg.businessName}</b>
                  <div className="muted compact-meta">{pkg.city} · {pkg.category}</div>
                  <div className="compact-meta">
                    <PillBadge value={pkg.phoneType ?? "unknown"} /> <PillBadge value={pkg.contactRisk ?? "medium"} />{" "}
                    <PillBadge value={pkg.contactAllowed === false ? "blocked" : pkg.recommendedChannel ?? "manual_review"} />
                  </div>
                </div>
                <div><b>Subject:</b> {pkg.outreachSubject}</div>
                <div className="muted">{pkg.outreachBody}</div>
                <div className="muted"><b>Compliance route:</b> {pkg.recommendedAction || "Manual review required."}</div>
                <div className="muted">{pkg.closeCta}</div>
                <div className="btn-row">
                  <button onClick={() => copyText(`${pkg.outreachSubject}\n\n${pkg.outreachBody}`, "Outreach message")}>
                    Copy Outreach
                  </button>
                  <Link className="button-link" to={`/leads/${pkg.leadId}`}>Open Lead</Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">Outreach packages will appear after the autonomous cycle qualifies prospects.</div>
        )}
      </div>

      <div className="card stack">
        <h3 className="section-title">Mission Log</h3>
        {(mission?.logs ?? []).length ? (
          <div className="log-box">
            {mission.logs.slice(-30).reverse().map((entry, idx) => (
              <div key={`${entry.at}-${idx}`}>{new Date(entry.at).toLocaleTimeString()} · {entry.step}: {entry.message}</div>
            ))}
          </div>
        ) : (
          <div className="muted">No mission activity yet.</div>
        )}
      </div>
    </div>
  );
}

function ManualLeadPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [mode, setMode] = useState("single");
  const [targetLeadGroupId, setTargetLeadGroupId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lead, setLead] = useState({
    businessName: "",
    category: "",
    city: "",
    phone: "",
    websiteUrl: "",
    googleReviewCount: 0,
    googleRating: 0,
    weakWebsite: false,
    socialEvidence: false,
    strongProof: false,
    notes: "",
  });
  const [text, setText] = useState("");
  const [createdLead, setCreatedLead] = useState(null);

  useEffect(() => {
    api.leadRuns(200).then(setGroups).catch(() => setGroups([]));
  }, []);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const result =
        mode === "single"
          ? await api.createLead({ ...lead, targetLeadGroupId })
          : await api.importLeadText(text, targetLeadGroupId);
      setCreatedLead(result);
      notify("Lead saved.");
    } catch (err) {
      setError(err.message || "Failed to save lead.");
      notify(err.message || "Failed to save lead.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="topbar">
        <h2 className="section-title">Create / Import Lead</h2>
        <button className="button-ghost" onClick={() => navigate("/mission-control")}>Back</button>
      </div>
      <div className="card muted">
        What to do next: create a lead manually or paste text, assign it to a Target Lead Group, then enrich or generate a preview.
      </div>
      <div className="card stack">
        <div className="field">
          <label>Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="single">Create single lead manually</option>
            <option value="paste">Paste/import lead text</option>
          </select>
        </div>
        <div className="field">
          <label>Assign to Target Lead Group</label>
          <select value={targetLeadGroupId} onChange={(e) => setTargetLeadGroupId(e.target.value)}>
            <option value="">None</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.title}</option>
            ))}
          </select>
        </div>
        {mode === "single" ? (
          <div className="detail-grid">
            {["businessName", "category", "city", "phone", "websiteUrl"].map((key) => (
              <div key={key} className="field">
                <label>{key}</label>
                <input value={lead[key]} onChange={(e) => setLead((l) => ({ ...l, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="field">
              <label>Review count</label>
              <input type="number" value={lead.googleReviewCount} onChange={(e) => setLead((l) => ({ ...l, googleReviewCount: e.target.value }))} />
            </div>
            <div className="field">
              <label>Star rating</label>
              <input type="number" step="0.1" value={lead.googleRating} onChange={(e) => setLead((l) => ({ ...l, googleRating: e.target.value }))} />
            </div>
            <label className="checkline"><input type="checkbox" checked={lead.weakWebsite} onChange={(e) => setLead((l) => ({ ...l, weakWebsite: e.target.checked }))} />Weak website</label>
            <label className="checkline"><input type="checkbox" checked={lead.socialEvidence} onChange={(e) => setLead((l) => ({ ...l, socialEvidence: e.target.checked }))} />Social evidence</label>
            <label className="checkline"><input type="checkbox" checked={lead.strongProof} onChange={(e) => setLead((l) => ({ ...l, strongProof: e.target.checked }))} />Strong proof</label>
          </div>
        ) : (
          <div className="field">
            <label>Pasted lead text</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"Business Name\nTree service\nBeaumont TX\n(409) 555-0100\nNo website\n18 reviews\n4.8 stars"} />
          </div>
        )}
        {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
        <button className="button-primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save Lead"}</button>
      </div>
      {createdLead ? (
        <div className="card stack">
          <h3 className="section-title">Saved Lead</h3>
          <div>{createdLead.businessName} · Score {createdLead.score} · {createdLead.status}</div>
          <div className="btn-row">
            <Link className="button-link" to={`/leads/${createdLead.id}`}>View lead</Link>
            <button onClick={async () => {
              try {
                const updated = await api.enrichLead(createdLead.id);
                setCreatedLead(updated);
                notify("Lead enriched.");
              } catch (err) {
                notify(err.message || "Enrichment failed.", "error");
              }
            }}>Enrich after save</button>
            <button onClick={async () => {
              try {
                await api.generatePreview(createdLead.id);
                notify("Preview generated.");
                navigate(`/leads/${createdLead.id}/preview`);
              } catch (err) {
                notify(err.message || "Preview generation failed.", "error");
              }
            }}>Generate preview</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SettingsPage() {
  const [status, setStatus] = useState(null);
  const [cleanupPreview, setCleanupPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setStatus(await api.adminSystemStatus());
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load system status.");
      notify(err.message || "Failed to load system status.", "error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const dryRunCleanup = async () => {
    setBusy(true);
    try {
      const result = await api.cleanupTestRecords({ dryRun: true });
      setCleanupPreview(result);
      notify("Cleanup dry run complete.");
    } catch (err) {
      notify(err.message || "Cleanup dry run failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const runCleanup = async () => {
    const ok = await confirmAction({
      title: "Delete matched test records?",
      message:
        "This removes only records matching E2E/TEST patterns. Existing data files are backed up before writes.",
      confirmLabel: "Delete test records",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await api.cleanupTestRecords({
        dryRun: false,
        confirm: "DELETE TEST RECORDS",
      });
      setCleanupPreview(result);
      await load();
      notify("Test records cleaned up. Backups created.");
    } catch (err) {
      notify(err.message || "Cleanup failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const retryRecovery = async (item) => {
    if (!item.leadId || !item.action || item.action === "review_group") {
      notify("Open the referenced group or lead to review this warning.", "error");
      return;
    }
    setBusy(true);
    try {
      await api.retryRecovery(item.leadId, item.action);
      await load();
      notify("Recovery action completed.");
    } catch (err) {
      notify(err.message || "Recovery action failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">Settings</h2>
          <div className="muted">System status, local storage health, and safe test-data cleanup.</div>
        </div>
        <button className="button-ghost" onClick={load}>Refresh</button>
      </div>
      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
      {!status ? (
        <div className="card muted">Loading system status...</div>
      ) : (
        <>
          <div className="grid-cards">
            <div className="card"><h4>Admin Account</h4><div className="value">{status.admin?.hasAdminAccount ? "Ready" : "Missing"}</div><div className="muted">{status.admin?.email ?? status.admin?.authMode}</div></div>
            <div className="card"><h4>Leads</h4><div className="value">{status.counts?.leads ?? 0}</div></div>
            <div className="card"><h4>Lead Groups</h4><div className="value">{status.counts?.leadGroups ?? 0}</div></div>
            <div className="card"><h4>Generation Runs</h4><div className="value">{status.counts?.generationRuns ?? 0}</div></div>
            <div className="card"><h4>Preview Folders</h4><div className="value">{status.counts?.previewFolders ?? 0}</div></div>
            <div className="card"><h4>Render Screenshots</h4><div className="value">{status.counts?.renderScreenshots ?? 0}</div></div>
          </div>

          <div className="card stack">
            <h3 className="section-title">Runtime + Storage</h3>
            <div className="detail-grid">
              <div><b>OpenAI key detected:</b> <PillBadge value={status.integrations?.openAiKeyDetected ? "yes" : "no"} /></div>
              <div><b>Playwright available:</b> <PillBadge value={status.integrations?.playwrightAvailable ? "yes" : "no"} /></div>
              <div><b>Last backup:</b> {status.storage?.lastBackupAt ? new Date(status.storage.lastBackupAt).toLocaleString() : "No backup detected yet"}</div>
              <div><b>Data folder:</b> <span className="muted">{status.storage?.dataDir}</span></div>
            </div>
          </div>

          <div className="card stack">
            <div className="topbar" style={{ marginBottom: 0 }}>
              <div>
                <h3 className="section-title">Recovery Queue</h3>
                <div className="muted">
                  {status.recovery?.warningCount ?? 0} warning(s), {status.recovery?.criticalCount ?? 0} critical,{" "}
                  {status.recovery?.failedJobs ?? 0} failed job(s) needing attention.
                </div>
              </div>
              <PillBadge value={(status.recovery?.criticalCount ?? 0) ? "critical" : "clear"} />
            </div>
            {(status.recovery?.queue ?? []).length ? (
              <div className="stack">
                {status.recovery.queue.slice(0, 20).map((item) => (
                  <div key={item.id} className="card">
                    <div className="topbar" style={{ marginBottom: 0 }}>
                      <div>
                        <b>{item.businessName || item.type}</b> · <PillBadge value={item.severity} />
                        <div className="muted">{item.message}</div>
                        <div>{item.recommendation}</div>
                      </div>
                      <button disabled={busy || !item.action} onClick={() => retryRecovery(item)}>
                        {item.action === "review_group" ? "Review" : "Retry"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">No recovery warnings detected.</div>
            )}
          </div>

          <div className="card stack">
            <h3 className="section-title">Safe Test Data Cleanup</h3>
            <p className="muted">
              Removes only records with obvious E2E/TEST markers in lead names, notes, run IDs, or run titles.
              Real leads are never removed by this tool unless they match those test markers.
            </p>
            <div className="btn-row">
              <button disabled={busy} onClick={dryRunCleanup}>Preview cleanup</button>
              <button className="button-danger" disabled={busy || !cleanupPreview} onClick={runCleanup} title={!cleanupPreview ? "Run preview cleanup first." : ""}>
                Delete matched test records
              </button>
            </div>
            {cleanupPreview ? (
              <div className="log-box">
                <div>Dry run: {String(cleanupPreview.dryRun)}</div>
                <div>Matched leads: {cleanupPreview.removed?.leads ?? 0}</div>
                <div>Matched Target Lead Groups: {cleanupPreview.removed?.leadGroups ?? 0}</div>
                <div>Matched generation runs: {cleanupPreview.removed?.generationRuns ?? 0}</div>
                {cleanupPreview.backupsCreated?.length ? (
                  <div>Backups: {cleanupPreview.backupsCreated.join(" | ")}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function OperationsPage() {
  const [ops, setOps] = useState(null);
  const [busy, setBusy] = useState("");
  const [clientForm, setClientForm] = useState({
    companyName: "",
    primaryContact: "",
    email: "",
    phone: "",
    plan: "maintenance",
  });
  const [siteForm, setSiteForm] = useState({
    clientId: "",
    domain: "",
    hostingProvider: "",
    deploymentUrl: "",
  });
  const [requestForm, setRequestForm] = useState({
    clientId: "",
    siteId: "",
    title: "",
    priority: "normal",
    notes: "",
  });
  const [manualBilling, setManualBilling] = useState({});

  const load = async () => {
    setOps(await api.operations());
  };

  useEffect(() => {
    load().catch((err) => notify(err.message || "Failed to load operations.", "error"));
  }, []);

  const act = async (key, fn, message) => {
    setBusy(key);
    // #region agent log
    fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H7',location:'mission-control/src/App.jsx:4062',message:'operations ui action started',data:{key,clientCount:ops?.clients?.length ?? 0,clientFormReady:Boolean(clientForm.companyName && clientForm.plan),siteFormReady:Boolean(siteForm.clientId && (siteForm.domain || siteForm.deploymentUrl)),requestFormReady:Boolean(requestForm.clientId && requestForm.title && requestForm.priority)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      await fn();
      await load();
      // #region agent log
      fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H7',location:'mission-control/src/App.jsx:4067',message:'operations ui action succeeded',data:{key},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      notify(message);
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H7',location:'mission-control/src/App.jsx:4071',message:'operations ui action failed',data:{key,error:err.message},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      notify(err.message || "Operation failed.", "error");
    } finally {
      setBusy("");
    }
  };

  if (!ops) return <div className="card muted">Loading client operations...</div>;

  const clientsById = new Map((ops.clients ?? []).map((client) => [client.clientId, client]));
  const sitesByClient = new Map();
  for (const site of ops.sites ?? []) {
    sitesByClient.set(site.clientId, [...(sitesByClient.get(site.clientId) ?? []), site]);
  }
  const openRequests = (ops.maintenanceRequests ?? []).filter((request) =>
    !["completed", "cancelled"].includes(request.status)
  );
  const overdueRequests = openRequests.filter((request) => {
    const assigned = new Date(request.assignedDate);
    if (Number.isNaN(assigned.getTime())) return false;
    const ageDays = (Date.now() - assigned.getTime()) / (24 * 60 * 60 * 1000);
    return request.priority === "urgent" ? ageDays > 1 : request.priority === "high" ? ageDays > 3 : ageDays > 7;
  });
  const activeClients = (ops.clients ?? []).filter((client) => client.status !== "archived");
  const daily = ops.dailyOperatorView ?? {};
  const billingSetup = ops.billingSetup ?? {};
  const missingCheckoutEnv = billingSetup.checkoutMissing ?? [];
  const missingWebhookEnv = billingSetup.webhookMissing ?? [];

  const startCheckout = async (client) => {
    await act(`checkout-${client.clientId}`, async () => {
      const result = await api.createMaintenanceCheckout(client.clientId);
      const url = result.session?.url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    }, "Stripe Checkout session created.");
  };

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">Client Operations</h2>
          <div className="muted">Post-sale source of truth for clients, sites, and maintenance requests.</div>
        </div>
        <button className="button-ghost" onClick={load}>Refresh</button>
      </div>

      <div className="grid-cards">
        <div className="card"><h4>Active Clients</h4><div className="value">{ops.summary?.activeClients ?? 0}</div></div>
        <div className="card"><h4>Archived Clients</h4><div className="value">{ops.summary?.archivedClients ?? 0}</div></div>
        <div className="card"><h4>Sites</h4><div className="value">{ops.summary?.sites ?? 0}</div></div>
        <div className="card"><h4>Open Requests</h4><div className="value">{ops.summary?.openRequests ?? 0}</div></div>
        <div className="card"><h4>Overdue Requests</h4><div className="value">{ops.summary?.overdueRequests ?? 0}</div></div>
        <div className="card"><h4>Onboarding Complete</h4><div className="value">{ops.summary?.onboarding?.complete ?? 0}</div></div>
        <div className="card"><h4>At Risk</h4><div className="value">{ops.summary?.health?.atRisk ?? 0}</div></div>
        <div className="card"><h4>Billing Active</h4><div className="value">{ops.summary?.billing?.active ?? 0}</div></div>
        <div className="card"><h4>Past Due</h4><div className="value">{ops.summary?.billing?.pastDue ?? 0}</div></div>
      </div>

      {!billingSetup.configured || !billingSetup.webhookConfigured ? (
        <div className="card warning-card">
          <b>Stripe setup warning:</b> Operations stays usable, but billing automation is limited until setup is complete.
          {missingCheckoutEnv.length ? (
            <div className="compact-meta">Checkout missing: {missingCheckoutEnv.join(", ")}</div>
          ) : null}
          {missingWebhookEnv.length ? (
            <div className="compact-meta">Webhooks missing: {missingWebhookEnv.join(", ")}</div>
          ) : null}
        </div>
      ) : (
        <div className="card muted">Stripe billing foundation is configured.</div>
      )}

      <div className="card stack mission-panel">
        <h3 className="section-title">Today&apos;s Client Ops</h3>
        <div className="grid-cards">
          <div className="card"><h4>Priority Requests</h4><div className="value">{daily.priorityRequests?.length ?? 0}</div></div>
          <div className="card"><h4>Needs Onboarding</h4><div className="value">{daily.clientsNeedingOnboarding?.length ?? 0}</div></div>
          <div className="card"><h4>Sites Need Attention</h4><div className="value">{daily.sitesNeedingAttention?.length ?? 0}</div></div>
          <div className="card"><h4>Billing Issues</h4><div className="value">{daily.billingIssues?.length ?? 0}</div></div>
        </div>
        <div className="detail-grid">
          <div>
            <b>Today&apos;s priority requests</b>
            {(daily.priorityRequests ?? []).length ? daily.priorityRequests.map((request) => (
              <div key={request.requestId} className="muted compact-meta">
                {request.title} · {request.priority} · {clientsById.get(request.clientId)?.companyName ?? "Unknown client"}
              </div>
            )) : <div className="muted compact-meta">No high-priority requests.</div>}
          </div>
          <div>
            <b>Clients needing onboarding</b>
            {(daily.clientsNeedingOnboarding ?? []).length ? daily.clientsNeedingOnboarding.map((client) => (
              <div key={client.clientId} className="muted compact-meta">{client.companyName} · {client.onboardingStatus}</div>
            )) : <div className="muted compact-meta">No onboarding blockers.</div>}
          </div>
          <div>
            <b>Sites needing attention</b>
            {(daily.sitesNeedingAttention ?? []).length ? daily.sitesNeedingAttention.map((site) => (
              <div key={site.siteId} className="muted compact-meta">
                {site.domain || site.deploymentUrl || site.siteId} · SSL {site.sslStatus} · uptime {site.uptimeStatus}
              </div>
            )) : <div className="muted compact-meta">No site warnings.</div>}
          </div>
          <div>
            <b>Billing issues</b>
            {(daily.billingIssues ?? []).length ? daily.billingIssues.map((client) => (
              <div key={client.clientId} className="muted compact-meta">
                {client.companyName} · {client.billingStatus} · failed payments {client.failedPaymentCount ?? 0}
              </div>
            )) : <div className="muted compact-meta">No billing issues.</div>}
          </div>
        </div>
      </div>

      {(ops.healthWarnings ?? []).length ? (
        <div className="card stack warning-card">
          <h3 className="section-title">Operations Health Warnings</h3>
          {ops.healthWarnings.map((warning, idx) => (
            <div key={`${warning.type}-${warning.clientId ?? warning.siteId ?? warning.requestId ?? idx}`}>
              <PillBadge value={warning.severity} /> {warning.message}
            </div>
          ))}
        </div>
      ) : (
        <div className="card muted">Operations health checks are clear.</div>
      )}

      <div className="detail-grid">
        <div className="card stack">
          <h3 className="section-title">Create Client</h3>
          {["companyName", "primaryContact", "email", "phone", "plan"].map((key) => (
            <div key={key} className="field">
              <label>{key}</label>
              <input value={clientForm[key]} onChange={(e) => setClientForm((form) => ({ ...form, [key]: e.target.value }))} />
            </div>
          ))}
          <button
            disabled={Boolean(busy) || !clientForm.companyName || !clientForm.plan}
            onClick={() => act("client", () => api.createOperationClient(clientForm), "Client created.")}
          >
            Add Client
          </button>
        </div>

        <div className="card stack">
          <h3 className="section-title">Add Site</h3>
          <div className="field">
            <label>Client</label>
            <select value={siteForm.clientId} onChange={(e) => setSiteForm((form) => ({ ...form, clientId: e.target.value }))}>
              <option value="">Select client...</option>
              {activeClients.map((client) => (
                <option key={client.clientId} value={client.clientId}>{client.companyName}</option>
              ))}
            </select>
          </div>
          {["domain", "hostingProvider", "deploymentUrl"].map((key) => (
            <div key={key} className="field">
              <label>{key}</label>
              <input value={siteForm[key]} onChange={(e) => setSiteForm((form) => ({ ...form, [key]: e.target.value }))} />
            </div>
          ))}
          <button
            disabled={Boolean(busy) || !siteForm.clientId || (!siteForm.domain && !siteForm.deploymentUrl)}
            onClick={() => act("site", () => api.createOperationSite(siteForm), "Site added.")}
          >
            Add Site
          </button>
        </div>

        <div className="card stack">
          <h3 className="section-title">Create Maintenance Request</h3>
          <div className="field">
            <label>Client</label>
            <select value={requestForm.clientId} onChange={(e) => setRequestForm((form) => ({ ...form, clientId: e.target.value, siteId: "" }))}>
              <option value="">Select client...</option>
              {activeClients.map((client) => (
                <option key={client.clientId} value={client.clientId}>{client.companyName}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Site</label>
            <select value={requestForm.siteId} onChange={(e) => setRequestForm((form) => ({ ...form, siteId: e.target.value }))}>
              <option value="">No specific site</option>
              {(sitesByClient.get(requestForm.clientId) ?? []).map((site) => (
                <option key={site.siteId} value={site.siteId}>{site.domain || site.deploymentUrl || site.siteId}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Title</label>
            <input value={requestForm.title} onChange={(e) => setRequestForm((form) => ({ ...form, title: e.target.value }))} />
          </div>
          <div className="field">
            <label>Priority</label>
            <select value={requestForm.priority} onChange={(e) => setRequestForm((form) => ({ ...form, priority: e.target.value }))}>
              {["low", "normal", "high", "urgent"].map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea value={requestForm.notes} onChange={(e) => setRequestForm((form) => ({ ...form, notes: e.target.value }))} />
          </div>
          <button
            disabled={Boolean(busy) || !requestForm.clientId || !requestForm.title || !requestForm.priority}
            onClick={() => act("request", () => api.createMaintenanceRequest({ ...requestForm, status: "submitted" }), "Maintenance request created.")}
          >
            Add Request
          </button>
        </div>
      </div>

      <div className="card stack">
        <h3 className="section-title">Client Registry</h3>
        {(ops.clients ?? []).length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Billing</th>
                  <th>Health</th>
                  <th>Sites</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ops.clients.map((client) => {
                  const subscriptionConfirmed = Boolean(client.stripeSubscriptionId);
                  const subscriptionActive = subscriptionConfirmed && client.billingStatus === "active";
                  return (
                  <tr key={client.clientId}>
                    <td>
                      <b>{client.companyName}</b>
                      <div className="muted compact-meta">{client.primaryContact || "No contact"} · {client.email || client.phone || "No contact path"}</div>
                    </td>
                    <td>
                      <PillBadge value={client.status ?? "active"} /> <PillBadge value={client.billingStatus} /> <PillBadge value={client.onboardingStatus} /> <PillBadge value={client.supportStatus} />
                    </td>
                    <td>
                      <div>
                        <PillBadge value={subscriptionActive ? "subscription_active" : "subscription_inactive"} />
                        {!subscriptionConfirmed ? <PillBadge value="no_subscription_id" /> : null}
                        {client.lastPaymentStatus && client.lastPaymentStatus !== "unknown" ? <PillBadge value={client.lastPaymentStatus} /> : null}
                      </div>
                      {client.failedPaymentCount ? (
                        <div className="card warning-card compact-meta">{client.failedPaymentCount} failed payment(s)</div>
                      ) : null}
                      {client.cancellationStatus && client.cancellationStatus !== "none" ? (
                        <div className="muted compact-meta">Cancellation: {client.cancellationStatus} {client.cancellationReason ? `· ${client.cancellationReason}` : ""}</div>
                      ) : null}
                      <div className="muted compact-meta">
                        Period end: {client.currentPeriodEnd ? new Date(client.currentPeriodEnd).toLocaleDateString() : "not set"}
                      </div>
                      <div className="btn-row">
                        <button
                          disabled={Boolean(busy) || subscriptionConfirmed}
                          onClick={() => startCheckout(client)}
                          title={subscriptionConfirmed ? "Client already has a Stripe subscription ID." : ""}
                        >
                          Setup Checkout
                        </button>
                        <select
                          value={manualBilling[client.clientId] ?? client.billingStatus ?? "not_configured"}
                          onChange={(e) => setManualBilling((current) => ({ ...current, [client.clientId]: e.target.value }))}
                        >
                          {["not_configured", "checkout_started", "active", "past_due", "canceled"].map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <button
                          className="button-ghost"
                          disabled={Boolean(busy)}
                          onClick={() => act(
                            `manual-billing-${client.clientId}`,
                            () => api.patchClientBilling(client.clientId, manualBilling[client.clientId] ?? client.billingStatus ?? "not_configured"),
                            "Manual dev billing status updated."
                          )}
                        >
                          Local Dev Billing Update
                        </button>
                      </div>
                      <div className="muted compact-meta">Manual billing status is for local testing only.</div>
                    </td>
                    <td>{client.healthScore}</td>
                    <td>{(sitesByClient.get(client.clientId) ?? []).length}</td>
                    <td>
                      <button
                        className="button-danger"
                        disabled={Boolean(busy) || client.status === "archived"}
                        onClick={() => act(`archive-${client.clientId}`, () => api.archiveOperationClient(client.clientId), "Client archived.")}
                      >
                        Archive
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted">No clients yet. Convert a won deal or create a client manually.</div>
        )}
      </div>

      <div className="card stack">
        <h3 className="section-title">Site Registry</h3>
        {(ops.sites ?? []).length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Client</th>
                  <th>Health</th>
                  <th>Deployment</th>
                </tr>
              </thead>
              <tbody>
                {ops.sites.map((site) => (
                  <tr key={site.siteId}>
                    <td>{site.domain || "No domain"}<div className="muted compact-meta">{site.hostingProvider}</div></td>
                    <td>{clientsById.get(site.clientId)?.companyName ?? "Unknown client"}</td>
                    <td><PillBadge value={site.sslStatus} /> <PillBadge value={site.backupStatus} /> <PillBadge value={site.uptimeStatus} /></td>
                    <td>{site.deploymentUrl || "Not deployed"}<div className="muted compact-meta">{site.lastDeployment ? new Date(site.lastDeployment).toLocaleString() : "No deployment recorded"}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted">No sites registered yet.</div>
        )}
      </div>

      <div className="card stack">
        <h3 className="section-title">Maintenance Queue</h3>
        {overdueRequests.length ? <div className="card warning-card">{overdueRequests.length} overdue request(s) need attention.</div> : null}
        {(ops.maintenanceRequests ?? []).length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Dates</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ops.maintenanceRequests.map((request) => (
                  <tr key={request.requestId}>
                    <td><b>{request.title}</b><div className="muted compact-meta">{request.notes || "No notes"}</div></td>
                    <td>{clientsById.get(request.clientId)?.companyName ?? "Unknown client"}</td>
                    <td><PillBadge value={request.priority} /> <PillBadge value={request.status} /></td>
                    <td>
                      Assigned {request.assignedDate ? new Date(request.assignedDate).toLocaleDateString() : "—"}
                      <div className="muted compact-meta">Completed {request.completedDate ? new Date(request.completedDate).toLocaleDateString() : "—"}</div>
                    </td>
                    <td>
                      <div className="btn-row">
                        {["approved", "in_progress", "waiting_client", "completed", "cancelled"].map((status) => (
                          <button
                            key={status}
                            disabled={Boolean(busy) || request.status === status}
                            onClick={() => act(`request-${request.requestId}-${status}`, () => api.patchMaintenanceRequest(request.requestId, { status }), `Request marked ${status}.`)}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted">No maintenance requests yet.</div>
        )}
      </div>
    </div>
  );
}

function ProtectedApp({ onLogout }) {
  return (
    <Shell onLogout={onLogout}>
      <Routes>
        <Route path="/mission-control" element={<MissionControlPage />} />
        <Route path="/lead-generation" element={<LeadGenerationPage />} />
        <Route path="/lead-generation/runs" element={<LeadGenerationRunsPage />} />
        <Route path="/autopilot" element={<AutopilotPage />} />
        <Route path="/opportunities" element={<OpportunitiesPage />} />
        <Route path="/projects" element={<DemoProjectsPage />} />
        <Route path="/field-test" element={<FieldTestPage />} />
        <Route path="/autonomous-field-test" element={<AutonomousFieldTestPage />} />
        <Route path="/leads/new" element={<ManualLeadPage />} />
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route path="/leads/:id/preview" element={<SitePreviewPage />} />
        <Route path="/targets" element={<TargetLeadGroupsPage />} />
        <Route path="/targets/:runId" element={<TargetLeadGroupDetailPage />} />
        <Route path="/outreach" element={<OutreachQueuePage />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/mission-control" replace />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  const auth = useAuth();
  const navigate = useNavigate();

  const logout = async () => {
    await api.logout();
    auth.setAuthenticated(false);
    navigate("/login");
  };

  if (auth.loading) return <div className="muted" style={{ padding: "2rem" }}>Loading session...</div>;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          auth.authenticated ? (
            <Navigate to="/mission-control" replace />
          ) : (
            <LoginPage onLogin={auth.setAuthenticated} />
          )
        }
      />
      <Route
        path="/signup"
        element={
          auth.authenticated ? (
            <Navigate to="/mission-control" replace />
          ) : (
            <SignupPage onLogin={auth.setAuthenticated} />
          )
        }
      />
      <Route
        path="*"
        element={
          auth.authenticated ? (
            <ProtectedApp onLogout={logout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
