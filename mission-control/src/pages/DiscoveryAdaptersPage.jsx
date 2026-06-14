import { useEffect, useState } from "react";
import { api } from "../api";
import { PillBadge } from "../components/PillBadge";

export function DiscoveryAdaptersPage() {
  const [adapters, setAdapters] = useState([]);
  const [identity, setIdentity] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [adapterPayload, identityStatus] = await Promise.all([
        api.discoveryAdapters(),
        api.identityStatus(),
      ]);
      setAdapters(adapterPayload.adapters ?? []);
      setIdentity(identityStatus);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load discovery adapters.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h2 className="section-title">Discovery Adapters</h2>
          <div className="muted">
            Source-agnostic discovery framework — adapters feed the Opportunity Database through identity resolution.
          </div>
        </div>
        <button className="button-ghost" type="button" onClick={load}>Refresh</button>
      </div>

      {error ? <div className="muted" style={{ color: "#ffb4c0" }}>{error}</div> : null}

      {identity ? (
        <div className="grid-cards">
          <div className="card"><h4>Business identities</h4><div className="value">{identity.identities}</div></div>
          <div className="card"><h4>Discovery sources</h4><div className="value">{identity.sources}</div></div>
          <div className="card"><h4>Linked records</h4><div className="value">{identity.recordsWithIdentity}</div></div>
        </div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Adapter</th>
              <th>Status</th>
              <th>Businesses found</th>
              <th>Businesses added</th>
              <th>Duplicates resolved</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            {adapters.map((adapter) => (
              <tr key={adapter.id}>
                <td>
                  <strong>{adapter.name}</strong>
                  <div className="muted compact-meta">{adapter.description}</div>
                </td>
                <td>{adapter.enabled ? <span className="badge small qualified">Enabled</span> : <span className="badge small rejected">Disabled</span>}</td>
                <td>{adapter.stats?.businessesFound ?? 0}</td>
                <td>{adapter.stats?.businessesAdded ?? 0}</td>
                <td>{adapter.stats?.duplicatesResolved ?? 0}</td>
                <td>{adapter.stats?.errors ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card stack muted">
        <h3 className="section-title">Architecture</h3>
        <div>Discovery Source → Normalization → Identity Resolution → Qualification → Enrichment → Opportunity Database</div>
        <div>The database does not depend on any single adapter. Adding a new source only requires a new adapter module.</div>
      </div>
    </div>
  );
}
