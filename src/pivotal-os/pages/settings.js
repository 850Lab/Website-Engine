import { pivotalShell } from "../shell.js";

export function renderSettingsPage() {
  const body = `
    <p class="eyebrow">Settings</p>
    <h1 class="hero-title">Profile</h1>
    <p class="hero-sub">Your operator account and team access.</p>

    <div class="card" id="profileCard">
      <div class="card-label">Signed in as</div>
      <div class="card-value" id="profileName" style="font-size:22px">Loading…</div>
      <div class="card-body" id="profileDetail" style="margin-top:8px"></div>
      <div class="btn-row" id="profileActions" style="margin-top:12px"></div>
    </div>

    <div class="card hidden" id="teamCard">
      <div class="card-label">Invite operator</div>
      <p class="card-body" style="margin-bottom:14px">Each operator gets their own call queue. Leads are claimed when they open them, so two people won't call the same business.</p>
      <form id="inviteForm">
        <div class="field"><label class="field-label">Name</label><input class="field-input" id="inviteName" required /></div>
        <div class="field"><label class="field-label">Email</label><input class="field-input" id="inviteEmail" type="email" required /></div>
        <div class="field"><label class="field-label">Temporary password</label><input class="field-input" id="invitePassword" type="password" required /></div>
        <p class="auth-error hidden" id="inviteError"></p>
        <button type="submit" class="btn btn-primary btn-block">Add operator</button>
      </form>
      <div class="card-label" style="margin-top:18px">Team</div>
      <div id="teamList" class="card-body">Loading…</div>
    </div>

    <div class="card hidden" id="twilioCard">
      <div class="card-label">Twilio Voice</div>
      <div class="card-value" id="twilioStatus" style="font-size:18px">Checking…</div>
      <div class="card-body" id="twilioDetail" style="margin-top:8px;margin-bottom:14px"></div>
      <form id="twilioForm">
        <div class="field"><label class="field-label">Account SID</label><input class="field-input" id="twilioAccountSid" autocomplete="off" /></div>
        <div class="field"><label class="field-label">Auth token</label><input class="field-input" id="twilioAuthToken" type="password" autocomplete="new-password" placeholder="Leave blank to keep current" /></div>
        <div class="field"><label class="field-label">From number</label><input class="field-input" id="twilioFromNumber" placeholder="+15551234567" /></div>
        <div class="field"><label class="field-label">Your phone (rings first)</label><input class="field-input" id="twilioFounderPhone" placeholder="+15551234567" /></div>
        <div class="field"><label class="field-label">Public base URL</label><input class="field-input" id="twilioPublicBaseUrl" placeholder="https://www.pivotalwebsites.com" /></div>
        <p class="auth-error hidden" id="twilioError"></p>
        <p class="card-body hidden" id="twilioSuccess" style="color:#4ade80;margin-bottom:12px"></p>
        <button type="submit" class="btn btn-primary btn-block">Save Twilio settings</button>
      </form>
      <p class="card-body" style="margin-top:12px;font-size:13px;color:var(--text-dim)">Saved to cloud storage when BLOB_READ_WRITE_TOKEN is set on Vercel — not just this machine's .env file.</p>
    </div>

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
    </div>
  `;

  const headExtra = `
    .field { margin-bottom: 12px; }
    .field-label { display:block; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-dim); margin-bottom:8px; }
    .field-input { width:100%; min-height:var(--tap); border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-elevated); color:var(--text); padding:14px 16px; font-size:16px; font-family:inherit; }
    .auth-error { font-size:14px; color:#f87171; margin:0 0 12px; }
    .hidden { display:none !important; }
    .team-row { padding:10px 0; border-bottom:1px solid var(--border); }
    .team-row:last-child { border-bottom:none; }
  `;

  const script = `
    function money(n){return '$'+Number(n).toLocaleString();}

    async function jsonFetch(url, opts){
      var res=await fetch(url, opts||{});
      var data=await res.json().catch(function(){return {};});
      if(!res.ok) throw new Error(data.error||res.statusText);
      return data;
    }

    function renderProfile(me){
      document.getElementById('profileName').textContent=me.operator.name;
      document.getElementById('profileDetail').textContent=me.operator.email+' · '+me.operator.role;
      document.getElementById('profileActions').innerHTML='<button type="button" class="btn btn-ghost" id="logoutBtn">Sign out</button>';
      document.getElementById('logoutBtn').onclick=function(){
        fetch('/api/logout',{method:'POST'}).then(function(){window.location.href='/login?return=/settings';});
      };
      if(me.operator.role==='owner'){
        document.getElementById('teamCard').classList.remove('hidden');
        document.getElementById('twilioCard').classList.remove('hidden');
        loadTeam();
        loadTwilioSettings();
      }
    }

    function renderTwilioSettings(data){
      document.getElementById('twilioStatus').textContent=data.configured?'Ready for calls':'Not configured';
      var detail=data.configured
        ? 'Click-to-call uses '+data.storage+'. Sources: '+(data.sources||[]).join(', ')
        : 'Missing: '+(data.missing||[]).join(', ')+'. Fill in below and save.';
      document.getElementById('twilioDetail').textContent=detail;
      document.getElementById('twilioAccountSid').value=data.accountSid||'';
      document.getElementById('twilioFromNumber').value=data.fromNumber||'';
      document.getElementById('twilioFounderPhone').value=data.founderPhone||'';
      document.getElementById('twilioPublicBaseUrl').value=data.publicBaseUrl||'';
      document.getElementById('twilioAuthToken').value='';
      document.getElementById('twilioAuthToken').placeholder=data.hasAuthToken?'Leave blank to keep current':'Required';
    }

    async function loadTwilioSettings(){
      try{
        var data=await jsonFetch('/api/twilio/voice/settings');
        renderTwilioSettings(data);
      }catch(e){
        document.getElementById('twilioStatus').textContent='Error';
        document.getElementById('twilioDetail').textContent=e.message;
      }
    }

    document.getElementById('twilioForm').addEventListener('submit',function(e){
      e.preventDefault();
      var errEl=document.getElementById('twilioError');
      var okEl=document.getElementById('twilioSuccess');
      errEl.classList.add('hidden');
      okEl.classList.add('hidden');
      var body={
        accountSid:document.getElementById('twilioAccountSid').value.trim(),
        fromNumber:document.getElementById('twilioFromNumber').value.trim(),
        founderPhone:document.getElementById('twilioFounderPhone').value.trim(),
        publicBaseUrl:document.getElementById('twilioPublicBaseUrl').value.trim()
      };
      var token=document.getElementById('twilioAuthToken').value;
      if(token) body.authToken=token;
      jsonFetch('/api/twilio/voice/settings',{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
      }).then(function(data){
        renderTwilioSettings(data);
        okEl.textContent='Twilio settings saved.';
        okEl.classList.remove('hidden');
      }).catch(function(err){
        errEl.textContent=err.message;
        errEl.classList.remove('hidden');
      });
    });

    async function loadTeam(){
      try{
        var data=await jsonFetch('/api/operators');
        var html=(data.operators||[]).map(function(op){
          return '<div class="team-row"><strong>'+op.name+'</strong><br><span style="color:var(--text-dim)">'+op.email+' · '+op.role+'</span></div>';
        }).join('');
        document.getElementById('teamList').innerHTML=html||'No operators yet.';
      }catch(e){
        document.getElementById('teamList').textContent=e.message;
      }
    }

    document.getElementById('inviteForm').addEventListener('submit',function(e){
      e.preventDefault();
      var errEl=document.getElementById('inviteError');
      errEl.classList.add('hidden');
      jsonFetch('/api/operators',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          name:document.getElementById('inviteName').value.trim(),
          email:document.getElementById('inviteEmail').value.trim(),
          password:document.getElementById('invitePassword').value
        })
      }).then(function(){
        document.getElementById('inviteName').value='';
        document.getElementById('inviteEmail').value='';
        document.getElementById('invitePassword').value='';
        loadTeam();
      }).catch(function(err){
        errEl.textContent=err.message;
        errEl.classList.remove('hidden');
      });
    });

    Promise.all([
      fetch('/api/me').then(function(r){return r.json();}),
      fetch('/api/pivotal-os/settings').then(function(r){return r.json();})
    ]).then(function(results){
      var me=results[0];
      var data=results[1];
      if(!me.authenticated){ window.location.href='/login?return=/settings'; return; }
      renderProfile(me);
      var s=data.storage;
      document.getElementById('storageStatus').textContent=s.outcomesPersist?'Cloud sync active':'Not persisting';
      document.getElementById('storageDetail').textContent=s.outcomesPersist
        ? 'Outcomes and notes save to Vercel Blob ('+s.backend+').'
        : 'Set BLOB_READ_WRITE_TOKEN on Vercel for production persistence.';
      var g=data.goals;
      document.getElementById('goalsBody').textContent=g.calls+' calls · '+g.conversations+' conversations · '+g.appointments+' appointment per day';
      document.getElementById('dealValue').textContent=money(data.dealValue);
    }).catch(function(e){
      document.getElementById('profileName').textContent='Error';
      document.getElementById('profileDetail').textContent=e.message;
    });
  `;

  return pivotalShell({
    title: "Settings",
    activeNav: "settings",
    bodyHtml: body + `<script>${script}</script>`,
    headExtra,
  });
}
