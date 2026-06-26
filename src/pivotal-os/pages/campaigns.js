import { pivotalShell } from "../shell.js";

export function renderCampaignsPage() {
  return pivotalShell({
    title: "Campaigns",
    activeNav: "campaigns",
    bodyHtml: `
      <p class="eyebrow">Campaigns</p>
      <h1 class="hero-title">Choose the opportunity hunt.</h1>
      <p class="hero-sub">Campaigns are defined by offer, buyer, region, and channels.</p>

      <div class="card card-highlight">
        <div class="card-label">Active Campaign</div>
        <div class="card-value">Maintenance ? Hospitality Companies</div>
        <div class="card-body" style="margin-top:10px">
          Region: Southeast Texas<br/>
          Channels: Phone · Email · Text · Visit<br/>
          Goal: Create 1 opportunity fast
        </div>
      </div>

      <div class="card">
        <div class="card-label">Ready Campaign</div>
        <div class="card-value">Fire Watch ? Commercial Construction</div>
        <div class="card-body" style="margin-top:10px">
          Region: Southeast Texas<br/>
          Channels: Phone · Email<br/>
          Best for KTM opportunity discovery
        </div>
      </div>
    `
  });
}
