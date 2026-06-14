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

function TableSection({ title, rows, columns }) {
  if (!rows?.length) return null;
  return (
    <div className="card stack">
      <h3 className="section-title">{title}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((col) => <th key={col.key}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name ?? row.day ?? row.id}>
                {columns.map((col) => (
                  <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OpportunityIntelligencePage() {
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [intel, rep] = await Promise.all([
        api.opportunityIntelligence(),
        api.southeastTexasReport(),
      ]);
      setData(intel);
      setReport(rep);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load opportunity intelligence.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resumeCampaign = async () => {
    setBusy(true);
    setError("");
    try {
      const { campaignId } = await api.resumeDiscoveryCampaign();
      const poll = async () => {
        const campaign = await api.discoveryCampaign(campaignId);
        if (campaign.status === "running" || campaign.status === "starting" || campaign.status === "resuming") {
          setTimeout(poll, 2000);
          return;
        }
        setBusy(false);
        await load();
      };
      poll();
    } catch (err) {
      setBusy(false);
      setError(err.message || "Failed to resume campaign.");
    }
  };

  const m = data?.metrics ?? {};
  const campaign = data?.campaign?.resumable ?? data?.campaign?.active;
  const progress = campaign?.progress;

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">Opportunity Intelligence</h2>
          <div className="muted">Southeast Texas asset measurement — coverage, contact quality, and growth.</div>
        </div>
        <div className="btn-row">
          <button className="button-ghost" type="button" onClick={load}>Refresh</button>
          {data?.campaign?.resumable ? (
            <button className="button" type="button" disabled={busy} onClick={resumeCampaign}>
              {busy ? "Campaign running..." : "Resume Southeast Texas Campaign"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}

      {progress ? (
        <div className="card stack">
          <h3 className="section-title">Campaign progress</h3>
          <div className="grid-cards">
            <MetricCell label="Completed searches" value={progress.completedPairs} />
            <MetricCell label="Remaining searches" value={progress.remainingPairs} />
            <MetricCell label="Est. time remaining" value={progress.estimatedMinutesRemaining} suffix=" min" />
            <MetricCell label="Matrix complete" value={progress.percentComplete} suffix="%" />
          </div>
          <div className="muted compact-meta">
            Campaign {campaign.id} · {campaign.status}
            {campaign.error ? ` · ${campaign.error}` : ""}
          </div>
        </div>
      ) : null}

      <div className="grid-cards">
        <MetricCell label="Business identities" value={data?.identityStatus?.identities} />
        <MetricCell label="Avg sources / business" value={m.averageSourcesPerBusiness} />
        <MetricCell label="Multi-source businesses" value={m.businessesWithMultipleSources} />
        <MetricCell label="With Facebook" value={m.businessesWithFacebook} />
        <MetricCell label="With Instagram" value={m.businessesWithInstagram} />
        <MetricCell label="With LinkedIn" value={m.businessesWithLinkedin} />
        <MetricCell label="Total businesses" value={m.totalBusinesses} />
        <MetricCell label="Qualified opportunities" value={m.qualifiedOpportunities} />
        <MetricCell label="Qualification %" value={m.qualificationPercent} suffix="%" />
        <MetricCell label="No website" value={m.noWebsite} />
        <MetricCell label="Poor website" value={m.poorWebsite} />
        <MetricCell label="Good website" value={m.goodWebsite} />
        <MetricCell label="Phone available" value={m.phoneAvailable} />
        <MetricCell label="Email available" value={m.emailAvailable} />
        <MetricCell label="Text first" value={m.textFirst} />
        <MetricCell label="Email first" value={m.emailFirst} />
        <MetricCell label="Cities covered" value={m.citiesCovered} />
        <MetricCell label="Industries covered" value={m.industriesCovered} />
      </div>

      <div className="detail-grid">
        <div className="card stack">
          <h3 className="section-title">Top cities</h3>
          {(data?.topCities ?? []).slice(0, 10).map((row) => (
            <div key={row.name} className="section-row"><span>{row.name}</span><strong>{row.count}</strong></div>
          ))}
        </div>
        <div className="card stack">
          <h3 className="section-title">Top industries</h3>
          {(data?.topIndustries ?? []).slice(0, 10).map((row) => (
            <div key={row.name} className="section-row"><span>{row.name}</span><strong>{row.count}</strong></div>
          ))}
        </div>
      </div>

      <TableSection
        title="Growth over time"
        rows={data?.growthOverTime ?? []}
        columns={[
          { key: "day", label: "Day" },
          { key: "added", label: "Added" },
          { key: "cumulative", label: "Cumulative" },
        ]}
      />

      <div className="card stack">
        <h3 className="section-title">Recent discovery activity</h3>
        {(data?.recentDiscoveryActivity?.runs ?? []).slice(0, 8).map((run) => (
          <div key={run.id} className="section-row">
            <span>{run.industry} in {run.city}</span>
            <span className="muted">{run.businessesFound} found · {run.qualifiedCount} qualified</span>
            <PillBadge value={run.status} />
          </div>
        ))}
      </div>

      {data?.contactAudit ? (
        <div className="card stack">
          <h3 className="section-title">Contact audit</h3>
          <p className="muted">{data.contactAudit.conclusion}</p>
          <div className="grid-cards">
            <MetricCell label="Phone available" value={data.contactAudit.phoneAvailable?.percent} suffix="%" />
            <MetricCell label="Email available" value={data.contactAudit.emailAvailable?.percent} suffix="%" />
            <MetricCell label="Phone + email" value={data.contactAudit.phoneAndEmail?.percent} suffix="%" />
            <MetricCell label="Phone only" value={data.contactAudit.phoneOnly?.percent} suffix="%" />
            <MetricCell label="Email only" value={data.contactAudit.emailOnly?.percent} suffix="%" />
            <MetricCell label="No contact" value={data.contactAudit.noContactMethod?.percent} suffix="%" />
          </div>
        </div>
      ) : null}

      {data?.dataQuality ? (
        <div className="card stack">
          <h3 className="section-title">Data quality</h3>
          <div className="grid-cards">
            <MetricCell label="Duplicates removed" value={data.dataQuality.duplicatesRemoved} />
            <MetricCell label="Rejected" value={data.dataQuality.businessesRejected} />
            <MetricCell label="Missing email" value={data.dataQuality.missingEmail?.percent} suffix="%" />
            <MetricCell label="Discovery errors" value={data.dataQuality.discoveryErrors} />
            <MetricCell label="Matrix coverage" value={data.dataQuality.matrixCoverage?.percentComplete} suffix="%" />
          </div>
          <ul>
            {(data.dataQuality.weaknesses ?? []).map((item) => (
              <li key={item} className="muted">{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report ? (
        <div className="card stack">
          <h3 className="section-title">Southeast Texas Opportunity Report</h3>
          <div className="muted compact-meta">Generated {formatDate(report.generatedAt)}</div>
          <div className="detail-grid">
            <div>
              <div><strong>Total discovered:</strong> {report.summary?.totalBusinessesDiscovered}</div>
              <div><strong>Qualified:</strong> {report.summary?.totalQualifiedOpportunities} ({report.summary?.qualificationRate}%)</div>
              <div><strong>Text-first:</strong> {report.summary?.textFirstOpportunities}</div>
              <div><strong>Email-first:</strong> {report.summary?.emailFirstOpportunities}</div>
              <div><strong>No-website opps:</strong> {report.summary?.noWebsiteOpportunities}</div>
              <div><strong>Poor-website opps:</strong> {report.summary?.poorWebsiteOpportunities}</div>
            </div>
            <div>
              <div><strong>30-day projection:</strong> {report.growthProjections?.projected30DayTotal}</div>
              <div><strong>90-day projection:</strong> {report.growthProjections?.projected90DayTotal}</div>
              <div><strong>Remaining searches:</strong> {report.remainingGaps?.remainingSearches}</div>
              <div><strong>Matrix complete:</strong> {report.remainingGaps?.matrixPercentComplete}%</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
