import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

const STATUSES = [
  "new",
  "contacted",
  "follow_up",
  "responded",
  "interested",
  "appointment_scheduled",
  "proposal_sent",
  "won",
  "lost",
];

function statusLabel(value) {
  return String(value || "new").replace(/_/g, " ");
}

function buildQuery(filters) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.city.trim()) params.set("city", filters.city.trim());
  if (filters.industry.trim()) params.set("industry", filters.industry.trim());
  return params.toString();
}

function MobileActionButton({ href, label }) {
  if (!href) return <button className="fo-action-btn" type="button" disabled>{label}</button>;
  return (
    <a className="fo-action-btn" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      {label}
    </a>
  );
}

export function FounderBusinessListPage() {
  const [payload, setPayload] = useState({ businesses: [], total: 0 });
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    search: "",
    city: "",
    industry: "",
  });

  const load = async (next = filters) => {
    try {
      const data = await api.founderOsBusinesses(buildQuery(next));
      setPayload(data ?? { businesses: [], total: 0 });
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load businesses.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => payload.businesses ?? [], [payload]);

  const logAction = async (businessId, type, message, channel = type) => {
    try {
      await api.founderOsAddTimeline(businessId, { type, message, channel });
    } catch {
      // non-blocking UX
    }
  };

  return (
    <div className="fo-page">
      <div className="fo-header-row">
        <h2>Business Database</h2>
        <button className="button-ghost" type="button" onClick={() => load()}>Refresh</button>
      </div>
      {error ? <div className="fo-error">{error}</div> : null}

      <div className="fo-filter-card">
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>{statusLabel(status)}</option>
          ))}
        </select>
        <input
          placeholder="Search business, phone, email"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <div className="fo-inline-two">
          <input
            placeholder="City"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          />
          <input
            placeholder="Industry"
            value={filters.industry}
            onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
          />
        </div>
        <button className="button" type="button" onClick={() => load(filters)}>Apply Filters</button>
      </div>

      <div className="fo-muted">{payload.total ?? 0} businesses</div>

      <div className="fo-list">
        {rows.map((row) => (
          <div key={row.id} className="fo-business-card">
            <div className="fo-business-top">
              <div>
                <strong>{row.businessName}</strong>
                <div className="fo-muted">{row.industry} · {row.city}, {row.state}</div>
              </div>
              <span className="fo-status-chip">{statusLabel(row.outreachStatus)}</span>
            </div>

            <div className="fo-analysis-row">
              <span>Website Score: {row.websiteAnalysis?.websiteScore ?? 0}</span>
              <span>Mobile: {row.websiteAnalysis?.mobileFriendly ? "Yes" : "No"}</span>
              <span>SSL: {row.websiteAnalysis?.sslInstalled ? "Yes" : "No"}</span>
            </div>

            <div className="fo-actions-grid">
              <MobileActionButton
                href={row.actions?.call}
                label="Call"
              />
              <MobileActionButton
                href={row.actions?.text}
                label="Text"
              />
              <MobileActionButton
                href={row.actions?.email}
                label="Email"
              />
              <MobileActionButton
                href={row.actions?.facebook}
                label="Facebook"
              />
              <MobileActionButton
                href={row.actions?.instagram}
                label="Instagram"
              />
              <MobileActionButton
                href={row.actions?.website}
                label="Website"
              />
            </div>

            <div className="fo-inline-two">
              <button
                className="button-ghost"
                type="button"
                onClick={async () => {
                  await logAction(row.id, "call", "Called business.", "call");
                  await api.founderOsUpdateBusiness(row.id, { outreachStatus: "contacted" });
                  await load(filters);
                }}
              >
                Mark Contacted
              </button>
              <Link className="button-ghost" to={`/businesses/${encodeURIComponent(row.id)}`}>Open</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
