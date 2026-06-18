import { pivotalShell } from "../shell.js";

export function renderHomePage() {
  const body = `
    <p class="eyebrow">Mission Control</p>
    <h1 class="hero-title">Today's mission</h1>
    <p class="hero-sub" id="greeting">Loading your day…</p>

    <div class="card card-highlight" id="twilioTestCard" style="margin-bottom:16px;border-color:rgba(99,102,241,0.45)">
      <div class="card-label">Twilio test call — run this first</div>
      <div id="twilioTestContent" class="loading">Loading test lead…</div>
    </div>

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
    .test-note { font-size: 14px; color: var(--text-muted); line-height: 1.45; margin-bottom: 14px; }
    .test-status { font-size: 14px; font-weight: 600; min-height: 20px; margin-top: 10px; color: var(--accent); }
    .test-status.error { color: #f87171; }
    .test-status.ok { color: #4ade80; }
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

    async function jsonFetch(url, opts){
      var res=await fetch(url, opts||{});
      var data=await res.json();
      if(!res.ok) throw new Error(data.error||res.statusText);
      return data;
    }

    function setTestStatus(msg, kind){
      var el=document.getElementById('twilioTestStatus');
      if(!el) return;
      el.textContent=msg||'';
      el.className='test-status'+(kind?' '+kind:'');
    }

    async function startTwilioTestCall(businessId){
      var btn=document.getElementById('twilioTestCallBtn');
      if(btn) btn.disabled=true;
      setTestStatus('Calling your phone…');
      try{
        await jsonFetch('/api/calls/start',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({businessId:businessId})
        });
        setTestStatus('Call started — answer your phone to connect to the test line.','ok');
      }catch(e){
        var msg=e.message||'Call failed';
        if(msg.toLowerCase().indexOf('unauthorized')!==-1){
          msg='Sign in required.';
          window.location.href='/login?return='+encodeURIComponent(window.location.pathname+window.location.search);
          return;
        }
        setTestStatus(msg,'error');
      }finally{
        if(btn) btn.disabled=false;
      }
    }

    function renderTwilioTest(test, authenticated){
      var el=document.getElementById('twilioTestContent');
      if(!test){
        el.innerHTML='<p class="card-body">Twilio test lead not found.</p>';
        return;
      }
      if(!authenticated){
        el.innerHTML=
          '<div class="next-name">'+esc(test.businessName)+'</div>'+
          '<div class="card-body" style="margin-bottom:10px">'+esc(test.phone)+' · '+esc(test.city)+'</div>'+
          '<p class="test-note">Sign in first to use Call with Recording.</p>'+
          '<a class="btn btn-primary btn-block" href="/login?return='+encodeURIComponent('/')+'">Sign in</a>'+
          '<a class="btn btn-ghost btn-block" href="'+esc(test.callQueueUrl)+'" style="margin-top:10px">Open in Call Queue</a>';
        return;
      }
      el.innerHTML=
        '<div class="next-name">'+esc(test.businessName)+'</div>'+
        '<div class="card-body" style="margin-bottom:10px">'+esc(test.phone)+' · '+esc(test.city)+'</div>'+
        '<p class="test-note">Run this before real leads. Your phone rings first, then connects to the test number with recording.</p>'+
        '<div class="btn-row">'+
          '<button type="button" class="btn btn-primary" id="twilioTestCallBtn">Call with Recording</button>'+
          (test.callUrl?'<a class="btn btn-ghost" href="'+esc(test.callUrl)+'">Call Direct</a>':'')+
        '</div>'+
        '<div id="twilioTestStatus" class="test-status" aria-live="polite"></div>'+
        '<a class="btn btn-ghost btn-block" href="'+esc(test.callQueueUrl)+'" style="margin-top:10px">Open in Call Queue</a>';
      document.getElementById('twilioTestCallBtn').onclick=function(){
        startTwilioTestCall(test.id);
      };
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

    Promise.all([
      fetch('/api/pivotal-os/dashboard').then(function(r){return r.json();}),
      fetch('/api/me').then(function(r){return r.json();})
    ]).then(function(results){
      var data=results[0];
      var me=results[1];
      renderDaily(data.daily);
      renderTwilioTest(data.twilioTest, Boolean(me.authenticated));
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
