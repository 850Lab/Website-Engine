import { pivotalShell } from "../shell.js";

export function renderLoginPage(returnTo = "/") {
  const safeReturn = String(returnTo ?? "/").startsWith("/") ? returnTo : "/";

  const body = `
    <p class="eyebrow">Pivotal OS</p>
    <h1 class="hero-title">Sign in</h1>
    <p class="hero-sub" id="loginSub">Your call queue and leads are private to your operator profile.</p>

    <div class="card" id="authCard">
      <div class="card-label" id="authModeLabel">Sign in</div>
      <form id="authForm" autocomplete="on">
        <div id="nameWrap" class="field hidden">
          <label class="field-label" for="authName">Your name</label>
          <input class="field-input" id="authName" name="name" type="text" autocomplete="name" />
        </div>
        <div class="field">
          <label class="field-label" for="authEmail">Email</label>
          <input class="field-input" id="authEmail" name="email" type="email" autocomplete="username" required />
        </div>
        <div class="field">
          <label class="field-label" for="authPassword">Password</label>
          <input class="field-input" id="authPassword" name="password" type="password" autocomplete="current-password" required />
        </div>
        <p class="field-hint" id="authHint"></p>
        <p class="auth-error hidden" id="authError"></p>
        <button type="submit" class="btn btn-primary btn-block" id="authSubmit">Sign in</button>
      </form>
    </div>
  `;

  const headExtra = `
    .field { margin-bottom: 14px; }
    .field-label {
      display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--text-dim); margin-bottom: 8px;
    }
    .field-input {
      width: 100%; min-height: var(--tap); border: 1px solid var(--border);
      border-radius: var(--radius-sm); background: var(--bg-elevated); color: var(--text);
      padding: 14px 16px; font-size: 16px; font-family: inherit;
    }
    .field-input:focus { outline: none; border-color: rgba(99,102,241,0.5); }
    .field-hint { font-size: 13px; color: var(--text-dim); line-height: 1.45; margin: 0 0 12px; }
    .auth-error { font-size: 14px; color: #f87171; margin: 0 0 12px; }
    .hidden { display: none !important; }
  `;

  const script = `
    var returnTo=${JSON.stringify(safeReturn)};
    var signupMode=false;

    function showError(msg){
      var el=document.getElementById('authError');
      el.textContent=msg||'';
      el.classList.toggle('hidden',!msg);
    }

    async function jsonFetch(url, opts){
      var res=await fetch(url, opts||{});
      var data=await res.json().catch(function(){return {};});
      if(!res.ok) throw new Error(data.error||res.statusText||'Request failed');
      return data;
    }

    function setSignupMode(on){
      signupMode=on;
      document.getElementById('authModeLabel').textContent=on?'Create owner account':'Sign in';
      document.getElementById('authSubmit').textContent=on?'Create account':'Sign in';
      document.getElementById('nameWrap').classList.toggle('hidden',!on);
      document.getElementById('loginSub').textContent=on
        ? 'First-time setup for this deployment. You will be the owner and can invite operators later.'
        : 'Your call queue and leads are private to your operator profile.';
      document.getElementById('authHint').textContent=on
        ? 'After setup, new users must be invited from Settings.'
        : 'Need access? Ask the account owner to invite you from Settings.';
    }

    fetch('/api/auth/status').then(function(r){return r.json();}).then(function(status){
      if(status.signupRequired) setSignupMode(true);
    }).catch(function(){});

    fetch('/api/me').then(function(r){return r.json();}).then(function(me){
      if(me.authenticated) window.location.href=returnTo;
    }).catch(function(){});

    document.getElementById('authForm').addEventListener('submit',function(e){
      e.preventDefault();
      showError('');
      var name=document.getElementById('authName').value.trim();
      var email=document.getElementById('authEmail').value.trim();
      var password=document.getElementById('authPassword').value;
      var url=signupMode?'/api/signup':'/api/login';
      var body={email:email,password:password};
      if(signupMode) body.name=name;
      document.getElementById('authSubmit').disabled=true;
      jsonFetch(url,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
      }).then(function(){
        window.location.href=returnTo;
      }).catch(function(err){
        showError(err.message||'Sign in failed');
      }).finally(function(){
        document.getElementById('authSubmit').disabled=false;
      });
    });
  `;

  return pivotalShell({
    title: "Sign in",
    activeNav: "settings",
    bodyHtml: body + `<script>${script}</script>`,
    headExtra,
  });
}
