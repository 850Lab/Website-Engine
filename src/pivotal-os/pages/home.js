import { pivotalShell, esc } from "../shell.js";
import { buildMissionControl } from "../../engine/mission-control/index.js";

function money(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function renderList(items) {
  if (!items?.length) return "<p class=\"card-body\">None listed.</p>";
  return `<ul class="list">${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function renderRecommendations(items) {
  if (!items?.length) return "<p class=\"card-body\">No recommendations.</p>";
  return items
    .map(
      (row) => `
      <div class="card-body" style="margin-bottom:10px">
        <strong>#${esc(row.priority)}</strong> ${esc(row.action)}
        ${row.why ? `<div style="margin-top:4px;color:var(--text-muted);font-size:13px">${esc(row.why)}</div>` : ""}
      </div>`,
    )
    .join("");
}

function renderScoreCouncil(summary) {
  if (!summary) return "<p class=\"card-body\">No score council data.</p>";
  const engines = (summary.topEngines || [])
    .map((row) => `${esc(row.engine)}: ${esc(row.score)}/100`)
    .join(" · ");
  return `
    <div class="card-body">
      Mode: ${esc(summary.modeLabel)} · Composite: ${esc(summary.compositeScore)}/100<br/>
      Top engines: ${engines || "N/A"}
    </div>`;
}

function renderExecutionPlan(plan) {
  if (!plan) return "<p class=\"card-body\">No execution plan.</p>";
  const steps = (plan.steps || [])
    .map((step) => `<li>${esc(step.order)}. ${esc(step.action)} (${esc(step.channel)})</li>`)
    .join("");
  return `
    <div class="card-body">
      Immediate: ${esc(plan.immediateAction)}<br/>
      Channels: ${esc((plan.channels || []).join(" · ") || "Not specified")}<br/>
      Autonomy: ${esc(plan.autonomyLevel)}
    </div>
    <ul class="list">${steps}</ul>
    <div class="card-body" style="margin-top:8px">
      After execution: ${esc(plan.afterExecution?.summary || "Not specified")}
    </div>`;
}

function renderMetrics(metrics) {
  return `
    <div class="metric-grid">
      <div class="metric"><div class="metric-num">${esc(metrics.totalOpportunities)}</div><div class="metric-label">Opportunities</div></div>
      <div class="metric"><div class="metric-num">${esc(metrics.highConfidenceOpportunities)}</div><div class="metric-label">High Confidence</div></div>
      <div class="metric"><div class="metric-num">${esc(money(metrics.estimatedRevenuePotential))}</div><div class="metric-label">Revenue Potential</div></div>
      <div class="metric"><div class="metric-num">${esc(money(metrics.estimatedContractPotential))}</div><div class="metric-label">Contract Potential</div></div>
      <div class="metric"><div class="metric-num">${esc(metrics.reachableBuyers)}</div><div class="metric-label">Reachable Buyers</div></div>
      <div class="metric"><div class="metric-num">${esc(metrics.reachableDecisionMakers)}</div><div class="metric-label">Decision Makers</div></div>
      <div class="metric"><div class="metric-num">${esc(metrics.averageContactCoverage)}%</div><div class="metric-label">Avg Coverage</div></div>
      <div class="metric"><div class="metric-num">${esc(metrics.capabilitiesAvailable)}</div><div class="metric-label">Capabilities</div></div>
      <div class="metric"><div class="metric-num">${esc(metrics.offersAvailable)}</div><div class="metric-label">Offers</div></div>
      <div class="metric"><div class="metric-num">${esc(metrics.marketsAvailable)}</div><div class="metric-label">Markets</div></div>
      <div class="metric"><div class="metric-num">${esc(metrics.topCeoMode)}</div><div class="metric-label">Top CEO Mode</div></div>
    </div>`;
}

export async function renderHomePage() {
  const mc = await buildMissionControl();
  const top = mc.topOpportunity;
  const evidence = mc.evidence || {};

  const bodyHtml = top
    ? `
    <p class="eyebrow">Mission Control</p>
    <h1 class="hero-title">${esc(mc.mission?.name || "Executive OS")}</h1>
    <p class="hero-sub">${esc(mc.executiveSummary)}</p>

    <div class="card">
      <div class="card-label">Mission</div>
      <div class="card-value">${esc(mc.mission?.name || "No active mission")}</div>
      <div class="card-body" style="margin-top:10px">
        Goal: ${esc(mc.mission?.goal || "Not set")}<br/>
        Strategy: ${esc(mc.mission?.strategy || "Not set")}
      </div>
    </div>

    <div class="card card-highlight">
      <div class="card-label">Top Opportunity</div>
      <div class="card-value">${esc(top.offer)} · ${esc(top.industry || top.market)}</div>
      <div class="card-body" style="margin-top:10px">
        Score: ${esc(top.opportunityScore)}/100 · ${esc(mc.primaryMode)} mode<br/>
        Est. revenue: ${esc(money(top.estimatedRevenuePotential))}<br/>
        Database confidence: ${esc(top.databaseConfidence)}<br/>
        Capabilities: ${esc((top.capabilities || []).map((row) => row.name).join(" · ") || "None linked")}
      </div>
    </div>

    <div class="card">
      <div class="card-label">Score Council Summary</div>
      ${renderScoreCouncil(mc.scoreCouncilSummary)}
    </div>

    <div class="card">
      <div class="card-label">Evidence</div>
      <div class="card-body">${esc(evidence.summary)}</div>
      <div class="card-label" style="margin-top:12px">Strengths</div>
      ${renderList(evidence.strengths)}
      <div class="card-label" style="margin-top:12px">Why Now</div>
      ${renderList(evidence.whyNow)}
      <div class="card-label" style="margin-top:12px">Why Not Others</div>
      ${renderList(evidence.whyNotOthers)}
      <div class="card-label" style="margin-top:12px">Missing Data</div>
      ${renderList(evidence.missingData)}
    </div>

    <div class="card">
      <div class="card-label">Next Action</div>
      <div class="card-value">${esc(top.recommendedNextAction)}</div>
    </div>

    <div class="card">
      <div class="card-label">Executive Metrics</div>
      ${renderMetrics(mc.metrics)}
    </div>

    <div class="card">
      <div class="card-label">Alerts</div>
      ${
        mc.alerts?.length
          ? mc.alerts
              .map(
                (alert) =>
                  `<div class="card-body">${esc(alert.level?.toUpperCase())}: ${esc(alert.message)}</div>`,
              )
              .join("")
          : "<p class=\"card-body\">No alerts.</p>"
      }
    </div>

    <div class="card">
      <div class="card-label">Recommendations</div>
      ${renderRecommendations(mc.recommendations)}
    </div>

    <div class="card">
      <div class="card-label">Execution Plan</div>
      ${renderExecutionPlan(mc.executionPlan)}
    </div>
  `
    : `
    <p class="eyebrow">Mission Control</p>
    <h1 class="hero-title">No opportunities yet.</h1>
    <p class="hero-sub">${esc(mc.executiveSummary)}</p>
  `;

  return pivotalShell({
    title: "Mission",
    activeNav: "home",
    bodyHtml,
  });
}
