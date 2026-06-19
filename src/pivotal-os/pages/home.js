import { pivotalShell } from "../shell.js";
import { clientSafeRenderScript } from "../safe-render.js";

const MODE_STORAGE_KEY = "pivotalCampaignMode";

export function renderHomePage() {
  const body = `
    <div class="mode-switch" id="modeSwitch" role="tablist" aria-label="Campaign mode">
      <button type="button" class="mode-btn active" data-mode="website" role="tab" aria-selected="true">Website Mode</button>
      <button type="button" class="mode-btn" data-mode="pressure-washing" role="tab" aria-selected="false">Pressure Washing Mode</button>
    </div>

    <p class="eyebrow" id="modeEyebrow">Website Outreach</p>
    <h1 class="hero-title" id="modeTitle">Website Outreach Command Center</h1>
    <p class="hero-sub" id="greeting">Loading your day…</p>

    <div id="websitePanel">
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

      <a class="btn btn-accent btn-block" id="websiteCta" href="/call-queue" style="margin-top:4px">Start calling</a>
    </div>

    <div id="pwPanel" class="hidden">
      <div class="card card-highlight pw-highlight" id="pwFounderCard">
        <div class="card-label">Founder Control</div>
        <div class="pw-stat-grid" id="pwHealthStats">Loading…</div>
        <div id="pwHealthExpanded" class="hidden card-body" style="margin-top:12px;font-size:14px;line-height:1.6"></div>
      </div>

      <div class="card pw-highlight" id="pwRecommendCard">
        <div class="card-label">What should I do next?</div>
        <p class="card-body rec-msg" id="pwRecMsg" style="font-size:17px;font-weight:600;color:var(--text);margin:0 0 14px">Loading…</p>
        <div class="btn-row" id="pwRecActions"></div>
      </div>

      <div class="card" id="pwTargetsCard">
        <div class="card-label">Daily targets</div>
        <div id="pwTargets">Loading…</div>
      </div>

      <div class="card" id="pwActivityCard">
        <div class="card-label">Today's activity</div>
        <div id="pwActivity">Loading…</div>
      </div>

      <div class="card">
        <div class="card-label">Commands</div>
        <div class="pw-cmd-grid" id="pwCmdGrid">
          <button type="button" class="btn btn-ghost pw-cmd" data-cmd="find-leads">Find Today's Leads</button>
          <button type="button" class="btn btn-ghost pw-cmd" data-cmd="refresh-batch">Refresh Active Batch</button>
          <button type="button" class="btn btn-primary pw-cmd" data-cmd="start-calling">Start Calling</button>
          <button type="button" class="btn btn-ghost pw-cmd" data-cmd="follow-ups">Call Follow-Ups</button>
          <button type="button" class="btn btn-ghost pw-cmd" data-cmd="estimates">Send Estimates</button>
          <button type="button" class="btn btn-ghost pw-cmd" data-cmd="health">View Queue Health</button>
          <a class="btn btn-ghost pw-cmd" href="/pw/queue" style="text-decoration:none">Open PW Queue</a>
        </div>
      </div>
    </div>

    <div class="sheet" id="pwFindLeadsSheet">
      <div class="sheet-panel">
        <div class="sheet-handle"></div>
        <h2 style="font-size:18px;font-weight:800;margin:0 0 14px">Find Today's Leads</h2>
        <p class="card-body" style="margin:0 0 12px">Run this command in Cursor or your terminal. The browser cannot execute local scripts.</p>
        <p id="pwFindCmd" style="font-family:monospace;font-size:14px;background:var(--bg-elevated);padding:14px;border-radius:8px;margin:0 0 14px;word-break:break-all">npm run pw:find-leads -- --scrape</p>
        <a class="btn btn-ghost btn-block" href="/pw/search-targets">View Search Targets</a>
        <button type="button" class="btn btn-primary btn-block" id="pwFindClose" style="margin-top:8px">Close</button>
      </div>
    </div>
  `;

  const headExtra = `
    .mode-switch {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 18px;
      padding: 4px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .mode-btn {
      min-height: var(--tap);
      border: none;
      border-radius: 10px;
      background: transparent;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      padding: 12px 8px;
      line-height: 1.2;
    }
    .mode-btn.active {
      background: var(--accent-soft);
      color: var(--text);
      box-shadow: inset 0 0 0 1px rgba(99,102,241,0.35);
    }
    body.mode-pressure-washing {
      background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(14,165,233,0.18), transparent), var(--bg);
    }
    body.mode-pressure-washing .mode-btn.active {
      background: rgba(14,165,233,0.18);
      box-shadow: inset 0 0 0 1px rgba(14,165,233,0.4);
    }
    body.mode-pressure-washing .pw-highlight {
      border-color: rgba(14,165,233,0.35);
      background: linear-gradient(145deg, rgba(14,165,233,0.12), rgba(24,24,27,0.95));
    }
    body.mode-pressure-washing .pw-cta {
      background: #0ea5e9;
      border-color: transparent;
    }
    .pw-stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 14px;
      line-height: 1.45;
    }
    .pw-stat { background: var(--bg-elevated); border-radius: 10px; padding: 10px 12px; }
    .pw-stat-num { font-size: 20px; font-weight: 800; line-height: 1.1; }
    .pw-stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-dim); margin-top: 4px; }
    .pw-cmd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .pw-cmd-grid .btn { min-height: var(--tap); font-size: 14px; padding: 12px 10px; }
    .target-progress { margin-bottom: 12px; }
    .target-progress-head { display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
    .target-bar { height: 8px; background: var(--bg-elevated); border-radius: 999px; overflow: hidden; }
    .target-fill { height: 100%; background: #0ea5e9; border-radius: 999px; transition: width 0.2s; }
    .target-fill.done { background: #22c55e; }
    .activity-row { padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
    .activity-row:last-child { border-bottom: none; }
    .activity-name { font-weight: 700; margin-bottom: 2px; }
    .activity-meta { color: var(--text-muted); font-size: 13px; }
    .sheet { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:150; align-items:flex-end; }
    .sheet.open { display:flex; }
    .sheet-panel { width:100%; background:var(--bg-card); border-top:1px solid var(--border); border-radius:20px 20px 0 0; padding:20px 16px calc(20px + var(--safe-bottom)); max-height:80dvh; overflow-y:auto; }
    .sheet-handle { width:40px; height:4px; background:var(--border-strong); border-radius:999px; margin:0 auto 16px; }
    .next-name { font-size: clamp(22px, 5vw, 28px); font-weight: 800; letter-spacing: -0.02em; margin-bottom: 10px; }
    .test-note { font-size: 14px; color: var(--text-muted); line-height: 1.45; margin-bottom: 14px; }
    .test-status { font-size: 14px; font-weight: 600; min-height: 20px; margin-top: 10px; color: var(--accent); }
    .test-status.error { color: #f87171; }
    .test-status.ok { color: #4ade80; }
  `;

  const script = `
    ${clientSafeRenderScript()}

    var MODE_KEY='${MODE_STORAGE_KEY}';
    var currentMode='website';

    function esc(s){return escHtml(s);}
    function pct(c,t){return t?Math.min(100,Math.round(c/t*100)):0;}
    function money(n){return '$'+Number(n||0).toLocaleString();}

    function getStoredMode(){
      try{
        var m=localStorage.getItem(MODE_KEY);
        return m==='pressure-washing'?'pressure-washing':'website';
      }catch(e){ return 'website'; }
    }

    function setMode(mode){
      currentMode=mode==='pressure-washing'?'pressure-washing':'website';
      try{ localStorage.setItem(MODE_KEY, currentMode); }catch(e){}
      document.body.classList.toggle('mode-pressure-washing', currentMode==='pressure-washing');
      document.getElementById('websitePanel').classList.toggle('hidden', currentMode!=='website');
      document.getElementById('pwPanel').classList.toggle('hidden', currentMode!=='pressure-washing');
      document.querySelectorAll('.mode-btn').forEach(function(btn){
        var active=btn.getAttribute('data-mode')===currentMode;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active?'true':'false');
      });
      if(currentMode==='website'){
        document.getElementById('modeEyebrow').textContent='Website Outreach';
        document.getElementById('modeTitle').textContent='Website Outreach Command Center';
        refreshWebsiteGreeting();
      }else{
        document.getElementById('modeEyebrow').textContent='Zeal Power Washing';
        document.getElementById('modeTitle').textContent='Pressure Washing Outreach Command Center';
        loadPwFounderControl();
      }
    }

    function greetName(operator){
      var h=new Date().getHours();
      var greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
      var name=operator&&operator.name?operator.name.split(' ')[0]:'Jaylan';
      return { greet: greet, name: name };
    }

    function refreshWebsiteGreeting(){
      fetch('/api/pivotal-os/dashboard').then(function(r){return r.json();}).then(function(data){
        var g=greetName(data.operator);
        document.getElementById('greeting').textContent=g.greet+', '+g.name+'. '+(data.daily&&data.daily.callableLeads||0)+' leads in your queue.';
      }).catch(function(){});
    }

    function refreshPwGreeting(control){
      fetch('/api/pivotal-os/dashboard').then(function(r){return r.json();}).then(function(op){
        var g=greetName(op.operator);
        var active=control&&control.health?control.health.active:0;
        var avail=control&&control.health?control.health.available:0;
        document.getElementById('greeting').textContent=g.greet+', '+g.name+'. '+active+' active · '+avail+' waiting in pool.';
      }).catch(function(){});
    }

    function renderPwStatGrid(health, daily){
      var el=document.getElementById('pwHealthStats');
      el.replaceChildren();
      var items=[
        ['Active', health.active||0],
        ['Available', health.available||0],
        ['Follow-ups due', health.followUpDue||0],
        ['Completed today', health.completedToday||0],
        ['Calls today', daily.callsToday||0],
        ['Talks today', daily.conversationsToday||0],
        ['Estimates needed', daily.estimatesNeeded||0],
        ['Estimates sent', daily.estimatesSent||0],
        ['Jobs won today', daily.jobsWonToday||0],
        ['Revenue won', money(daily.revenueWonToday||0)]
      ];
      items.forEach(function(pair){
        var box=makeEl('div','pw-stat');
        var num=makeEl('div','pw-stat-num');
        num.textContent=sanitizeText(String(pair[1]));
        box.appendChild(num);
        box.appendChild(makeEl('div','pw-stat-label',pair[0]));
        el.appendChild(box);
      });
    }

    function renderPwHealthExpanded(health){
      var el=document.getElementById('pwHealthExpanded');
      el.textContent=
        'Total leads: '+(health.totalLeads||0)+
        ' · Won: '+(health.won||0)+
        ' · Lost: '+(health.lost||0)+
        ' · Suppressed: '+(health.suppressed||0)+
        ' · Needs replenishment: '+(health.needsReplenishment?'Yes':'No')+
        ' · Next batch size: '+(health.nextBatchSize||0)+
        (health.lastUpdatedAt?' · Updated: '+new Date(health.lastUpdatedAt).toLocaleString():'');
    }

    function renderPwProgress(progress){
      var el=document.getElementById('pwTargets');
      el.replaceChildren();
      var rows=[
        ['Calls', progress.calls],
        ['Conversations', progress.conversations],
        ['Estimates', progress.estimates],
        ['Jobs Won', progress.jobsWon]
      ];
      rows.forEach(function(row){
        var label=row[0], p=row[1];
        var wrap=makeEl('div','target-progress');
        var head=makeEl('div','target-progress-head');
        head.appendChild(document.createTextNode(label+': '));
        var val=document.createElement('span');
        val.textContent=(p.current||0)+' / '+(p.target||0);
        head.appendChild(val);
        wrap.appendChild(head);
        var bar=makeEl('div','target-bar');
        var fill=makeEl('div','target-fill');
        var pc=p.target?Math.min(100,Math.round((p.current||0)/p.target*100)):0;
        fill.style.width=pc+'%';
        if(pc>=100) fill.classList.add('done');
        bar.appendChild(fill);
        wrap.appendChild(bar);
        el.appendChild(wrap);
      });
    }

    function renderPwActivity(activity){
      var el=document.getElementById('pwActivity');
      el.replaceChildren();
      if(!activity||!activity.length){
        el.appendChild(makeEl('p','card-body','No pressure washing activity logged today.'));
        return;
      }
      activity.forEach(function(row){
        var item=makeEl('div','activity-row');
        item.appendChild(makeEl('div','activity-name',row.businessName));
        var meta=makeEl('div','activity-meta');
        var parts=[row.outcome];
        if(row.contactedAt){
          try{ parts.push(new Date(row.contactedAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})); }catch(e){}
        }
        if(row.nextFollowUpAt){
          try{ parts.push('Follow-up: '+new Date(row.nextFollowUpAt).toLocaleDateString()); }catch(e){}
        }
        meta.textContent=parts.join(' · ');
        item.appendChild(meta);
        el.appendChild(item);
      });
    }

    function renderPwRecommendation(rec){
      document.getElementById('pwRecMsg').textContent=sanitizeText(rec.message||'');
      var actions=document.getElementById('pwRecActions');
      actions.replaceChildren();
      if(rec.primary){
        var primary;
        if(rec.primary.href){
          primary=makeLink(rec.primary.href,'btn btn-primary',rec.primary.label);
        }else{
          primary=document.createElement('button');
          primary.type='button';
          primary.className='btn btn-primary';
          primary.textContent=sanitizeText(rec.primary.label);
          primary.setAttribute('data-cmd', rec.primary.action||'');
        }
        if(primary) actions.appendChild(primary);
      }
      if(rec.secondary&&rec.secondary.href){
        var sec=makeLink(rec.secondary.href,'btn btn-ghost',rec.secondary.label);
        if(sec) actions.appendChild(sec);
      }
      actions.querySelectorAll('[data-cmd]').forEach(function(btn){
        btn.onclick=function(){ handlePwCmd(btn.getAttribute('data-cmd')); };
      });
    }

    function openPwSheet(id){
      document.querySelectorAll('.sheet').forEach(function(s){s.classList.remove('open');});
      document.getElementById(id).classList.add('open');
    }

    function handlePwCmd(cmd){
      if(cmd==='find-leads') openPwSheet('pwFindLeadsSheet');
      else if(cmd==='refresh-batch'){
        fetch('/api/pw/queue/refresh',{method:'POST'}).then(function(r){return r.json();}).then(function(){
          loadPwFounderControl();
          showPwToast('Batch refreshed');
        }).catch(function(e){ showPwToast(e.message); });
      }
      else if(cmd==='start-calling') window.location.href='/pw/queue';
      else if(cmd==='follow-ups') window.location.href='/pw/queue?view=follow-ups';
      else if(cmd==='estimates') window.location.href='/pw/queue?view=estimates';
      else if(cmd==='health'){
        var exp=document.getElementById('pwHealthExpanded');
        exp.classList.toggle('hidden');
      }
    }

    var pwToastTimer=null;
    function showPwToast(msg){
      var el=document.getElementById('pwRecMsg');
      if(!el) return;
      var prev=el.textContent;
      el.textContent=sanitizeText(msg);
      clearTimeout(pwToastTimer);
      pwToastTimer=setTimeout(function(){ loadPwFounderControl(); },1200);
    }

    function loadPwFounderControl(){
      fetch('/api/pw/founder-control').then(function(r){return r.json();}).then(function(data){
        renderPwStatGrid(data.health||{}, data.daily||{});
        renderPwHealthExpanded(data.health||{});
        renderPwProgress(data.progress||{});
        renderPwActivity(data.activity||[]);
        renderPwRecommendation(data.recommendation||{});
        if(data.findLeadsCommand){
          document.getElementById('pwFindCmd').textContent=data.findLeadsCommand;
        }
        if(currentMode==='pressure-washing') refreshPwGreeting(data);
      }).catch(function(e){
        document.getElementById('pwRecMsg').textContent=sanitizeText(e.message);
      });
    }

    document.querySelectorAll('.pw-cmd').forEach(function(btn){
      btn.addEventListener('click',function(){
        var cmd=btn.getAttribute('data-cmd');
        if(cmd) handlePwCmd(cmd);
      });
    });
    document.getElementById('pwFindClose').onclick=function(){
      document.getElementById('pwFindLeadsSheet').classList.remove('open');
    };

    document.getElementById('modeSwitch').addEventListener('click',function(e){
      var btn=e.target.closest('.mode-btn');
      if(!btn) return;
      setMode(btn.getAttribute('data-mode'));
    });

    function renderWebsiteNext(opp){
      var el=document.getElementById('nextContent');
      if(!opp){el.innerHTML='<p class="card-body">No callable leads in queue.</p>';return;}
      var btns='';
      if(opp.callUrl) btns+='<a class="btn btn-primary btn-block" href="'+esc(safeHref(opp.callUrl,['tel:']))+'">Call now</a>';
      if(opp.previewUrl) btns+='<a class="btn btn-ghost btn-block" href="'+esc(safeHref(opp.previewUrl,['http:','https:']))+'" target="_blank" rel="noopener">View preview</a>';
      el.innerHTML=
        '<div class="next-name">'+esc(opp.businessName)+'</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">'+
          '<span class="badge hot">'+esc(opp.opportunityType)+'</span>'+
          '<span class="badge accent">'+esc(String(opp.confidenceScore||0))+'% confidence</span>'+
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
      el.textContent=sanitizeText(msg||'');
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
        setTestStatus(e.message||'Call failed','error');
      }finally{
        if(btn) btn.disabled=false;
      }
    }

    function renderTwilioTest(test){
      var el=document.getElementById('twilioTestContent');
      if(!test){
        el.innerHTML='<p class="card-body">Twilio test lead not found.</p>';
        return;
      }
      var callUrl=safeHref(test.callUrl,['tel:']);
      el.innerHTML=
        '<div class="next-name">'+esc(test.businessName)+'</div>'+
        '<div class="card-body" style="margin-bottom:10px">'+esc(test.phone)+' · '+esc(test.city)+'</div>'+
        '<p class="test-note">Run this before real leads. Your phone rings first, then connects to the test number with recording.</p>'+
        '<div class="btn-row">'+
          '<button type="button" class="btn btn-primary" id="twilioTestCallBtn">Call with Recording</button>'+
          (callUrl?'<a class="btn btn-ghost" href="'+esc(callUrl)+'">Call Direct</a>':'')+
        '</div>'+
        '<div id="twilioTestStatus" class="test-status" aria-live="polite"></div>'+
        (test.callQueueUrl?'<a class="btn btn-ghost btn-block" href="'+esc(safeHref(test.callQueueUrl)||test.callQueueUrl)+'" style="margin-top:10px">Open in Call Queue</a>':'');
      document.getElementById('twilioTestCallBtn').onclick=function(){
        startTwilioTestCall(test.id);
      };
    }

    function renderWebsiteDaily(d, operator){
      var h=new Date().getHours();
      var greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
      var name=operator&&operator.name?operator.name.split(' ')[0]:'Jaylan';
      if(currentMode==='website'){
        document.getElementById('greeting').textContent=greet+', '+name+'. '+(d.callableLeads||0)+' leads in your queue.';
      }
      var p=d.progress||{};
      document.getElementById('callsNum').textContent=(p.calls&&p.calls.completed)||0;
      document.getElementById('callsTarget').textContent='of '+((p.calls&&p.calls.target)||0);
      document.getElementById('convNum').textContent=(p.conversations&&p.conversations.completed)||0;
      document.getElementById('convTarget').textContent='of '+((p.conversations&&p.conversations.target)||0);
      document.getElementById('apptNum').textContent=(p.appointments&&p.appointments.completed)||0;
      document.getElementById('apptTarget').textContent='of '+((p.appointments&&p.appointments.target)||0);
      document.getElementById('callsProgress').style.width=pct((p.calls&&p.calls.completed)||0,(p.calls&&p.calls.target)||0)+'%';
      if(p.calls&&p.calls.completed>=p.calls.target) document.getElementById('callsProgress').classList.add('success');
      document.getElementById('revenueToday').textContent=money(d.potentialRevenueToday);
    }

    setMode(getStoredMode());

    Promise.all([
      fetch('/api/pivotal-os/dashboard').then(function(r){return r.json();})
    ]).then(function(results){
      renderWebsiteDaily(results[0].daily, results[0].operator);
      renderTwilioTest(results[0].twilioTest);
      renderWebsiteNext(results[0].nextOpportunity);
      if(currentMode==='pressure-washing') loadPwFounderControl();
    }).catch(function(err){
      document.getElementById('greeting').textContent=sanitizeText(err.message);
    });
  `;

  return pivotalShell({
    title: "Mission Control",
    activeNav: "home",
    bodyHtml: body + `<script>${script}</script>`,
    headExtra,
  });
}
