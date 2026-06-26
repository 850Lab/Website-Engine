import { pivotalShell, esc } from "../shell.js";
import { buildOpportunityRadar } from "../../engine/intelligence/index.js";

function money(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

export async function renderHomePage() {
  const radar = await buildOpportunityRadar();
  const top = radar[0] ?? null;

  const bodyHtml = top
    ? `
    <p class="eyebrow">Opportunity OS</p>
    <h1 class="hero-title">Fastest path to opportunity.</h1>
    <p class="hero-sub">Ranked from live database + offer library.</p>

    <div class="card card-highlight">
      <div class="card-label">Top Opportunity</div>
      <div class="card-value">${esc(top.offer)} · ${esc(top.industry || top.market)}</div>
      <div class="card-body" style="margin-top:10px">
        Buyer: ${esc(top.buyer)}<br/>
        Score: ${esc(top.opportunityScore)}/100<br/>
        Est. revenue: ${esc(money(top.estimatedRevenuePotential))}<br/>
        Database confidence: ${esc(top.databaseConfidence)}<br/>
        Next: ${esc(top.recommendedNextAction)}
      </div>
    </div>

    <div class="metric-grid">
      <div class="metric">
        <div class="metric-num">${esc(top.businessesFound)}</div>
        <div class="metric-label">Businesses</div>
      </div>
      <div class="metric">
        <div class="metric-num">${esc(top.reachableBusinesses)}</div>
        <div class="metric-label">Reachable</div>
      </div>
      <div class="metric">
        <div class="metric-num">${esc(top.contactCoverage)}%</div>
        <div class="metric-label">Coverage</div>
      </div>
    </div>

    <div class="card">
      <div class="card-label">Value Proposition</div>
      <div class="card-value">${esc(top.promise)}</div>
      <div class="card-body" style="margin-top:10px">
        Pain: ${esc((top.pain || []).join(" · ") || "Not specified")}<br/>
        KPIs: ${esc((top.kpis || []).join(" · ") || "Not specified")}<br/>
        Channels: ${esc((top.channels || []).join(" · ") || "Not specified")}
      </div>
    </div>
  `
    : `
    <p class="eyebrow">Opportunity OS</p>
    <h1 class="hero-title">No opportunities yet.</h1>
    <p class="hero-sub">Add businesses, contacts, and offers to generate ranked opportunities.</p>
  `;

  return pivotalShell({
    title: "Mission",
    activeNav: "home",
    bodyHtml,
  });
}
