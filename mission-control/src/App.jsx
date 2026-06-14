import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api";
import { FounderDashboardPage } from "./pages/FounderDashboardPage";
import { FounderBusinessListPage } from "./pages/FounderBusinessListPage";
import { FounderBusinessDetailPage } from "./pages/FounderBusinessDetailPage";
import { FounderPowerHourPage } from "./pages/FounderPowerHourPage";
import { FounderTimelinePage } from "./pages/FounderTimelinePage";
import "./styles.css";

function useAuth() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await api.me();
        if (active) setAuthenticated(Boolean(me.authenticated));
      } catch {
        if (active) setAuthenticated(false);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { loading, authenticated, setAuthenticated };
}

function Shell({ children, onLogout }) {
  return (
    <div className="mobile-shell">
      <header className="mobile-topbar">
        <div className="mobile-brand">
          <strong>WebLab Founder OS</strong>
        </div>
        <button className="button-ghost" type="button" onClick={onLogout}>Logout</button>
      </header>
      <main className="mobile-main">{children}</main>
      <nav className="mobile-nav">
        <NavLink className="mobile-nav-link" to="/dashboard">Dashboard</NavLink>
        <NavLink className="mobile-nav-link" to="/businesses">Businesses</NavLink>
        <NavLink className="mobile-nav-link" to="/power-hour">Power Hour</NavLink>
        <NavLink className="mobile-nav-link" to="/timeline">Timeline</NavLink>
      </nav>
    </div>
  );
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
      navigate("/home");
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
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
        <button className="button-primary" type="submit" disabled={busy}>{busy ? "Signing in..." : "Login"}</button>
        <Link className="button-link" to="/signup">Create admin account</Link>
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
    api.authStatus()
      .then((payload) => setStatus({ loading: false, signupRequired: payload.signupRequired }))
      .catch(() => setStatus({ loading: false, signupRequired: true }));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.signup(email, password);
      onLogin(true);
      navigate("/home");
    } catch (err) {
      setError(err.message || "Signup failed.");
    } finally {
      setBusy(false);
    }
  };

  if (status.loading) return <div className="muted" style={{ padding: "2rem" }}>Loading...</div>;

  return (
    <div className="login-wrap">
      <form className="login-card stack" onSubmit={submit}>
        <h2 className="section-title">Create Admin Account</h2>
        {!status.signupRequired ? (
          <p className="muted">An admin account already exists. <Link to="/login">Login instead</Link>.</p>
        ) : (
          <>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="field">
              <label>Confirm password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
            <button className="button-primary" type="submit" disabled={busy}>{busy ? "Creating..." : "Create account"}</button>
          </>
        )}
      </form>
    </div>
  );
}

function ProtectedApp({ onLogout }) {
  return (
    <Shell onLogout={onLogout}>
      <Routes>
        <Route path="/dashboard" element={<FounderDashboardPage />} />
        <Route path="/businesses" element={<FounderBusinessListPage />} />
        <Route path="/businesses/:businessId" element={<FounderBusinessDetailPage />} />
        <Route path="/power-hour" element={<FounderPowerHourPage />} />
        <Route path="/timeline" element={<FounderTimelinePage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
        element={auth.authenticated ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={auth.setAuthenticated} />}
      />
      <Route
        path="/signup"
        element={auth.authenticated ? <Navigate to="/dashboard" replace /> : <SignupPage onLogin={auth.setAuthenticated} />}
      />
      <Route
        path="*"
        element={auth.authenticated ? <ProtectedApp onLogout={logout} /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
