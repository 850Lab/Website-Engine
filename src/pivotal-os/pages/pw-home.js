import { zealShell } from "../zeal-shell.js";

export function renderPwHomePage() {
  const body = `
    <p class="eyebrow">Zeal Power Washing</p>
    <h1 class="hero-title">Today's route</h1>
    <p class="hero-sub" id="greeting">Loading Southeast Texas leads…</p>

    <div class="metric-grid" id="metricsGrid">
      <div class="metric"><div class="metric-num" id="callsNum">—</div><div class="metric-label">Calls</div></div>
      <div class="metric"><div class="metric-num" id="convNum">—</div><div class="metric-label">Talks</div></div>
      <div class="metric"><div class="metric-num" id="interestedNum">—</div><div class="metric-label">Interested</div></div>
    </div>

    <div class="card">
      <div class="card-label">Pipeline today</div>
      <div class="card-body" id="pipelineBody">Loading…</div>
    </div>

    <div class="card card-highlight" id="nextCard">
      <div class="card-label">Call next</div>
      <div id="nextContent" class="loading">Finding best target…</div>
    </div>

    <div class="card">
      <div class="card-label">Top responding industries</div>
      <div class="card-body" id="industryBody">Loading…</div>
    </div>

    <a class="btn btn-primary btn-block" href="/pw/queue" style="margin-top:8px">Start calling →</a>
  `;

  const script = `
    function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    function money(n){return '$'+Number(n||0).toLocaleString();}

    function renderNext(lead){
      var el=document.getElementById('nextContent');
      if(!lead){ el.innerHTML='<p class="card-body">No callable leads. Add leads in Settings or seed data.</p>'; return; }
      el.innerHTML=
        '<div class="card-value" style="font-size:22px;margin-bottom:8px">'+esc(lead.businessName)+'</div>'+
        '<div class="card-body" style="margin-bottom:10px">'+esc(lead.city)+' · '+esc(lead.industry)+' · '+esc(lead.phone)+'</div>'+
        '<span class="badge hot">'+lead.priorityScore+' · '+esc(lead.priorityLabel)+'</span>'+
        '<div class="card-body" style="margin-top:12px"><strong>Angle:</strong> '+esc(lead.angle)+'</div>'+
        '<div class="card-body" style="margin-top:8px"><strong>Offer:</strong> '+esc(lead.offer)+'</div>'+
        '<div class="btn-row" style="margin-top:14px">'+
          (lead.callUrl?'<a class="btn btn-primary" href="'+esc(lead.callUrl)+'">Call</a>':'')+
          '<a class="btn btn-ghost" href="/pw/queue?lead='+encodeURIComponent(lead.id)+'">Open in queue</a>'+
        '</div>';
    }

    fetch('/api/pressure-washing/dashboard').then(function(r){return r.json();}).then(function(data){
      var d=data.daily;
      document.getElementById('greeting').textContent=d.callableLeads+' callable leads · '+data.foodLeadCount+' restaurants/food';
      document.getElementById('callsNum').textContent=d.callsToday;
      document.getElementById('convNum').textContent=d.conversationsToday;
      document.getElementById('interestedNum').textContent=d.interestedToday;
      document.getElementById('pipelineBody').textContent=
        d.estimatesNeeded+' estimates needed · '+d.estimatesSent+' sent · '+d.followUpsDue+' follow-ups due · '+d.jobsWon+' won';
      var rev='Quoted '+money(d.revenueQuoted)+' · Won '+money(d.revenueWon);
      document.getElementById('pipelineBody').textContent+=' · '+rev;
      renderNext(data.nextLead);
      var ind=(data.bestIndustries||[]).map(function(row){
        return esc(row.industry)+': '+row.interested+' interested / '+row.contacted+' contacted';
      }).join(' · ');
      document.getElementById('industryBody').textContent=ind||'No contact data yet.';
    }).catch(function(e){
      document.getElementById('greeting').textContent=e.message;
    });
  `;

  return zealShell({
    title: "Mission",
    activeNav: "pw-home",
    bodyHtml: body + `<script>${script}</script>`,
  });
}
