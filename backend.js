/* Lumo web: inloggen, team en opslag op Supabase.
   Deze laag doet zich voor als de claude.ai-omgeving (db, user, sample, downloads),
   zodat de app zelf niet hoeft te weten waar de gegevens staan. */
(function () {
  'use strict';
  var CFG = window.LUMO_CONFIG || {};
  var appEl = function () { return document.getElementById('app'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sb = null, session = null, info = null, appAdmin = false;

  function nlError(e) {
    var m = String((e && (e.message || e.error_description)) || e || '');
    if (/Invalid login credentials/i.test(m)) return 'E-mail of wachtwoord klopt niet.';
    if (/already registered|already been registered/i.test(m)) return 'Dit e-mailadres heeft al een account. Log in.';
    if (/Password should be|at least 6|weak/i.test(m)) return 'Kies een wachtwoord van minstens 8 tekens.';
    if (/Email not confirmed/i.test(m)) return 'Bevestig eerst je e-mailadres met de link in je mail.';
    if (/rate limit|too many/i.test(m)) return 'Te veel pogingen. Wacht even en probeer het opnieuw.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
    return m || 'Er ging iets mis. Probeer het opnieuw.';
  }

  /* ---------- schermen ---------- */
  function screen(html) {
    appEl().innerHTML = '<div class="wiz" style="max-width:460px;margin:0 auto"><div class="row" style="color:var(--brand)"><span class="brand" style="font-size:28px">Lumo</span></div><div class="auth-card">' + html + '</div></div>';
  }
  function msg(t, ok) { var m = document.getElementById('lw-msg'); if (m) { m.textContent = t || ''; m.className = 'small ' + (ok ? 'muted' : ''); m.style.color = ok ? '' : 'var(--danger)'; } }
  function busy(b, label) { var x = document.getElementById('lw-go'); if (x) { x.disabled = !!b; if (label) x.textContent = label; } }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function inviteCode() { try { var u = new URL(location.href).searchParams.get('code'); if (u) { localStorage.setItem('lumo:invite', u); history.replaceState(null, '', location.pathname); } return localStorage.getItem('lumo:invite') || ''; } catch (e) { return ''; } }

  function showSetup() {
    screen('<h1>Bijna klaar</h1><p>Deze app is nog niet gekoppeld aan een database. Open <code>config.js</code> en vul de twee Supabase-gegevens in. De stappen staan in README.md.</p>');
  }

  function showAuth(mode, note) {
    mode = mode || (inviteCode() ? 'up' : 'in');
    var up = mode === 'up', code = inviteCode();
    screen('<h1>' + (up ? 'Account maken' : 'Inloggen') + '</h1>' +
      (code && up ? '<p class="small muted">Je bent uitgenodigd voor een team. Maak een account om mee te doen.</p>' : '') +
      (note ? '<div class="banner">' + esc(note) + '</div>' : '') +
      '<form id="lw-form" novalidate>' +
      (up ? '<label class="f" for="lw-name">Je naam<input type="text" id="lw-name" autocomplete="name" required></label>' : '') +
      '<label class="f" for="lw-email">E-mail<input type="email" id="lw-email" autocomplete="email" inputmode="email" required></label>' +
      '<label class="f" for="lw-pw">Wachtwoord' + (up ? '<span class="hint">Minstens 8 tekens.</span>' : '') + '<input type="password" id="lw-pw" autocomplete="' + (up ? 'new-password' : 'current-password') + '" required></label>' +
      '<p id="lw-msg" class="small" role="alert" aria-live="polite"></p>' +
      '<div class="row"><button class="btn" id="lw-go" type="submit">' + (up ? 'Account maken' : 'Inloggen') + '</button></div></form>' +
      '<div class="row small"><button class="btn ghost small" id="lw-switch" type="button">' + (up ? 'Ik heb al een account' : 'Nieuw hier? Account maken') + '</button>' + (up ? '' : '<button class="btn ghost small" id="lw-forgot" type="button">Wachtwoord vergeten</button>') + '</div>' +
      '<p class="small muted">Door een account te maken ga je akkoord met de <a href="privacy.html" target="_blank" rel="noopener">privacyverklaring</a>.</p>');
    document.getElementById('lw-switch').onclick = function () { showAuth(up ? 'in' : 'up'); };
    var f = document.getElementById('lw-forgot'); if (f) f.onclick = forgot;
    document.getElementById('lw-form').onsubmit = function (ev) { ev.preventDefault(); up ? signUp() : signIn(); };
  }

  async function forgot() {
    var email = val('lw-email'); if (!email) { msg('Vul eerst je e-mailadres in.'); return; }
    var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    msg(r.error ? nlError(r.error) : 'Als dit adres bij ons bekend is, krijg je een mail met een link om een nieuw wachtwoord te kiezen.', !r.error);
  }

  function showNewPassword() {
    screen('<h1>Nieuw wachtwoord</h1><form id="lw-form" novalidate><label class="f" for="lw-pw">Nieuw wachtwoord<span class="hint">Minstens 8 tekens.</span><input type="password" id="lw-pw" autocomplete="new-password" required></label><p id="lw-msg" class="small" role="alert" aria-live="polite"></p><div class="row"><button class="btn" id="lw-go" type="submit">Opslaan</button></div></form>');
    document.getElementById('lw-form').onsubmit = async function (ev) {
      ev.preventDefault(); var pw = val('lw-pw'); if (pw.length < 8) { msg('Kies een wachtwoord van minstens 8 tekens.'); return; }
      busy(true); var r = await sb.auth.updateUser({ password: pw }); busy(false);
      if (r.error) { msg(nlError(r.error)); return; }
      history.replaceState(null, '', location.pathname); next();
    };
  }

  async function signIn() {
    var email = val('lw-email'), pw = document.getElementById('lw-pw').value; if (!email || !pw) { msg('Vul je e-mail en wachtwoord in.'); return; }
    busy(true, 'Bezig…'); var r = await sb.auth.signInWithPassword({ email: email, password: pw }); busy(false, 'Inloggen');
    if (r.error) { msg(nlError(r.error)); return; }
    next();
  }
  async function signUp() {
    var name = val('lw-name'), email = val('lw-email'), pw = document.getElementById('lw-pw').value;
    if (!name) { msg('Vul je naam in.'); return; } if (!email) { msg('Vul je e-mail in.'); return; } if (pw.length < 8) { msg('Kies een wachtwoord van minstens 8 tekens.'); return; }
    try { localStorage.setItem('lumo:name', name); } catch (e) { /* geen opslag */ }
    busy(true, 'Bezig…'); var r = await sb.auth.signUp({ email: email, password: pw, options: { data: { name: name }, emailRedirectTo: location.origin + location.pathname } }); busy(false, 'Account maken');
    if (r.error) { msg(nlError(r.error)); return; }
    if (!r.data.session) { screen('<h1>Check je mail</h1><p>We stuurden een bevestigingslink naar <b>' + esc(email) + '</b>. Klik erop en kom daarna terug naar Lumo om in te loggen.</p><div class="row"><button class="btn ghost" id="lw-back">Naar inloggen</button></div>'); document.getElementById('lw-back').onclick = function () { showAuth('in'); }; return; }
    next();
  }

  function showTeam(mode) {
    var code = inviteCode(); mode = mode || (code ? 'join' : 'create');
    var nm = ''; try { nm = localStorage.getItem('lumo:name') || ''; } catch (e) { /* */ }
    if (!nm && session && session.user && session.user.user_metadata) nm = session.user.user_metadata.name || '';
    screen('<h1>' + (mode === 'join' ? 'Bij een team komen' : 'Jouw team maken') + '</h1>' +
      '<form id="lw-form" novalidate><label class="f" for="lw-name">Je naam<input type="text" id="lw-name" value="' + esc(nm) + '" autocomplete="name"></label>' +
      (mode === 'join' ? '<label class="f" for="lw-code">Uitnodigingscode<input type="text" id="lw-code" value="' + esc(code) + '" autocapitalize="none" autocomplete="off"></label>' :
        '<label class="f" for="lw-team">Naam van je team<span class="hint">Bijvoorbeeld de naam van je business of groep.</span><input type="text" id="lw-team" autocomplete="organization"></label><p class="small muted">Jij wordt beheerder en kunt daarna leden uitnodigen met een link.</p>') +
      '<p id="lw-msg" class="small" role="alert" aria-live="polite"></p><div class="row"><button class="btn" id="lw-go" type="submit">' + (mode === 'join' ? 'Deelnemen' : 'Team maken') + '</button></div></form>' +
      '<div class="row"><button class="btn ghost small" id="lw-switch" type="button">' + (mode === 'join' ? 'Ik maak zelf een team' : 'Ik heb een uitnodigingscode') + '</button><button class="btn ghost small" id="lw-out" type="button">Uitloggen</button></div>');
    document.getElementById('lw-switch').onclick = function () { showTeam(mode === 'join' ? 'create' : 'join'); };
    document.getElementById('lw-out').onclick = function () { signOut(); };
    document.getElementById('lw-form').onsubmit = async function (ev) {
      ev.preventDefault(); var name = val('lw-name'); if (!name) { msg('Vul je naam in.'); return; }
      busy(true, 'Bezig…'); var r;
      if (mode === 'join') { var c = val('lw-code'); if (!c) { busy(false, 'Deelnemen'); msg('Vul de uitnodigingscode in.'); return; } r = await sb.rpc('join_team', { p_code: c, p_name: name }); }
      else { var t = val('lw-team'); if (t.length < 2) { busy(false, 'Team maken'); msg('Geef je team een naam.'); return; } r = await sb.rpc('create_team', { p_team: t, p_name: name }); }
      busy(false, mode === 'join' ? 'Deelnemen' : 'Team maken');
      if (r.error) { msg(nlError(r.error)); return; }
      try { localStorage.removeItem('lumo:invite'); } catch (e) { /* */ }
      info = r.data;
    try { var ra = await sb.rpc('is_app_admin'); appAdmin = !ra.error && ra.data === true; } catch (e) { appAdmin = false; }
    start();
    };
  }

  async function signOut() { try { await sb.auth.signOut(); } catch (e) { /* */ } location.replace(location.pathname); }

  /* ---------- runtime die de app verwacht ---------- */
  var listeners = {}, channel = null;
  function notify(path) { (listeners[path] || []).slice().forEach(function (fn) { fn(); }); }
  function ensureChannel() {
    if (channel || !info) return;
    channel = sb.channel('lumo-docs-' + info.team_id).on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'team_id=eq.' + info.team_id }, function (p) {
      var path = (p.new && p.new.path) || (p.old && p.old.path); if (path) notify(path);
    }).on('postgres_changes', { event: '*', schema: 'public', table: 'global_docs' }, function (p) {
      var path = (p.new && p.new.path) || (p.old && p.old.path); if (path) notify(path);
    }).subscribe();
  }
  var GLOBAL = { glibrary: 1 };
  function gcollection(path) {
    function fetchAll() {
      return sb.from('global_docs').select('id,data').eq('path', path).then(function (r) {
        if (r.error) throw r.error;
        return { docs: (r.data || []).map(function (d) { return { id: d.id, data: function () { return d.data; } }; }) };
      });
    }
    return {
      doc: function (id) {
        return {
          set: function (data) { return sb.from('global_docs').upsert({ path: path, id: String(id), data: data }, { onConflict: 'path,id' }).then(function (r) { if (r.error) throw r.error; }); },
          delete: function () { return sb.from('global_docs').delete().eq('path', path).eq('id', String(id)).then(function (r) { if (r.error) throw r.error; }); }
        };
      },
      onSnapshot: function (cb, errcb) {
        var alive = true, timer = null, poll = null;
        function run() { if (!alive) return; fetchAll().then(function (s) { if (alive) cb(s); }, function (e) { if (alive && errcb) errcb(e); }); }
        function soon() { clearTimeout(timer); timer = setTimeout(run, 150); }
        (listeners[path] = listeners[path] || []).push(soon); ensureChannel();
        poll = setInterval(function () { if (document.visibilityState === 'visible') run(); }, 60000);
        document.addEventListener('visibilitychange', soon);
        run();
        return function () { alive = false; clearInterval(poll); clearTimeout(timer); document.removeEventListener('visibilitychange', soon); listeners[path] = (listeners[path] || []).filter(function (f) { return f !== soon; }); };
      }
    };
  }
  function collection(path) {
    if (GLOBAL[path]) return gcollection(path);
    function fetchAll() {
      return sb.from('docs').select('id,data').eq('team_id', info.team_id).eq('path', path).then(function (r) {
        if (r.error) throw r.error;
        return { docs: (r.data || []).map(function (d) { return { id: d.id, data: function () { return d.data; } }; }) };
      });
    }
    return {
      doc: function (id) {
        return {
          set: function (data) { return sb.from('docs').upsert({ team_id: info.team_id, path: path, id: String(id), data: data }, { onConflict: 'team_id,path,id' }).then(function (r) { if (r.error) throw r.error; }); },
          delete: function () { return sb.from('docs').delete().eq('team_id', info.team_id).eq('path', path).eq('id', String(id)).then(function (r) { if (r.error) throw r.error; }); }
        };
      },
      onSnapshot: function (cb, errcb) {
        var alive = true, timer = null, poll = null;
        function run() { if (!alive) return; fetchAll().then(function (s) { if (alive) cb(s); }, function (e) { if (alive && errcb) errcb(e); }); }
        function soon() { clearTimeout(timer); timer = setTimeout(run, 150); }
        (listeners[path] = listeners[path] || []).push(soon); ensureChannel();
        poll = setInterval(function () { if (document.visibilityState === 'visible') run(); }, 45000);
        document.addEventListener('visibilitychange', soon);
        run();
        return function () { alive = false; clearInterval(poll); clearTimeout(timer); document.removeEventListener('visibilitychange', soon); listeners[path] = (listeners[path] || []).filter(function (f) { return f !== soon; }); };
      }
    };
  }

  async function token() { var r = await sb.auth.getSession(); if (!r.data.session) throw { code: 'auth', message: 'Log opnieuw in.' }; return r.data.session.access_token; }
  async function callAI(body, signal) {
    var res;
    try { res = await fetch(CFG.supabaseUrl + '/functions/v1/ai', { method: 'POST', signal: signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await token()), apikey: CFG.supabaseAnonKey }, body: JSON.stringify(body) }); }
    catch (e) { if (e && e.name === 'AbortError') throw e; if (e && e.code) throw e; throw { code: 'network', message: 'Geen verbinding.' }; }
    if (!res.ok) {
      var j = {}; try { j = await res.json(); } catch (e) { /* */ }
      throw { code: res.status === 429 ? 'limit' : 'upstream', message: j.message || 'De coach kon geen antwoord maken.', detail: res.status + (j.detail || j.message || j.error ? ': ' + (j.detail || j.message || j.error) : '') };
    }
    return res;
  }
  function toMessages(input) { return typeof input === 'string' ? [{ role: 'user', content: input }] : (input || []).map(function (m) { return { role: m.role, content: String(m.content) }; }); }
  async function sample(input, opts) {
    opts = opts || {}; var messages = toMessages(input);
    if (!opts.onText) { var r = await callAI({ messages: messages }, opts.signal); var j = await r.json(); return { text: j.text || '', truncated: false }; }
    var res = await callAI({ messages: messages, stream: true }, opts.signal), reader = res.body.getReader(), dec = new TextDecoder(), buf = '', acc = '';
    for (;;) {
      var chunk = await reader.read(); if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      var i;
      while ((i = buf.indexOf('\n')) >= 0) {
        var line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (line.indexOf('data:') !== 0) continue;
        var payload = line.slice(5).trim(); if (payload === '[DONE]') continue;
        try { var ev = JSON.parse(payload); if (ev.error) throw { code: 'upstream', message: 'De coach kon geen antwoord maken.' }; if (ev.t) { acc += ev.t; opts.onText({ text: acc }); } }
        catch (e) { if (e && e.code) throw e; }
      }
    }
    return { text: acc, truncated: false };
  }
  sample.json = async function (input, opts) { var r = await callAI({ messages: toMessages(input), json: true }, opts && opts.signal); var j = await r.json(); return j.json; };

  function downloads() {
    return { save: function (o) {
      var blob = new Blob([typeof o.data === 'string' ? o.data : JSON.stringify(o.data)], { type: o.mime || 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = o.filename || 'lumo.json'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return Promise.resolve();
    } };
  }

  function exposeRuntime() {
    var self = session.user.id;
    window.claude = { use: function (name) {
      return Promise.resolve(({
        db: { collection: collection },
        user: { id: function () { return Promise.resolve(self); }, canEdit: function () { return info.role === 'admin'; }, isAppAdmin: function () { return appAdmin; } },
        sample: sample,
        downloads: downloads()
      })[name] || null);
    } };
    window.__lumoWeb = {
      info: function () { return info; }, userId: function () { return self; }, email: function () { return session.user.email || ''; },
      refresh: async function () { var r = await sb.rpc('team_info'); if (!r.error && r.data) info = r.data; },
      regenerate: async function () { var r = await sb.rpc('regenerate_invite'); if (r.error) throw r.error; },
      setRole: async function (uid, role) { var r = await sb.rpc('set_member_role', { p_user: uid, p_role: role }); if (r.error) throw r.error; },
      removeMember: async function (uid) { var r = await sb.rpc('remove_member', { p_user: uid }); if (r.error) throw r.error; },
      inbox: {
        url: function () { return CFG.supabaseUrl + '/functions/v1/inbox'; },
        hasKey: async function () { var r = await sb.rpc('inbox_has_key'); return !r.error && r.data === true; },
        newKey: async function () {
          var bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
          var key = 'lk_' + Array.prototype.map.call(bytes, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
          var dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
          var hash = Array.prototype.map.call(new Uint8Array(dig), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
          var r = await sb.rpc('inbox_set_key', { p_hash: hash }); if (r.error) throw r.error; return key;
        },
        list: async function () { var r = await sb.from('report_inbox').select('id,filename,subject,created_at').order('created_at', { ascending: false }); if (r.error) throw r.error; return r.data || []; },
        get: async function (id) { var r = await sb.from('report_inbox').select('body').eq('id', id).maybeSingle(); if (r.error) throw r.error; return r.data ? r.data.body : ''; },
        remove: async function (id) { var r = await sb.from('report_inbox').delete().eq('id', id); if (r.error) throw r.error; }
      },
      push: (function () {
        function b64(k) { var p = '='.repeat((4 - k.length % 4) % 4), r = (k + p).replace(/-/g, '+').replace(/_/g, '/'), raw = atob(r), o = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) o[i] = raw.charCodeAt(i); return o; }
        var ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
        return {
          status: async function () {
            var ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!CFG.vapidPublicKey;
            if (!ok) return { supported: false, needsInstall: ios && !standalone };
            if (ios && !standalone) return { supported: false, needsInstall: true };
            var reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(), hour = 8;
            if (sub) { var r = await sb.from('push_subs').select('hour').eq('endpoint', sub.endpoint).maybeSingle(); if (r.data) hour = r.data.hour; else sub = null; }
            return { supported: true, permission: Notification.permission, on: !!sub, hour: hour };
          },
          enable: async function (hour) {
            var perm = await Notification.requestPermission(); if (perm !== 'granted') throw { message: 'Meldingen zijn geblokkeerd. Sta ze toe in de instellingen van je browser of telefoon.' };
            var reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
            if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(CFG.vapidPublicKey) });
            var j = sub.toJSON(), tz = 'Europe/Brussels'; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) { /* */ }
            var r = await sb.from('push_subs').upsert({ user_id: self, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, tz: tz, hour: hour || 8 }, { onConflict: 'endpoint' });
            if (r.error) throw r.error;
          },
          heal: async function () {
            var ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!CFG.vapidPublicKey;
            if (!ok || (ios && !standalone) || Notification.permission !== 'granted') return false;
            var reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
            if (sub) { var r = await sb.from('push_subs').select('endpoint').eq('endpoint', sub.endpoint).maybeSingle(); if (r.error || r.data) return false; try { await sub.unsubscribe(); } catch (e) { /* */ } }
            await this.enable(8); return true;
          },
          disable: async function () {
            var reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
            if (sub) { await sb.from('push_subs').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
          },
          setHour: async function (h) {
            var reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (!sub) return;
            var r = await sb.from('push_subs').update({ hour: h, last_sent: null }).eq('endpoint', sub.endpoint); if (r.error) throw r.error;
          },
          test: async function () {
            var res = await fetch(CFG.supabaseUrl + '/functions/v1/push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await token()), apikey: CFG.supabaseAnonKey }, body: JSON.stringify({ action: 'test' }) });
            if (!res.ok) throw { message: 'De meldingsfunctie reageert niet (' + res.status + '). Staat hij op Supabase?' };
            var j = await res.json(); if (!j.sent) throw { message: 'Geen toestel gevonden om naar te sturen.' };
          }
        };
      })(),
      signOut: signOut,
      deleteAccount: async function () { var r = await sb.rpc('delete_me'); if (r.error) throw r.error; try { await sb.auth.signOut(); } catch (e) { /* */ } try { localStorage.clear(); } catch (e) { /* */ } location.replace(location.pathname); }
    };
  }

  function loadApp() {
    var s = document.createElement('script'); s.src = 'app.js?v=' + (CFG.version || '1'); s.onerror = function () { screen('<h1>Lumo kon niet laden</h1><p>Controleer je verbinding en ververs de pagina.</p>'); };
    document.body.appendChild(s);
  }

  var started = false;
  function start() { if (started) return; started = true; exposeRuntime(); loadApp(); }

  async function next() {
    var s = await sb.auth.getSession(); session = s.data.session;
    if (!session) { showAuth(); return; }
    var r = await sb.rpc('team_info');
    if (r.error) { screen('<h1>Er ging iets mis</h1><p>' + esc(nlError(r.error)) + '</p><div class="row"><button class="btn" onclick="location.reload()">Opnieuw proberen</button></div>'); return; }
    if (!r.data) { showTeam(); return; }
    info = r.data; start();
  }

  async function boot() {
    if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || /JOUW-/.test(CFG.supabaseUrl + CFG.supabaseAnonKey)) { showSetup(); return; }
    if (!window.supabase) { screen('<h1>Lumo kon niet laden</h1><p>Controleer je verbinding en ververs de pagina.</p>'); return; }
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    inviteCode();
    sb.auth.onAuthStateChange(function (ev) {
      if (ev === 'PASSWORD_RECOVERY') showNewPassword();
      if (ev === 'SIGNED_OUT' && started) location.replace(location.pathname);
    });
    if (/type=recovery/.test(location.hash)) return;
    next();
  }
  window.__lumoBoot = boot;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
