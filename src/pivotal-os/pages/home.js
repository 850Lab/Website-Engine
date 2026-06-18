import { pivotalShell } from "../shell.js";

export function renderHomePage() {
  const body = `
    <p class="eyebrow">Mission Control</p>
    <h1 class="hero-title">Today's mission</h1>
    <p class="hero-sub" id="greeting">Loading your day…</p>

    <div class="card" id="goalsCard">
      <div class="card-label">Today's goal</div>
      <div class="metric-grid">
        <div class="metric"><div class="metric-num" id="callsNum">—</div><div class="metric-label">Calls</div><div class="metric-target" id="callsTarget"></div></div>
        <div class="metric"><div class="metric-num" id="convNum">—</div><div class="metric-label">Conversations</div><div class="metric-target" id="convTarget"></div></div>
        <div class="metric"><div class="metric-num" id="apptNum">—</div><div class="metric-label">Appointments</div><div class="metric-target" id="apptTarget"></div></div>
      </div>
      <div class="progress-wrap">
        <div class="card-label">Call progress</div>
        <div class="progress-bar"><div class="progress-fill" id="callsProgress" style="width:0%"></div></div>
      </div>
      <div style="margin-top:16px">
        <div class="card-label">Potential revenue today</div>
        <div class="card-value" id="revenueToday">—</div>
      </div>
    </div>

    <div class="card card-highlight" id="nextCard">
      <div class="card-label">Next best opportunity</div>
      <div id="nextContent" class="loading">Finding your highest-value lead…</div>
    </div>

    <a class="btn btn-accent btn-block" href="/call-queue" style="margin-top:4px">Start calling</a>
  `;

  const headExtra = `
    .next-name { font-size: clamp(22px, 5vw, 28px); font-weight: 800; letter-spacing: -0.02em; margin-bottom: 10px; }
  `;

  const script = `
    function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    function pct(c,t){return t?Math.min(100,Math.round(c/t*100)):0;}
    function money(n){return '$'+Number(n).toLocaleString();}

    function renderNext(opp){
      var el=document.getElementById('nextContent');
      if(!opp){el.innerHTML='<p class="card-body">No callable leads in queue.</p>';return;}
      var btns='';
      if(opp.callUrl) btns+='<a class="btn btn-primary btn-block" href="'+esc(opp.callUrl)+'">Call now</a>';
      if(opp.previewUrl) btns+='<a class="btn btn-ghost btn-block" href="'+esc(opp.previewUrl)+'" target="_blank" rel="noopener">View preview</a>';
      el.innerHTML=
        '<div class="next-name">'+esc(opp.businessName)+'</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">'+
          '<span class="badge hot">'+esc(opp.opportunityType)+'</span>'+
          '<span class="badge accent">'+opp.confidenceScore+'% confidence</span>'+
          '<span class="badge">'+esc(opp.city)+'</span></div>'+
        '<div class="card-body" style="margin-bottom:8px"><strong style="color:var(--text)">Potential:</strong> '+money(opp.potentialValue)+'</div>'+
        '<div class="card-body" style="margin-bottom:8px"><strong style="color:var(--text)">Why:</strong> '+esc(opp.whyItMatters)+'</div>'+
        '<div class="card-body" style="margin-bottom:14px"><strong style="color:var(--text)">Offer:</strong> '+esc(opp.primaryOffer)+'</div>'+
        '<div class="btn-row single">'+btns+'</div>';
    }

    function renderDaily(d){
      var h=new Date().getHours();
      var greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
      document.getElementById('greeting').textContent=greet+', Jaylan. '+d.callableLeads+' leads ready to call.';
      var p=d.progress;
      document.getElementById('callsNum').textContent=p.calls.completed;
      document.getElementById('callsTarget').textContent='of '+p.calls.target;
      document.getElementById('convNum').textContent=p.conversations.completed;
      document.getElementById('convTarget').textContent='of '+p.conversations.target;
      document.getElementById('apptNum').textContent=p.appointments.completed;
      document.getElementById('apptTarget').textContent='of '+p.appointments.target;
      document.getElementById('callsProgress').style.width=pct(p.calls.completed,p.calls.target)+'%';
      if(p.calls.completed>=p.calls.target) document.getElementById('callsProgress').classList.add('success');
      document.getElementById('revenueToday').textContent=money(d.potentialRevenueToday);
    }

    fetch('/api/pivotal-os/dashboard').then(function(r){return r.json();}).then(function(data){
      renderDaily(data.daily);
      renderNext(data.nextOpportunity);
    }).catch(function(err){document.getElementById('greeting').textContent=err.message;});
  `;

  return pivotalShell({
    title: "Mission Control",
    activeNav: "home",
    bodyHtml: body + `<script>${script}</script>`,
    headExtra,
  });
}
