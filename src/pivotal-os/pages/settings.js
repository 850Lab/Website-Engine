import { pivotalShell } from "../shell.js";

export function renderSettingsPage() {
  const body = `
    <p class="eyebrow">Settings</p>
    <h1 class="hero-title">System</h1>
    <p class="hero-sub">Operational status — not admin tables.</p>

    <div class="card">
      <div class="card-label">Outcome storage</div>
      <div class="card-value" id="storageStatus" style="font-size:18px">Checking…</div>
      <div class="card-body" id="storageDetail" style="margin-top:8px"></div>
    </div>

    <div class="card">
      <div class="card-label">Daily targets</div>
      <div class="card-body" id="goalsBody">Loading…</div>
    </div>

    <div class="card">
      <div class="card-label">Deal value</div>
      <div class="card-value" id="dealValue">—</div>
      <div class="card-body" style="margin-top:6px">Used for pipeline and revenue estimates.</div>
    </div>

    <div class="card">
      <div class="card-label">Legacy tools</div>
      <div class="btn-row" style="margin-top:0">
        <a class="btn btn-ghost" href="/founder">Discovery</a>
        <a class="btn btn-ghost" href="/outreach">Outreach table</a>
      </div>
    </div>
  `;

  const script = `
    function money(n){return '$'+Number(n).toLocaleString();}
    fetch('/api/pivotal-os/settings').then(function(r){return r.json();}).then(function(data){
      var s=data.storage;
      document.getElementById('storageStatus').textContent=s.outcomesPersist?'Cloud sync active':'Not persisting';
      document.getElementById('storageDetail').textContent=s.outcomesPersist
        ? 'Outcomes and notes save to Vercel Blob ('+s.backend+').'
        : 'Set BLOB_READ_WRITE_TOKEN on Vercel for production persistence.';
      var g=data.goals;
      document.getElementById('goalsBody').innerHTML=
        g.calls+' calls · '+g.conversations+' conversations · '+g.appointments+' appointment per day';
      document.getElementById('dealValue').textContent=money(data.dealValue);
    }).catch(function(e){
      document.getElementById('storageStatus').textContent='Error';
      document.getElementById('storageDetail').textContent=e.message;
    });
  `;

  return pivotalShell({
    title: "Settings",
    activeNav: "settings",
    bodyHtml: body + `<script>${script}</script>`,
  });
}
