import { pivotalShell } from "../shell.js";
import { getActiveMission } from "../../engine/campaigns/index.js";`nimport { getNextRecommendedAction } from "../../engine/recommendations/index.js";

export async function renderHomePage() {
  const mission = await getActiveMission();`n  const nextAction = await getNextRecommendedAction(mission);

  const channels = mission.channels.join(" · ");
  const decisionMakers = mission.target.decisionMakers.join(" · ");

  const headExtra = `
    .mission-title {
      font-size: 32px;
      line-height: 1.02;
      letter-spacing: -0.06em;
      font-weight: 950;
      margin: 0 0 10px;
    }
    .mission-sub {
      color: var(--text-muted);
      font-size: 15px;
      line-height: 1.5;
      margin: 0 0 16px;
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
      min-height: 84px;
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
      font-size: 16px;
      line-height: 1.25;
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
  `;

  const bodyHtml = `
    <p class="eyebrow">Mission</p>
    <h1 class="mission-title">${mission.name}</h1>
    <p class="mission-sub">${mission.strategy}: ${mission.goal}</p>

    <div class="card">
      <div class="card-label">Active Mission</div>
      <div class="focus-grid">
        <div class="focus-box">
          <div class="focus-label">Offer</div>
          <div class="focus-value">${mission.offer}</div>
        </div>
        <div class="focus-box">
          <div class="focus-label">Buyer</div>
          <div class="focus-value">${mission.target.buyer}</div>
        </div>
        <div class="focus-box">
          <div class="focus-label">Region</div>
          <div class="focus-value">${mission.target.region}</div>
        </div>
        <div class="focus-box">
          <div class="focus-label">Channels</div>
          <div class="focus-value">${channels}</div>
        </div>
      </div>
    </div>

    <div class="next-action">
      <div class="action-label">Best Next Action</div>
      <h2 class="action-business">${nextAction.recommendation.action} ${nextAction.buyer?.name || mission.target.buyer}</h2>
      <div class="action-reason">
        Channel: ${nextAction.recommendation.channel}. ${nextAction.reasons.join(" · ")}
      </div>
      <div class="confidence-row">
        <span>Opportunity confidence</span>
        <span class="confidence-score">${nextAction.recommendation.confidence}</span>
      </div>
      <button class="primary-action" type="button">Generate Next Action</button>
    </div>

    <div class="metric-grid">
      <div class="metric-box">
        <div class="metric-num">0</div>
        <div class="metric-label">Buyers</div>
      </div>
      <div class="metric-box">
        <div class="metric-num">0</div>
        <div class="metric-label">Actions</div>
      </div>
      <div class="metric-box">
        <div class="metric-num">0</div>
        <div class="metric-label">Opps</div>
      </div>
    </div>
  `;

  return pivotalShell({
    title: "Mission",
    activeNav: "home",
    headExtra,
    bodyHtml,
  });
}
