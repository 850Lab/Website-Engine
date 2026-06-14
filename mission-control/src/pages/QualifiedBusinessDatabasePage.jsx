import { useEffect, useState } from "react";
import { api } from "../api";
import { PillBadge, formatDate } from "../components/PillBadge";

function MetricCell({ label, value, suffix = "" }) {
  return (
    <div className="card">
      <h4>{label}</h4>
      <div className="value">{value ?? 0}{suffix}</div>
    </div>
  );
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

export function QualifiedBusinessDatabasePage() {
  const [dashboard, setDashboard] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchMode, setBatchMode] = useState("selected");
  const [generationResult, setGenerationResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [resumableCampaign, setResumableCampaign] = useState(null);
  const [engineConfig, setEngineConfig] = useState(null);
  const [campaignForm, setCampaignForm] = useState({ maxBusinessesPerSearch: 25 });
  const [filters, setFilters] = useState({
    qualifiedOnly: false,
    noWebsite: false,
    poorWebsite: false,
    textFirst: false,
    emailFirst: false,
    notContactable: false,
    readyForOutreach: false,
    industry: "",
    city: "",
  });

  const buildQuery = (nextFilters = filters) => {
    const params = new URLSearchParams();
    if (nextFilters.qualifiedOnly) params.set("qualifiedOnly", "1");
    if (nextFilters.noWebsite) params.set("noWebsite", "1");
    if (nextFilters.poorWebsite) params.set("poorWebsite", "1");
    if (nextFilters.textFirst) params.set("textFirst", "1");
    if (nextFilters.emailFirst) params.set("emailFirst", "1");
    if (nextFilters.notContactable) params.set("notContactable", "1");
    if (nextFilters.readyForOutreach) params.set("readyForOutreach", "1");
    if (nextFilters.industry.trim()) params.set("industry", nextFilters.industry.trim());
    if (nextFilters.city.trim()) params.set("city", nextFilters.city.trim());
    return params.toString();
  };

  const loadBusinesses = async (nextFilters = filters) => {
    const payload = await api.stage1Businesses(buildQuery(nextFilters));
    setBusinesses(payload.businesses ?? []);
    setSelectedIds((current) => current.filter((id) => (payload.businesses ?? []).some((row) => row.id === id)));
    return payload.summary ?? null;
  };

  const load = async (nextFilters = filters) => {
    try {
      const [dash, config, intel] = await Promise.all([
        api.opportunityDashboard(),
        api.opportunityEngineConfig(),
        api.opportunityIntelligence(),
      ]);
      setDashboard(dash);
      setEngineConfig(config);
      setResumableCampaign(intel?.campaign?.resumable ?? null);
      setCampaignStatus(intel?.campaign?.active ?? null);
      await loadBusinesses(nextFilters);
      if (selected?.id) {
        setSelected(await api.stage1Business(selected.id));
      }
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load opportunity database.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const applyFilters = async () => {
    try {
      await loadBusinesses(filters);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to apply filters.");
    }
  };

  const toggleSelectedId = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  };

  const runBatchGeneration = async (mode = batchMode) => {
    setBusy(true);
    setError("");
    setGenerationResult(null);
    try {
      const payload = mode === "selected" ? { mode, selectedBusinessIds: selectedIds } : { mode };
      const result = await api.stage1GenerateProjects(payload);
      setGenerationResult(result);
      await load();
    } catch (err) {
      setError(err.message || "Failed to generate opportunity projects.");
    } finally {
      setBusy(false);
    }
  };

  const generateFounderTestQueue = async () => {
    setBusy(true);
    setError("");
    setGenerationResult(null);
    try {
      const result = await api.stage1GenerateFounderTestQueue();
      setGenerationResult(result);
      await load();
    } catch (err) {
      setError(err.message || "Failed to generate founder test queue.");
    } finally {
      setBusy(false);
    }
  };

  const createProjectForBusiness = async (id) => {
    setBusy(true);
    setError("");
    try {
      await api.stage1CreateBusinessProject(id);
      await load();
    } catch (err) {
      setError(err.message || "Failed to create opportunity project.");
    } finally {
      setBusy(false);
    }
  };

  const verifyPreviewForBusiness = async (id) => {
    setBusy(true);
    setError("");
    try {
      await api.stage1VerifyPreview(id);
      await load();
    } catch (err) {
      setError(err.message || "Failed to verify preview URL.");
    } finally {
      setBusy(false);
    }
  };

  const markReadyForBusiness = async (id) => {
    setBusy(true);
    setError("");
    try {
      await api.stage1MarkReady(id);
      await load();
    } catch (err) {
      setError(err.message || "Failed to mark business ready for outreach.");
    } finally {
      setBusy(false);
    }
  };

  const pollCampaign = (campaignId) => {
    const poll = async () => {
      const campaign = await api.discoveryCampaign(campaignId);
      setCampaignStatus(campaign);
      if (campaign.status === "running" || campaign.status === "starting") {
        setTimeout(poll, 2000);
        return;
      }
      setBusy(false);
      await load();
    };
    poll();
  };

  const resumeCampaign = async () => {
    setBusy(true);
    setError("");
    try {
      const { campaignId } = await api.resumeDiscoveryCampaign(resumableCampaign?.id);
      pollCampaign(campaignId);
    } catch (err) {
      setBusy(false);
      setError(err.message || "Failed to resume campaign.");
    }
  };

  const startCampaign = async () => {
    setBusy(true);
    setError("");
    setCampaignStatus({ status: "starting", message: "Starting discovery campaign..." });
    try {
      const payload = {
        regionId: "southeast-texas",
        maxBusinessesPerSearch: Number(campaignForm.maxBusinessesPerSearch) || 25,
      };
      const { campaignId } = await api.startDiscoveryCampaign(payload);
      pollCampaign(campaignId);
    } catch (err) {
      setBusy(false);
      setError(err.message || "Discovery campaign failed to start.");
    }
  };

  const openBusiness = async (id) => {
    try {
      setSelected(await api.stage1Business(id));
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load business detail.");
    }
  };

  const summary = dashboard?.database ?? null;
  const growth = dashboard?.growth ?? null;
  const region = engineConfig?.activeRegion;
  const campaignProgress = campaignStatus?.progress || resumableCampaign?.progress || null;

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">Qualified Business Database</h2>
          <div className="muted">Discover, review, generate projects, review previews, mark ready, and contact from Mission Control.</div>
        </div>
        <button className="button-ghost" type="button" onClick={() => load()}>Refresh</button>
      </div>

      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}

      {summary ? (
        <div className="grid-cards">
          <MetricCell label="Opportunities Found Today" value={summary.opportunitiesFoundToday} />
          <MetricCell label="Qualified Opportunities" value={summary.qualifiedBusinesses} />
          <MetricCell label="Projects Generated" value={summary.projectsGenerated} />
          <MetricCell label="Previews Ready" value={summary.previewsReady} />
          <MetricCell label="Ready For Outreach" value={summary.readyForOutreach} />
          <MetricCell label="Total Opportunities" value={summary.totalBusinesses} />
        </div>
      ) : null}

      {growth ? (
        <div className="grid-cards">
          <MetricCell label="Added This Week" value={growth.opportunitiesAddedThisWeek} />
          <MetricCell label="Qualified %" value={summary?.qualifiedPercent ?? 0} suffix="%" />
          <MetricCell label="Cities Covered" value={summary?.citiesCovered} />
          <MetricCell label="Industries Covered" value={summary?.industriesCovered} />
        </div>
      ) : null}

      <div className="detail-grid">
        <div className="card stack">
          <h3 className="section-title">Campaign Progress</h3>
          <div className="muted compact-meta">
            {campaignStatus
              ? `Campaign ${campaignStatus.id} · ${campaignStatus.status}`
              : resumableCampaign
                ? `Resumable campaign ${resumableCampaign.id}`
                : "No active campaign"}
          </div>
          <div className="section-row">
            <span>Completed searches</span>
            <strong>{campaignProgress?.completedPairs ?? 0}</strong>
          </div>
          <div className="section-row">
            <span>Remaining searches</span>
            <strong>{campaignProgress?.remainingPairs ?? 0}</strong>
          </div>
          <div className="section-row">
            <span>Est. time remaining</span>
            <strong>{campaignProgress?.estimatedMinutesRemaining ?? 0} min</strong>
          </div>
          <div className="btn-row">
            {resumableCampaign && !busy ? (
              <button className="button" type="button" onClick={resumeCampaign}>
                Resume Campaign ({resumableCampaign.progress?.completedPairs}/{resumableCampaign.progress?.totalPairs})
              </button>
            ) : (
              <button className="button" type="button" disabled={busy || Boolean(resumableCampaign)} onClick={startCampaign}>
                {busy ? "Campaign running..." : "Run Southeast Texas Campaign"}
              </button>
            )}
          </div>
        </div>

        <div className="card stack">
          <h3 className="section-title">Top Cities</h3>
          {(dashboard?.topOpportunityCities ?? []).slice(0, 8).map((row) => (
            <div key={row.name} className="section-row">
              <span>{row.name}</span>
              <strong>{row.count}</strong>
            </div>
          ))}
        </div>

        <div className="card stack">
          <h3 className="section-title">Top Industries</h3>
          {(dashboard?.topOpportunityIndustries ?? []).slice(0, 8).map((row) => (
            <div key={row.name} className="section-row">
              <span>{row.name}</span>
              <strong>{row.count}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="card stack">
        <h3 className="section-title">Opportunity Project Bridge</h3>
        <div className="muted">Generate projects and previews without leaving this page.</div>
        <div className="form-grid">
          <label>
            Generate mode
            <select value={batchMode} onChange={(e) => setBatchMode(e.target.value)}>
              <option value="selected">Selected Businesses</option>
              <option value="top_10">Top 10 Qualified</option>
              <option value="top_25">Top 25 Qualified</option>
              <option value="top_50">Top 50 Qualified</option>
              <option value="top_100">Top 100 Qualified</option>
            </select>
          </label>
          <label>
            Max businesses per discovery search
            <input
              type="number"
              min={1}
              max={200}
              value={campaignForm.maxBusinessesPerSearch}
              onChange={(e) => setCampaignForm({ ...campaignForm, maxBusinessesPerSearch: e.target.value })}
            />
          </label>
        </div>
        <div className="btn-row">
          <button
            className="button"
            type="button"
            disabled={busy || (batchMode === "selected" && selectedIds.length === 0)}
            onClick={() => runBatchGeneration(batchMode)}
          >
            {busy ? "Generating..." : "Generate Projects"}
          </button>
          <button className="button-ghost" type="button" disabled={busy} onClick={generateFounderTestQueue}>
            Generate 25 Founder Test Projects
          </button>
        </div>
        {generationResult ? (
          <div className="grid-cards">
            <MetricCell label="Requested" value={generationResult.requested} />
            <MetricCell label="Successful" value={generationResult.successful} />
            <MetricCell label="Created" value={generationResult.created} />
            <MetricCell label="Failed" value={generationResult.failed} />
            <MetricCell label="Preview Ready" value={generationResult.verifiedPreviews} />
          </div>
        ) : null}
      </div>

      <div className="card stack">
        <h3 className="section-title">Filters</h3>
        <div className="checkbox-grid">
          {[
            ["qualifiedOnly", "Qualified only"],
            ["readyForOutreach", "Ready for outreach"],
            ["noWebsite", "No website"],
            ["poorWebsite", "Poor website"],
            ["textFirst", "Text first"],
            ["emailFirst", "Email first"],
            ["notContactable", "Not contactable"],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={(e) => setFilters({ ...filters, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="form-grid">
          <label>
            Industry filter
            <input value={filters.industry} onChange={(e) => setFilters({ ...filters, industry: e.target.value })} />
          </label>
          <label>
            City filter
            <input value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
          </label>
        </div>
        <button className="button-ghost" type="button" onClick={applyFilters}>Apply filters</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Business Name</th>
              <th>City</th>
              <th>Industry</th>
              <th>Qualification Reason</th>
              <th>Project Status</th>
              <th>Preview Status</th>
              <th>Ready For Outreach</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.qualificationStatus === "qualified" ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={() => toggleSelectedId(row.id)}
                    />
                  ) : null}
                </td>
                <td>
                  <button className="button-ghost" type="button" onClick={() => openBusiness(row.id)}>
                    {row.businessName}
                  </button>
                  <div className="muted compact-meta">{row.contactMethodLabel || "No contact route"}</div>
                </td>
                <td>{row.city || "—"}</td>
                <td>{row.industry || "—"}</td>
                <td>{row.qualificationReason || "—"}</td>
                <td>{row.projectStatus || "No Project"}</td>
                <td>{row.previewStatus || "No Project"}</td>
                <td><PillBadge value={yesNo(row.readyForOutreach)} /></td>
                <td>
                  <div className="btn-row">
                    <button
                      className="button-ghost"
                      type="button"
                      disabled={busy || row.qualificationStatus !== "qualified"}
                      onClick={() => createProjectForBusiness(row.id)}
                    >
                      {row.opportunityProjectId ? "Regenerate" : "Generate Project"}
                    </button>
                    <button
                      className="button-ghost"
                      type="button"
                      disabled={!row.previewUrl}
                      onClick={() => window.open(row.previewUrl, "_blank", "noopener,noreferrer")}
                    >
                      Open Preview
                    </button>
                    <button
                      className="button-ghost"
                      type="button"
                      disabled={!row.launchUrl}
                      onClick={() => window.open(row.launchUrl, "_blank", "noopener,noreferrer")}
                    >
                      Open Launch Page
                    </button>
                    <button
                      className="button-ghost"
                      type="button"
                      disabled={busy || !row.opportunityProjectId}
                      onClick={() => verifyPreviewForBusiness(row.id)}
                    >
                      Verify Preview
                    </button>
                    <button
                      className="button-ghost"
                      type="button"
                      disabled={busy || !row.previewVerified}
                      onClick={() => markReadyForBusiness(row.id)}
                    >
                      Mark Ready
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!businesses.length ? (
              <tr>
                <td colSpan={9} className="muted">No businesses match current filters.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="card stack">
          <div className="section-row">
            <h3 className="section-title">{selected.businessName}</h3>
            <PillBadge value={selected.qualificationStatus} />
          </div>
          <div className="detail-grid">
            <div>
              <div><strong>Industry:</strong> {selected.industry || "—"}</div>
              <div><strong>Category:</strong> {selected.category || "—"}</div>
              <div><strong>City:</strong> {selected.city || "—"}, {selected.state || "—"}</div>
              <div><strong>Phone:</strong> {selected.phone || "—"}</div>
              <div><strong>Email:</strong> {selected.email || "—"}</div>
              <div><strong>Found:</strong> {formatDate(selected.dateFound)}</div>
              <div><strong>Project status:</strong> {selected.projectStatus || "No Project"}</div>
              <div><strong>Preview status:</strong> {selected.previewStatus || "No Project"}</div>
              <div><strong>Ready for outreach:</strong> {yesNo(selected.readyForOutreach)}</div>
            </div>
            <div>
              <div><strong>Preview URL:</strong> {selected.previewUrl ? <a href={selected.previewUrl} target="_blank" rel="noreferrer">{selected.previewUrl}</a> : "—"}</div>
              <div><strong>Launch URL:</strong> {selected.launchUrl ? <a href={selected.launchUrl} target="_blank" rel="noreferrer">{selected.launchUrl}</a> : "—"}</div>
              <div><strong>Dashboard URL:</strong> {selected.dashboardUrl ? <a href={selected.dashboardUrl} target="_blank" rel="noreferrer">{selected.dashboardUrl}</a> : "—"}</div>
              <div><strong>Website:</strong> {selected.websiteUrl ? <a href={selected.websiteUrl} target="_blank" rel="noreferrer">{selected.websiteUrl}</a> : "—"}</div>
              <div><strong>Website status:</strong> {selected.websiteStatus || "—"}</div>
            </div>
          </div>
          <div>
            <strong>Qualification reason</strong>
            <div className="muted">{selected.qualificationReason || "—"}</div>
          </div>
        </div>
      ) : null}

      <div className="muted compact-meta">
        Region: {region?.name ?? "Southeast Texas"} · Cities {region?.cities?.length ?? 0} · Industries {region?.industries?.length ?? 0}
      </div>
    </div>
  );
}
