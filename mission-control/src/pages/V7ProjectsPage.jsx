import { useEffect, useState } from "react";
import { api } from "../api";
import { PillBadge } from "../components/PillBadge";

export function V7ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [form, setForm] = useState({
    businessName: "",
    websiteUrl: "",
    googleMapsUrl: "",
    city: "",
    phone: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const payload = await api.v7Projects();
      setProjects(payload.projects ?? []);
      setStripeStatus(payload.stripe ?? null);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load V7 projects.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createProject = async () => {
    if (!form.businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = await api.createV7Project({
        businessName: form.businessName.trim(),
        websiteUrl: form.websiteUrl.trim() || undefined,
        googleMapsUrl: form.googleMapsUrl.trim() || undefined,
        city: form.city.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      setSelected(payload);
      await load();
    } catch (err) {
      setError(err.message || "Failed to create project.");
    } finally {
      setBusy(false);
    }
  };

  const openProject = async (id) => {
    try {
      setSelected(await api.v7Project(id));
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load project.");
    }
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError("Could not copy link.");
    }
  };

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">V7 Launch Funnel</h2>
          <div className="muted">Preview → Launch ($1,000) → Activation → Outcome Dashboard</div>
        </div>
        <button className="button-ghost" type="button" onClick={load}>Refresh</button>
      </div>
      {stripeStatus && !stripeStatus.configured ? (
        <div className="muted" style={{ color: "#ffd28a" }}>
          Stripe launch checkout missing: {(stripeStatus.missing ?? []).join(", ")}
        </div>
      ) : null}
      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}
      <div className="card stack">
        <h3 className="section-title">Create opportunity project</h3>
        <div className="form-grid">
          <label>
            Business name *
            <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          </label>
          <label>
            Website URL
            <input value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} />
          </label>
          <label>
            Google Maps URL
            <input value={form.googleMapsUrl} onChange={(e) => setForm({ ...form, googleMapsUrl: e.target.value })} />
          </label>
          <label>
            City
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
        </div>
        <div className="btn-row">
          <button className="button" type="button" disabled={busy} onClick={createProject}>
            {busy ? "Building preview…" : "Create project"}
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Business</th>
              <th>Status</th>
              <th>Preview</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>
                  {project.businessName}
                  <div className="muted compact-meta">{project.id}</div>
                </td>
                <td><PillBadge value={project.status} /></td>
                <td>{project.preview?.previewUrl ? <a href={project.preview.previewUrl} target="_blank" rel="noreferrer">Open</a> : "—"}</td>
                <td>
                  <button className="button-ghost" type="button" onClick={() => openProject(project.id)}>Links</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected?.links ? (
        <div className="card stack">
          <h3 className="section-title">{selected.project?.businessName ?? "Project links"}</h3>
          <div className="stack">
            {[
              ["Preview", selected.links.preview],
              ["Launch", selected.links.launch],
              ["Dashboard", selected.links.dashboard],
            ].map(([label, url]) => (
              <div key={label} className="section-row">
                <div>
                  <strong>{label}</strong>
                  <div className="muted compact-meta">{url}</div>
                </div>
                <div className="btn-row">
                  <button className="button-ghost" type="button" onClick={() => copyText(url)}>Copy</button>
                  <a className="button-link" href={url} target="_blank" rel="noreferrer">Open</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
