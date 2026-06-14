import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

export function FounderBusinessDetailPage() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const [business, setBusiness] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [assetDraft, setAssetDraft] = useState({ type: "screenshot", title: "", url: "", notes: "" });
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const row = await api.founderOsBusiness(businessId);
      setBusiness(row);
      const all = await api.founderOsTimeline(500);
      setTimeline((all.entries ?? []).filter((entry) => entry.businessId === row.id));
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load business.");
    }
  };

  useEffect(() => {
    load();
  }, [businessId]);

  if (!business) {
    return (
      <div className="fo-page">
        {error ? <div className="fo-error">{error}</div> : <div className="fo-muted">Loading...</div>}
      </div>
    );
  }

  const updateStatus = async (status) => {
    await api.founderOsUpdateBusiness(business.id, { outreachStatus: status });
    await api.founderOsAddTimeline(business.id, {
      type: "status_update",
      message: `Status changed to ${statusLabel(status)}.`,
      channel: "status",
    });
    await load();
  };

  const saveAsset = async () => {
    if (!assetDraft.url.trim()) return;
    await api.founderOsAddAsset(business.id, assetDraft);
    await api.founderOsAddTimeline(business.id, {
      type: "asset_attached",
      message: `Attached ${assetDraft.type}: ${assetDraft.title || "Asset"}.`,
      channel: "asset",
    });
    setAssetDraft({ type: "screenshot", title: "", url: "", notes: "" });
    await load();
  };

  return (
    <div className="fo-page">
      <div className="fo-header-row">
        <button className="button-ghost" type="button" onClick={() => navigate("/businesses")}>Back</button>
        <h2>Opportunity</h2>
      </div>
      {error ? <div className="fo-error">{error}</div> : null}

      <div className="fo-business-card">
        <strong>{business.businessName}</strong>
        <div className="fo-muted">{business.industry} · {business.city}, {business.state}</div>
        <div className="fo-next-card">
          <div className="fo-next-title">Recommended Action</div>
          <div className="fo-next-text">{business.recommendedAction}</div>
        </div>
      </div>

      <div className="fo-business-card">
        <div className="fo-section-title">Business Information</div>
        <div>Website: {business.website ? <a href={business.website} target="_blank" rel="noreferrer">{business.website}</a> : "—"}</div>
        <div>Google Profile: {business.googleBusinessProfileUrl ? <a href={business.googleBusinessProfileUrl} target="_blank" rel="noreferrer">Open</a> : "—"}</div>
      </div>

      <div className="fo-business-card">
        <div className="fo-section-title">Contact Methods</div>
        <div className="fo-actions-grid">
          <a className="fo-action-btn" href={business.actions?.call || "#"}>Call</a>
          <a className="fo-action-btn" href={business.actions?.text || "#"}>Text</a>
          <a className="fo-action-btn" href={business.actions?.email || "#"}>Email</a>
          <a className="fo-action-btn" href={business.actions?.facebook || "#"} target="_blank" rel="noreferrer">Facebook</a>
          <a className="fo-action-btn" href={business.actions?.instagram || "#"} target="_blank" rel="noreferrer">Instagram</a>
          <a className="fo-action-btn" href={business.actions?.website || "#"} target="_blank" rel="noreferrer">Website</a>
        </div>
      </div>

      <div className="fo-business-card">
        <div className="fo-section-title">Website Analysis</div>
        <div>Website Score: {business.websiteAnalysis?.websiteScore ?? 0}</div>
        <div>Mobile Friendly: {business.websiteAnalysis?.mobileFriendly ? "Yes" : "No"}</div>
        <div>SSL Installed: {business.websiteAnalysis?.sslInstalled ? "Yes" : "No"}</div>
        <div>Speed Score: {business.websiteAnalysis?.speedScore ?? 0}</div>
        <div>Notes: {business.websiteAnalysis?.notes || "—"}</div>
      </div>

      <div className="fo-business-card">
        <div className="fo-section-title">Outreach Status</div>
        <select value={business.outreachStatus} onChange={(e) => updateStatus(e.target.value)}>
          {STATUSES.map((status) => (
            <option key={status} value={status}>{statusLabel(status)}</option>
          ))}
        </select>
      </div>

      <div className="fo-business-card">
        <div className="fo-section-title">Attach Preview Asset</div>
        <div className="fo-inline-two">
          <select
            value={assetDraft.type}
            onChange={(e) => setAssetDraft({ ...assetDraft, type: e.target.value })}
          >
            <option value="screenshot">Screenshot</option>
            <option value="mockup">Mockup</option>
            <option value="audit_pdf">Audit PDF</option>
            <option value="landing_page_preview">Landing Page Preview</option>
          </select>
          <input
            placeholder="Title"
            value={assetDraft.title}
            onChange={(e) => setAssetDraft({ ...assetDraft, title: e.target.value })}
          />
        </div>
        <input
          placeholder="Asset URL"
          value={assetDraft.url}
          onChange={(e) => setAssetDraft({ ...assetDraft, url: e.target.value })}
        />
        <textarea
          placeholder="Notes"
          value={assetDraft.notes}
          onChange={(e) => setAssetDraft({ ...assetDraft, notes: e.target.value })}
        />
        <button className="button" type="button" onClick={saveAsset}>Attach Asset</button>
        <div className="fo-list">
          {(business.assets ?? []).map((asset) => (
            <div key={asset.id} className="fo-mini-item">
              <strong>{asset.title}</strong> · {statusLabel(asset.type)}
              {asset.url ? <a href={asset.url} target="_blank" rel="noreferrer"> Open</a> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="fo-business-card">
        <div className="fo-section-title">Outreach History</div>
        <div className="fo-list">
          {timeline.map((entry) => (
            <div key={entry.id} className="fo-mini-item">
              <strong>{statusLabel(entry.type)}</strong> · {entry.message}
              <div className="fo-muted">{new Date(entry.at).toLocaleString()}</div>
            </div>
          ))}
          {!timeline.length ? <div className="fo-muted">No activity yet.</div> : null}
        </div>
      </div>
    </div>
  );
}
