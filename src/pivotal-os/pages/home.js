import { pivotalShell } from "../shell.js";

export function renderHomePage() {
  const headExtra = `
    .campaign-hero {
      display: grid;
      gap: 14px;
    }

    .campaign-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .campaign-title {
      margin: 0;
      font-size: 30px;
      line-height: 1.02;
      letter-spacing: -0.06em;
      font-weight: 900;
    }

    .campaign-subtitle {
      margin-top: 8px;
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1.45;
    }

    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .campaign-pill {
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text);
      border-radius: 999px;
      padding: 8px 11px;
      font-size: 12px;
      font-weight: 800;
    }

    .focus-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .focus-box {
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      border-radius: 18px;
      padding: 14px;
      min-height: 82px;
    }

    .focus-label {
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 10px;
      font-weight: 900;
      margin-bottom: 8px;
    }

    .focus-value {
      color: var(--text);
      font-size: 17px;
      line-height: 1.2;
      font-weight: 850;
    }

    .next-action {
      border: 1px solid rgba(99,102,241,0.38);
      background: linear-gradient(180deg, rgba(99,102,241,0.18), rgba(99,102,241,0.06));
      border-radius: 24px;
      padding: 18px;
      margin-top: 14px;
    }

    .action-label {
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-size: 11px;
      font-weight: 950;
      margin-bottom: 10px;
    }

    .action-business {
      font-size: 24px;
      line-height: 1.05;
      letter-spacing: -0.04em;
      font-weight: 950;
      margin: 0 0 8px;
    }

    .action-reason {
      color: var(--text-muted);
      font-size: 15px;
      line-height: 1.45;
      margin-bottom: 14px;
    }

    .confidence-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 700;
    }

    .confidence-score {
      color: var(--text);
      font-size: 18px;
      font-weight: 950;
    }

    .primary-action {
      width: 100%;
      min-height: 56px;
      border-radius: 18px;
      border: 0;
      background: var(--accent);
      color: white;
      font-size: 17px;
      font-weight: 950;
      cursor: pointer;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 14px;
    }

    .metric-box {
      border: 1px solid var(--border);
      background: var(--bg-card);
      border-radius: 18px;
      padding: 14px 12px;
    }

    .metric-num {
      font-size: 24px;
      font-weight: 950;
      letter-spacing: -0.04em;
    }

    .metric-label {
      margin-top: 4px;
      color: var(--text-dim);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .simple-nav {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-top: 16px;
    }

    .simple-nav a {
      text-decoration: none;
      text-align: center;
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text);
      padding: 12px 8px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 850;
    }
  `;

  const body = `
    <section class="campaign-hero">
      <div class="campaign-top">
        <div>
          <p class="eyebrow">Campaign OS</p>
          <h1 class="campaign-title">Fastest Path to Opportunity</h1>
          <div class="campaign-subtitle">
            One campaign. Multiple channels. Ranked by the next action most likely to create an opportunity.
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-label">Active Campaign</div>
        <div class="focus-grid">
          <div class="focus-box">
            <div class="focus-label">Offer</div>
            <div class="focus-value">Maintenance</div>
          </div>
          <div class="focus-box">
            <div class="focus-label">Buyer</div>
            <div class="focus-value">Hospitality Companies</div>
          </div>
          <div class="focus-box">
            <div class="focus-label">Region</div>
            <div class="focus-value">Southeast Texas</div>
          </div>
          <div class="focus-box">
            <div class="focus-label">Channels</div>
            <div class="focus-value">Phone · Email · Text · Visit</div>
          </div>
        </div>
      </div>

      <div class="next-action">
        <div class="action-label">Best Next Action</div>
        <h2 class="action-business">Call hotel general managers</h2>
        <div class="action-reason">
          Fastest path: hospitality buyers are reachable by phone today, and maintenance support is easy to position around response time, reliability, and overflow labor.
        </div>
        <div class="confidence-row">
          <span>Opportunity confidence</span>
          <span class="confidence-score">82%</span>
        </div>
        <button class="primary-action" type="button">Do Next Action</button>
      </div>

      <div class="metric-grid">
        <div class="metric-box">
          <div class="metric-num">247</div>
          <div class="metric-label">Businesses</div>
        </div>
        <div class="metric-box">
          <div class="metric-num">611</div>
          <div class="metric-label">Contacts</div>
        </div>
        <div class="metric-box">
          <div class="metric-num">0</div>
          <div class="metric-label">Opportunities</div>
        </div>
      </div>

      <div class="simple-nav">
        <a href="/campaigns">Campaigns</a>
        <a href="/actions">Actions</a>
        <a href="/opportunities">Opps</a>
        <a href="/settings">Settings</a>
      </div>
    </section>
  `;

  return pivotalShell({
    title: "Campaign OS",
    activeNav: "home",
    headExtra,
    bodyHtml: body,
  });
}
