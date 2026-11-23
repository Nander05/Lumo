/* ---------- web-versie: team, uitloggen en account (alleen in de eigen webapp) ---------- */
window.__web = true;
function webInfo() { return window.__lumoWeb ? window.__lumoWeb.info() : null; }
function webInviteLink(i) { return location.origin + location.pathname.replace(/index\.html$/, '') + '?code=' + (i.invite_code || ''); }
function webTeamCard() {
  const i = webInfo(); if (!i) return '';
  const admin = i.role === 'admin', me = window.__lumoWeb.userId();
  return '<section class="card" aria-labelledby="h-web"><h2 id="h-web">Team en account</h2><p>Team: <b>' + esc(i.team_name) + '</b> ' + pill(admin ? 'Beheerder' : 'Lid') + '</p><p class="small muted">Ingelogd als ' + esc(window.__lumoWeb.email()) + '</p>' +
    (admin ? '<h3>Leden uitnodigen</h3><p class="small muted">Stuur deze link. Wie hem opent, maakt een account en komt in je team.</p><div class="brief"><code style="word-break:break-all">' + esc(webInviteLink(i)) + '</code></div>' +
      '<div class="row"><button class="btn" data-act="web-copy-invite">Kopieer link</button><button class="btn ghost" data-act="web-new-code">Nieuwe code</button></div>' +
      '<h3>Leden (' + (i.members || []).length + ')</h3>' + (i.members || []).map(m => '<div class="row"><span><b>' + esc(m.name || 'Naamloos') + '</b> ' + pill(m.role === 'admin' ? 'Beheerder' : 'Lid') + '</span><span class="spacer"></span>' +
        (m.user_id === me ? '<span class="small muted">jij</span>' : '<button class="btn ghost small" data-act="web-role" data-id="' + esc(m.user_id) + '" data-r="' + (m.role === 'admin' ? 'member' : 'admin') + '">' + (m.role === 'admin' ? 'Maak lid' : 'Maak beheerder') + '</button><button class="btn ghost small" data-act="web-remove" data-id="' + esc(m.user_id) + '">Verwijder</button>') + '</div>').join('') : '') +
    '<div class="row"><button class="btn ghost" data-act="web-signout">Uitloggen</button><span class="spacer"></span><button class="btn danger" data-act="web-delete">Account verwijderen</button></div></section>' + webPushCard();
}

let webPushSt = null, webPushLoading = false;
/* meldingen herstellen: ontbreekt je toestel op de server (verlopen of verwijderd), meld je dan stil opnieuw aan */
let webPushHealAt = 0;
function webPushHeal() {
  const W = window.__lumoWeb; if (!W || !W.push || !W.push.heal || Date.now() - webPushHealAt < 600000) return;
  webPushHealAt = Date.now(); W.push.heal().then(h => { if (h) { webPushSt = null; toast('Meldingen opnieuw gekoppeld.'); } }).catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') webPushHeal(); });
setTimeout(webPushHeal, 4000);
function webPushLoad(force) {
  const W = window.__lumoWeb; if (!W || !W.push || webPushLoading || (webPushSt && !force)) return;
  webPushLoading = true;
  W.push.status().then(s => { webPushSt = s; }).catch(() => { webPushSt = { supported: false }; }).then(() => { webPushLoading = false; render(); });
}
function webPushCard() {
  webPushLoad();
  const st = webPushSt; let inner;
  if (!st) inner = '<p class="small muted">Even kijken…</p>';
  else if (!st.supported) inner = '<p class="small muted">' + (st.needsInstall ? 'Op een iPhone werken meldingen pas als Lumo op je beginscherm staat: tik op Delen en dan op "Zet op beginscherm", open Lumo van daaruit en kom hier terug.' : 'Meldingen worden op dit toestel of in deze browser niet ondersteund.') + '</p>';
  else if (!st.on) inner = '<p class="small muted">Krijg elke ochtend een melding met wie je moet opvolgen en wie er jarig is.</p>' + (st.permission === 'denied' ? '<p class="small" style="color:var(--danger)">Meldingen zijn geblokkeerd voor deze site. Sta ze toe in de instellingen van je browser of telefoon.</p>' : '') + '<div class="row"><button class="btn" data-act="web-push-on">Meldingen aanzetten</button></div>';
  else inner = '<p class="small muted">Meldingen staan aan op dit toestel.</p><label class="f" for="push-hour">Tijd van de ochtendmelding<select id="push-hour" data-change="web-push-hour">' + [6, 7, 8, 9, 10, 12, 18, 20].map(h => '<option value="' + h + '"' + (st.hour === h ? ' selected' : '') + '>' + (h < 10 ? '0' : '') + h + ':00</option>').join('') + '</select></label><div class="row"><button class="btn ghost" data-act="web-push-test">Stuur testmelding</button><button class="btn ghost" data-act="web-push-off">Uitzetten</button></div>';
  return '<section class="card" aria-labelledby="h-push"><h2 id="h-push">Meldingen</h2>' + inner + '</section>';
}

/* ---------- rapporten via e-mail (Gmail-scriptje) ---------- */
let webInboxList = null, webInboxHas = null, webInboxLoading = false, webInboxSig = '';
function webInboxLoad(force) {
  const W = window.__lumoWeb; if (!W || !W.inbox || webInboxLoading || (webInboxList && !force)) return;
  webInboxLoading = true;
  Promise.all([W.inbox.list().catch(() => []), W.inbox.hasKey().catch(() => false)]).then(([l, h]) => {
    const sig = JSON.stringify(l.map(x => x.id)) + h; webInboxList = l; webInboxHas = h; webInboxLoading = false;
    if (sig !== webInboxSig) { webInboxSig = sig; if (state.ready && !state.dialog) softRender(); }
  });
}
setInterval(() => { if (document.visibilityState === 'visible' && state.ready) webInboxLoad(true); }, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.ready) webInboxLoad(true); });
const webAgo = iso => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 2 ? 'zojuist' : m < 90 ? m + ' min geleden' : m < 2000 ? Math.round(m / 60) + ' uur geleden' : Math.round(m / 1440) + ' dagen geleden'; };
function webInboxRows() {
  return (webInboxList || []).map(x => '<div class="row"><span><b>' + esc(x.filename || 'Rapport') + '</b><br><span class="small muted">' + esc(webAgo(x.created_at)) + (x.subject ? ' · ' + esc(x.subject) : '') + '</span></span><span class="spacer"></span><button class="btn small" data-act="web-inbox-open" data-id="' + esc(x.id) + '" data-name="' + esc(x.filename || 'Rapport') + '">Importeer</button><button class="btn ghost small" data-act="web-inbox-del" data-id="' + esc(x.id) + '" aria-label="Verwijder dit rapport">×</button></div>').join('');
}
function webInboxBanner() {
  if (!window.__lumoWeb || !window.__lumoWeb.inbox) return ''; webInboxLoad();
  if (!webInboxList || !webInboxList.length) return '';
  return '<section class="card gold" aria-labelledby="h-ib"><h2 id="h-ib">' + (webInboxList.length === 1 ? 'Nieuw rapport klaar' : webInboxList.length + ' nieuwe rapporten klaar') + '</h2>' + webInboxRows() + '</section>';
}
function webInboxCard() {
  if (!window.__lumoWeb || !window.__lumoWeb.inbox) return ''; webInboxLoad();
  const has = webInboxHas;
  return '<section class="card" aria-labelledby="h-inb"><h2 id="h-inb">Rapporten via Gmail</h2><p class="small muted">Laat je Virtual Office-rapport (CSV) automatisch in Lumo aankomen. Je ziet het hier en op Vandaag, en kiest zelf in welke campagne het gaat. Dit werkt met Gmail.</p>' +
    (webInboxList && webInboxList.length ? webInboxRows() : '') +
    '<div class="row"><button class="btn' + (has ? ' ghost' : '') + '" data-act="web-inbox-setup">' + (has ? 'Nieuwe sleutel en script' : 'Koppel mijn Gmail') + '</button></div>' +
    (has ? '<p class="small muted">Er staat een sleutel klaar. Maak je een nieuwe, dan werkt het oude script niet meer.</p>' : '') + '</section>';
}
function webInboxScript(url, key) {
  return "// Lumo: stuurt Young Living-rapporten (CSV) uit je Gmail naar je eigen Lumo.\n// Je hoeft hier niets aan te passen. Voer eenmalig 'lumoInstall' uit.\n" +
    "const LUMO_URL = '" + url + "';\nconst LUMO_KEY = '" + key + "';\n// Pas de afzender aan als de rapporten van een ander adres komen:\nconst LUMO_ZOEK = 'from:youngliving (has:attachment OR subject:csv) newer_than:30d -label:Lumo-verwerkt';\n\n" +
    "function lumoInstall() {\n  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });\n  ScriptApp.newTrigger('lumoSync').timeBased().everyHours(1).create();\n  lumoSync();\n}\n\n" +
    "function lumoSync() {\n  var label = GmailApp.getUserLabelByName('Lumo-verwerkt') || GmailApp.createLabel('Lumo-verwerkt');\n  GmailApp.search(LUMO_ZOEK, 0, 20).forEach(function (thread) {\n    var ok = true;\n    thread.getMessages().forEach(function (msg) {\n      var sent = 0;\n      msg.getAttachments().forEach(function (att) {\n        if (!/\\.(csv|tsv|txt)$/i.test(att.getName()) || att.getSize() > 1000000) return;\n        var txt = att.getDataAsString('UTF-8');\n        if (txt.indexOf('\ufffd') >= 0) txt = att.getDataAsString('windows-1252');\n        var res = UrlFetchApp.fetch(LUMO_URL, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify({ key: LUMO_KEY, filename: att.getName(), subject: msg.getSubject(), csv: txt }) });\n        Logger.log('Bijlage verstuurd: ' + att.getName() + ' ' + res.getResponseCode());\n        sent++; if (res.getResponseCode() !== 200) ok = false;\n      });\n      if (sent) return;\n      var re = /<a\\s[^>]*href=[\"']([^\"']+)[\"'][^>]*>([\\s\\S]*?)<\\/a>/gi, m, html = msg.getBody();\n      while ((m = re.exec(html)) !== null) {\n        if (!/csv/i.test(m[2].replace(/<[^>]+>/g, ''))) continue;\n        var res2 = UrlFetchApp.fetch(LUMO_URL, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify({ key: LUMO_KEY, url: m[1].replace(/&amp;/g, '&'), subject: msg.getSubject() }) });\n        Logger.log('Link doorgegeven: ' + res2.getResponseCode() + ' ' + res2.getContentText().slice(0, 200));\n        if (res2.getResponseCode() !== 200) ok = false;\n      }\n    });\n    if (ok) thread.addLabel(label);\n  });\n}\n";
}
function webDialog(d) {
  if (d.type === 'inboxsetup') {
    if (!d.key) return '<h2>Gmail koppelen</h2><p class="muted">Sleutel maken…</p>';
    const sc = webInboxScript(window.__lumoWeb.inbox.url(), d.key);
    return '<h2>Gmail koppelen</h2><p class="small muted">Dit duurt ongeveer 10 minuten en je doet het één keer.</p>' +
      '<ol class="small" style="padding-left:18px;display:flex;flex-direction:column;gap:6px"><li>Tik op <b>Kopieer script</b>.</li><li>Ga naar <b>script.google.com</b> (ingelogd met je Gmail) en kies <b>Nieuw project</b>.</li><li>Wis de bestaande tekst, plak het script en tik op het diskette-icoon om op te slaan.</li><li>Kies bovenaan de functie <b>lumoInstall</b> en tik op <b>Uitvoeren</b>.</li><li>Google vraagt toestemming. Kies je account, dan <b>Geavanceerd</b>, dan <b>Ga naar (onveilig)</b>. Het script is van jezelf, dus dit is normaal.</li></ol>' +
      '<p class="small">Klaar. Elk uur kijkt het script of er een nieuwe CSV van Young Living is gekomen. De sleutel in dit script is alleen voor jou. Deel het script niet.</p>' +
      '<textarea id="ib-script" readonly style="min-height:120px;font-family:monospace;font-size:12px">' + esc(sc) + '</textarea>' +
      '<div class="row"><button class="btn" data-act="web-inbox-copy">Kopieer script</button><button class="btn ghost" data-act="overlay-close">Sluiten</button></div>';
  }
  if (d.type === 'inboximport') {
    const camps = campAll().filter(c => campKind(c) === 'line' && c.status !== 'ended');
    return '<h2>Rapport importeren</h2><p class="small muted">' + esc(d.name || '') + '</p><label class="f" for="ib-camp">Waar naartoe?<select id="ib-camp"><option value="__org">Mijn hele organisatie (Mensen > Teamleden)</option>' + camps.map(c => '<option value="' + esc(c.id) + '">Campagne: ' + esc(c.title) + '</option>').join('') + '</select></label>' +
      '<div class="row"><button class="btn" data-act="web-inbox-go" data-id="' + esc(d.id) + '">Verder</button><button class="btn ghost" data-act="overlay-close">Annuleer</button></div>';
  }
  return '';
}
async function webAct(a, d) {
  const W = window.__lumoWeb, i = webInfo(); if (!W) return false;
  const run = async (fn, okMsg) => { try { await fn(); await W.refresh(); render(); if (okMsg) toast(okMsg); } catch (e) { toast((e && e.message) || 'Dat lukte niet. Probeer het opnieuw.'); } };
  if (a === 'web-copy-invite') { if (i) copyText(webInviteLink(i)); return true; }
  if (a === 'web-new-code') { if (confirm('Nieuwe code maken? De oude uitnodigingslink werkt dan niet meer.')) await run(() => W.regenerate(), 'Nieuwe uitnodigingslink gemaakt.'); return true; }
  if (a === 'web-role') { await run(() => W.setRole(d.id, d.r), d.r === 'admin' ? 'Dit lid is nu beheerder.' : 'Dit lid is nu gewoon lid.'); return true; }
  if (a === 'web-remove') { if (confirm('Dit lid uit het team halen? De gegevens van dit lid in Lumo worden gewist.')) await run(() => W.removeMember(d.id), 'Lid verwijderd.'); return true; }
  if (a === 'web-push-on') { try { await W.push.enable(8); webPushSt = null; webPushLoad(true); toast('Meldingen staan aan.'); } catch (e) { toast((e && e.message) || 'Dat lukte niet.'); } return true; }
  if (a === 'web-push-off') { try { await W.push.disable(); webPushSt = null; webPushLoad(true); toast('Meldingen staan uit.'); } catch (e) { toast((e && e.message) || 'Dat lukte niet.'); } return true; }
  if (a === 'web-push-test') { try { await W.push.test(); toast('Testmelding verstuurd.'); } catch (e) { toast((e && e.message) || 'Dat lukte niet.'); } return true; }
  if (a === 'web-inbox-setup') {
    if (webInboxHas && !confirm('Nieuwe sleutel maken? Een eerder geplakt script stopt dan met werken.')) return true;
    state.dialog = { type: 'inboxsetup', key: '' }; render();
    try { const key = await W.inbox.newKey(); webInboxHas = true; if (state.dialog && state.dialog.type === 'inboxsetup') { state.dialog.key = key; render(); } } catch (e) { state.dialog = null; render(); toast('De sleutel maken lukte niet. Voer eerst inbox.sql uit in Supabase.'); }
    return true;
  }
  if (a === 'web-inbox-copy') { const el = $('#ib-script'); if (el) copyText(el.value); return true; }
  if (a === 'web-inbox-open') { state.dialog = { type: 'inboximport', id: d.id, name: d.name }; render(); return true; }
  if (a === 'web-inbox-del') { if (confirm('Dit rapport uit Lumo verwijderen?')) { try { await W.inbox.remove(d.id); } catch (e) { toast('Verwijderen lukte niet.'); } webInboxLoad(true); } return true; }
  if (a === 'web-inbox-go') {
    const campId = ($('#ib-camp') || {}).value; if (!campId) return true;
    try { const body = await W.inbox.get(d.id); if (!body) { toast('Dit rapport is niet meer beschikbaar.'); return true; }
      if (campId === '__org') { state.dialog = { type: 'orgpaste', prefill: body, inboxId: d.id }; render(); return true; }
      state.view = 'team'; state.sub.team = 'Campagnes'; state.camp.id = campId; state.camp.filter = 'Alles'; state.camp.q = ''; state.camp.limit = 30;
      state.dialog = { type: 'camppeople', id: campId, prefill: body, inboxId: d.id }; render(); window.scrollTo(0, 0);
    } catch (e) { toast('Het rapport kon niet worden geopend.'); }
    return true;
  }
  if (a === 'web-signout') { await W.signOut(); return true; }
  if (a === 'web-delete') { if (confirm('Je account en al je gegevens definitief verwijderen? Dit kan niet ongedaan worden gemaakt.')) { try { await W.deleteAccount(); } catch (e) { toast((e && e.message) || 'Dat lukte niet.'); } } return true; }
  return false;
}

/* ---------- waar je was blijft bewaard als de browser de pagina uit het geheugen haalt ---------- */
(function navKeep() {
  const K = 'lumo2:nav'; let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(K) || 'null'); } catch (e) { saved = null; }
  if (saved && Date.now() - (saved.t || 0) < 6 * 3600 * 1000) {
    if (saved.view) state.view = saved.view;
    if (saved.sub) Object.assign(state.sub, saved.sub);
    if (saved.camp) Object.assign(state.camp, saved.camp);
    if (saved.dlg && saved.dlg.type === 'campmsg' && saved.dlg.text) state.dialog = Object.assign({ busy: false }, saved.dlg);
    let tries = 0; const t = setInterval(() => { tries++; if (state.ready && $('#main')) { clearInterval(t); if (saved.y) window.scrollTo(0, saved.y); } else if (tries > 50) clearInterval(t); }, 200);
  } else saved = null;
  const keep = () => {
    if (!state.ready) return;
    const dlg = state.dialog && state.dialog.type === 'campmsg' ? { type: 'campmsg', id: state.dialog.id, camp: state.dialog.camp, name: state.dialog.name, text: state.dialog.text } : null;
    try { sessionStorage.setItem(K, JSON.stringify({ t: Date.now(), view: state.view, sub: state.sub, camp: { id: state.camp.id, view: state.camp.view, filter: state.camp.filter, month: state.camp.month }, dlg, y: window.scrollY })); } catch (e) { /* geen opslag */ }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') keep(); });
  window.addEventListener('pagehide', keep);
  setInterval(keep, 5000);
})();
