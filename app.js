'use strict';
/* ---------- helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayKey = () => keyOf(new Date());
const dayBack = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = o => JSON.parse(JSON.stringify(o));

function toast(msg) {
  const h = $('#toast-host'); h.innerHTML = '<div class="toast" role="status">' + esc(msg) + '</div>';
  clearTimeout(toast.t); toast.t = setTimeout(() => { h.innerHTML = ''; }, 3200);
}

function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const c = { ',': first.split(',').length, ';': first.split(';').length, '\t': first.split('\t').length };
  const delim = c[';'] > c[','] && c[';'] >= c['\t'] ? ';' : (c['\t'] > c[','] ? '\t' : ',');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}

function inline(s) { return s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
function md(t) {
  const lines = esc(t).split('\n'); let out = '', list = false;
  for (const l of lines) {
    const m = l.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (m) { if (!list) { out += '<ul>'; list = true; } out += '<li>' + inline(m[1]) + '</li>'; }
    else { if (list) { out += '</ul>'; list = false; } if (l.trim() !== '') out += '<p>' + inline(l) + '</p>'; }
  }
  if (list) out += '</ul>';
  return out;
}


const STAGES = ['Nieuw', 'Gesprek', 'Opvolging', 'Gestart', 'Later'];
const KINDS = ['Prospect', 'Klant', 'Teamlid'];
const TONES = { warm: 'Warm en persoonlijk', direct: 'Direct en kort', rustig: 'Rustig en geduldig' };
const LANGS = { nl: 'Nederlands', en: 'English', de: 'Deutsch', fr: 'Français' };
const CATS = ['Acties en promoties', 'Voorwaarden', 'Producten', 'Begrippen en lijsten', 'Overig'];
const SUGGEST = [
  { label: 'Nieuwe gesprekken', target: 3 }, { label: 'Opvolgingen', target: 5 },
  { label: 'Berichten naar teamleden', target: 3 }, { label: 'Moment voor mezelf', target: 1 }
];
const SHARED = ['library', 'glibrary', 'training', 'playbook', 'agenda', 'challenge', 'kudos', 'shares', 'help', 'board', 'mentors', 'campaigns', 'campshares'];
const libAll = () => sh('library').concat(sh('glibrary').map(i => Object.assign({}, i, { central: true })));
const LEADER_ONLY = ['shares', 'help', 'campshares'];
const SUBS = {
  mensen: ['Prospects', 'Klanten', 'Organisatie', 'Workshops'],
  groei: ['Trend', 'Content', 'Cijfers'],
  team: ['Bibliotheek', 'Campagnes', 'Training', 'Draaiboek', 'Agenda', 'Uitdaging', 'Mentor', 'Erkenning', 'Hulp', 'Overzicht']
};
const SVG = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
const ICON = {
  today: SVG('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>'),
  people: SVG('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3 3 0 010 5.6M18 14.4c1.8.8 3 2.6 3 5.6"/>'),
  coach: SVG('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
  growth: SVG('<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>'),
  team: SVG('<circle cx="12" cy="7" r="2.6"/><circle cx="5.5" cy="16" r="2.4"/><circle cx="18.5" cy="16" r="2.4"/><path d="M10 9.4L7 14M14 9.4l3 4.6M8 18.2h8"/>'),
  gear: SVG('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>')
};
const LOGO = '<svg width="32" height="32" viewBox="0 0 144 144" aria-hidden="true"><circle cx="72" cy="72" r="72" fill="currentColor"/><path d="M72 112 C44 94 38 58 72 30 C106 58 100 94 72 112 Z" fill="var(--bg)"/><path d="M72 108 L72 52" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/></svg>';
const fmtDate = (k, o) => new Date(k + 'T12:00').toLocaleDateString('nl-NL', o || { day: 'numeric', month: 'short' });
const addDays = (k, n) => { const d = new Date(k + 'T12:00'); d.setDate(d.getDate() + n); return keyOf(d); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- opslag: privé per lid + gedeelde collecties (db), anders lokaal ---------- */
const store = {
  mode: 'local', id: null, col: null, db: null, isAdmin: true, canDownload: false, dl: null, unsub: [], chain: {}, cols: {}, lw: {},
  async init() {
    const wt = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
    try {
      const cl = window.claude; if (!cl || !cl.use) throw new Error('geen runtime');
      const [db, user, dl] = await Promise.all([wt(cl.use('db'), 12000), wt(cl.use('user'), 12000), wt(cl.use('downloads'), 12000)]);
      if (!db || !user) throw new Error('niet beschikbaar');
      this.id = await user.id(); this.db = db; this.col = db.collection('data/users/' + this.id);
      this.isAdmin = typeof user.canEdit === 'function' ? !!user.canEdit() : false; this.isOwner = typeof user.isAppAdmin === 'function' ? !!user.isAppAdmin() : false;
      this.canDownload = !!dl; this.dl = dl; this.mode = 'cloud';
    } catch (e) { this.mode = 'local'; this.isAdmin = true; this.isOwner = true; this.id = 'lokaal'; }
  },
  coll(n) { return this.cols[n] || (this.cols[n] = this.db.collection(n)); },
  norm(s) {
    let arr = [];
    if (Array.isArray(s)) arr = s; else if (s && Array.isArray(s.docs)) arr = s.docs; else if (s && typeof s.forEach === 'function') s.forEach(d => arr.push(d));
    return arr.map(d => { const data = typeof d.data === 'function' ? d.data() : (d.data && typeof d.data === 'object' ? d.data : d); return Object.assign({}, data, { id: d.id != null ? d.id : data.id }); });
  },
  lget(k, def) { try { const v = localStorage.getItem('lumo2:' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  lset(k, v) { try { localStorage.setItem('lumo2:' + k, JSON.stringify(v)); } catch (e) { /* geen opslag */ } },
  watchMine(cb) {
    if (this.mode === 'cloud') {
      let got = false;
      const fb = () => { this.mode = 'local'; this.isAdmin = true; this.isOwner = true; cb(this.lget('mine', []), true); };
      const t = setTimeout(() => { if (!got) fb(); }, 10000);
      try { const u = this.col.onSnapshot(s => { got = true; clearTimeout(t); cb(this.norm(s)); }, () => { clearTimeout(t); fb(); }); if (typeof u === 'function') this.unsub.push(u); }
      catch (e) { clearTimeout(t); fb(); }
    } else cb(this.lget('mine', []));
  },
  watchShared(name, cb) {
    if (this.mode === 'cloud') {
      if (LEADER_ONLY.includes(name) && !this.isAdmin) { cb([]); return; }
      try { const u = this.coll(name).onSnapshot(s => cb(this.norm(s)), () => cb([])); if (typeof u === 'function') this.unsub.push(u); } catch (e) { cb([]); }
    } else { this.lw[name] = cb; cb(this.lget('s:' + name, [])); }
  },
  queue(key, fn) { const p = (this.chain[key] || Promise.resolve()).then(fn, fn); this.chain[key] = p.catch(() => {}); return p; },
  async setMine(id, data) {
    if (this.mode === 'cloud') return this.queue('m' + id, () => this.col.doc(id).set(data));
    this.lset('mine', this.lget('mine', []).filter(d => d.id !== id).concat([Object.assign({ id }, data)]));
  },
  async delMine(id) {
    if (this.mode === 'cloud') return this.queue('m' + id, () => this.col.doc(id).delete());
    this.lset('mine', this.lget('mine', []).filter(d => d.id !== id));
  },
  async setShared(name, id, data) {
    if (this.mode === 'cloud') return this.coll(name).doc(id).set(data);
    const all = this.lget('s:' + name, []).filter(d => d.id !== id).concat([Object.assign({ id }, data)]); this.lset('s:' + name, all); if (this.lw[name]) this.lw[name](all);
  },
  async delShared(name, id) {
    if (this.mode === 'cloud') return this.coll(name).doc(id).delete();
    const all = this.lget('s:' + name, []).filter(d => d.id !== id); this.lset('s:' + name, all); if (this.lw[name]) this.lw[name](all);
  }
};

/* ---------- state ---------- */
const state = {
  ready: false, view: 'vandaag', sub: { mensen: 'Prospects', groei: 'Trend', team: 'Bibliotheek' },
  docs: {}, shared: {}, libSearch: '', libCat: 'Alles',
  wiz: { step: 0, consent: false, name: '', goal: '', why: '', tone: 'warm', goals: clone(SUGGEST) },
  dialog: null, coach: { msgs: [], busy: false, ctrl: null, draft: '' }, brief: null,
  content: { type: 'Instagram-post', topic: '', out: '', busy: false }, check: { text: '', local: null, ai: null, busy: false },
  quiz: null, pending: false, editGoals: null, focusNext: false, sig: {}
};
SHARED.forEach(n => { state.shared[n] = []; });
const profile = () => state.docs.profile || null;
const prefs = () => state.docs.prefs || {};
const sh = n => state.shared[n] || [];
const meId = () => store.id || 'lokaal';
const needsWizard = () => !profile() || !profile().consentAt;
const byKind = k => Object.keys(state.docs).filter(i => i.startsWith('contact-')).map(i => Object.assign({ id: i }, state.docs[i]))
  .filter(c => (c.kind || 'Prospect') === k).sort((a, b) => (a.next || '9999').localeCompare(b.next || '9999') || (a.name || '').localeCompare(b.name || ''));
const allContacts = () => KINDS.reduce((a, k) => a.concat(byKind(k)), []);
const workshops = () => Object.keys(state.docs).filter(i => i.startsWith('event-')).map(i => Object.assign({ id: i }, state.docs[i])).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
const contentItems = () => Object.keys(state.docs).filter(i => i.startsWith('content-')).map(i => Object.assign({ id: i }, state.docs[i])).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
const dayDoc = key => state.docs['day-' + key] || { counts: {} };

function save(id, data) {
  state.docs[id] = data;
  const rec = pendMark(id, data);
  store.setMine(id, data).then(() => { rec.done = Date.now(); }, () => { rec.done = Date.now(); toast('Opslaan is mislukt. Probeer het opnieuw.'); });
}
/* eigen wijzigingen die nog onderweg zijn: een oudere ophaalronde mag ze niet terugdraaien */
const PEND = {};
function pendMark(id, data) { const rec = { data, del: data === null, done: 0, t: Date.now() }; PEND[id] = rec; return rec; }
function pendApply(docs) {
  const now = Date.now();
  Object.keys(PEND).forEach(id => { const r = PEND[id]; if ((r.done && now - r.done > 5000) || now - r.t > 60000) { delete PEND[id]; return; } if (r.del) delete docs[id]; else docs[id] = r.data; });
  return docs;
}
function remove(id) {
  delete state.docs[id];
  const rec = pendMark(id, null);
  store.delMine(id).then(() => { rec.done = Date.now(); }, () => { rec.done = Date.now(); toast('Verwijderen is mislukt. Probeer het opnieuw.'); });
}
function setPrefs(patch) { save('prefs', Object.assign({}, prefs(), patch)); }
async function putShared(name, id, data) {
  try { await store.setShared(name, id, data); } catch (e) { toast('Opslaan is mislukt. Voor dit onderdeel heb je bewerkrechten of deelnamerechten nodig.'); return false; }
  if (store.mode === 'cloud') { const l = sh(name).filter(x => x.id !== id); l.push(Object.assign({ id }, data)); state.shared[name] = l; }
  return true;
}
async function dropShared(name, id) {
  try { await store.delShared(name, id); } catch (e) { toast('Verwijderen is mislukt.'); return false; }
  if (store.mode === 'cloud') state.shared[name] = sh(name).filter(x => x.id !== id);
  return true;
}

/* ---------- berekeningen ---------- */
function dayRatio(key) {
  const goals = (profile() && profile().goals) || []; if (!goals.length) return 0;
  const c = dayDoc(key).counts || {}; let done = 0, tot = 0;
  goals.forEach(g => { done += Math.min(c[g.id] || 0, g.target); tot += g.target; });
  return tot ? done / tot : 0;
}
function dayActive(key) { const c = dayDoc(key).counts || {}; return Object.keys(c).some(k => c[k] > 0); }
function streak() { let n = 0, i = dayActive(keyOf(dayBack(0))) ? 0 : 1; while (i < 400 && dayActive(keyOf(dayBack(i)))) { n++; i++; } return n; }
function score7() { let s = 0; for (let i = 0; i < 7; i++) s += dayRatio(keyOf(dayBack(i))); return Math.round(s / 7 * 100); }
function lastActive() { for (let i = 0; i < 60; i++) if (dayActive(keyOf(dayBack(i)))) return keyOf(dayBack(i)); return ''; }
function nextBirthday(b) {
  if (!b) return null; const md = b.slice(-5), t = todayKey(), y = t.slice(0, 4);
  let k = y + '-' + md; if (k < t) k = (parseInt(y, 10) + 1) + '-' + md; return k;
}
function dueContacts() {
  const t = todayKey();
  return allContacts().filter(c => c.kind !== 'Klant' && c.next && c.next <= t && c.stage !== 'Gestart' && c.stage !== 'Later');
}
function customerDue(c) { return c.lastOrder && c.cycle ? addDays(c.lastOrder, parseInt(c.cycle, 10)) : ''; }
function quiet() {
  /* alleen mensen bij wie er iets te bieden valt: een geplande afspraak of een bestelmoment. Stilte alleen is geen reden. */
  const t = todayKey(), out = [];
  allContacts().forEach(c => {
    if (c.org) return;
    if (c.kind === 'Klant') { const d = customerDue(c); if (d && d <= addDays(t, 3)) out.push({ c, why: 'bestelmoment rond ' + fmtDate(d) + ': bied iets nuttigs aan, geen losse herinnering' }); }
    else if (c.next && daysBetween(c.next, t) >= 3) out.push({ c, why: 'er was een afspraak of opvolging gepland op ' + fmtDate(c.next) + ': plan een nieuw moment met iets concreets erbij' });
  });
  return out.slice(0, 6);
}
function upcoming(days) {
  const t = todayKey(), end = addDays(t, days), out = [];
  allContacts().forEach(c => {
    const b = nextBirthday(c.birthday); if (b && b <= end) out.push({ date: b, text: 'Verjaardag van ' + c.name });
    if (c.kind === 'Teamlid' && c.startDate) [7, 30, 90, 180, 365].forEach(n => { const d = addDays(c.startDate, n); if (d >= t && d <= end) out.push({ date: d, text: c.name + ' is ' + n + ' dagen onderweg' }); });
  });
  sh('agenda').forEach(e => { if (e.date >= t && e.date <= end) out.push({ date: e.date, text: 'Team: ' + e.title + (e.time ? ' om ' + e.time : '') }); });
  workshops().forEach(e => { if (e.date >= t && e.date <= end) out.push({ date: e.date, text: 'Workshop: ' + e.title }); });
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
}
function newLibCount() { const seen = prefs().lastSeenLib || ''; return libAll().filter(i => (i.updatedAt || '') > seen).length; }
function numOf(s) { const n = parseFloat(String(s || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; }
function conversion() {
  const p = byKind('Prospect'); if (p.length < 5) return null;
  return p.filter(c => c.stage === 'Gestart').length / p.length;
}
function badges() {
  const out = [], s = streak(), pr = prefs(), steps = sh('playbook').length, done = Object.keys(pr.done || {}).filter(k => (pr.done || {})[k]).length;
  const goalDays = Object.keys(state.docs).filter(k => k.startsWith('day-') && dayRatio(k.slice(4)) >= 1).length;
  if (goalDays >= 1) out.push(['Eerste dag volledig', 'Alle dagdoelen gehaald.']);
  if (s >= 7) out.push(['Zeven dagen op rij', 'Een week lang actief.']);
  if (s >= 30) out.push(['Dertig dagen op rij', 'Een maand lang actief.']);
  if (byKind('Teamlid').length >= 1) out.push(['Eerste teamlid', 'Je begeleidt iemand in je team.']);
  if (byKind('Klant').length >= 3) out.push(['Drie klanten', 'Je kent je klanten.']);
  if (Object.keys(pr.quiz || {}).some(k => pr.quiz[k].best === pr.quiz[k].of && pr.quiz[k].of > 0)) out.push(['Quiz foutloos', 'Alle antwoorden goed.']);
  if (steps && done >= steps) out.push(['Draaiboek afgerond', 'Alle stappen gezet.']);
  if (workshops().some(w => w.date && w.date < todayKey())) out.push(['Eerste workshop gegeven', 'Je hebt iemand bij elkaar gebracht.']);
  return out;
}

/* ---------- voorbeeldgegevens (fictief) ---------- */
function demoDocs() {
  const G = [{ id: 'g-gesprek', label: 'Nieuwe gesprekken', target: 3 }, { id: 'g-opvolg', label: 'Opvolgingen', target: 5 }, { id: 'g-team', label: 'Berichten naar teamleden', target: 3 }, { id: 'g-zelf', label: 'Moment voor mezelf', target: 1 }];
  const now = new Date().toISOString(), t = todayKey();
  const out = { profile: { name: 'Sanne', goal: 'Dit kwartaal vijf nieuwe teamleden begeleiden', why: 'Ik wil meer vrijheid in mijn dagen en mijn team laten groeien in hun eigen tempo.', tone: 'warm', lang: 'nl', voice: 'Hoi lieve mensen! Vandaag een rustige ochtend met thee en een lijstje. Kleine stapjes tellen ook. Wat is jouw ene ding voor vandaag?', goals: G, consentAt: now, createdAt: now, demo: true } };
  [[3, 5, 3, 1], [2, 4, 3, 1], [0, 0, 0, 0], [3, 5, 2, 1], [1, 3, 3, 0], [3, 6, 3, 1], [1, 2, 1, 0]].forEach((h, i) => {
    const k = keyOf(dayBack(6 - i)), counts = {}; if (h.some(x => x > 0)) { G.forEach((g, j) => { counts[g.id] = h[j]; }); out['day-' + k] = { date: k, counts }; }
  });
  const old = n => new Date(Date.now() - n * 86400000).toISOString();
  out['camp-demo-help5'] = { share: 'off', people: [], tasks: {}, entries: [['p1', 'Mila de Vries', 2], ['p3', 'Mila de Vries', 1], ['p2', 'Joost Bakker', 6]].map((x, i) => ({ id: 'demo-pt' + i, type: x[0], who: x[1], date: new Date(Date.now() - x[2] * 86400000).toISOString().slice(0, 10), pts: 1, note: '' })) };
  out['camp-demo-camp'] = { share: 'off', people: [['Mila de Vries', 's4', 60, 1], ['Joost Bakker', 's2', 0, 7], ['Fenna Jacobs', 's1', 0, 1], ['Sven Dijkstra', 's3', 20, 2], ['Anouk Peters', 's5', 80, 3]].map((x, i) => ({ id: 'demo-cp' + i, name: x[0], step: x[1], pv: x[2], note: '', contactId: '', updated: old(x[3]) })) };
  [['Mila de Vries', 'Prospect', 'Opvolging', -1, 'Kwam via een workshop. Wilde meer weten over een startpakket.', '', '', '', '', 12],
   ['Joost Bakker', 'Prospect', 'Gesprek', 0, 'Eerste gesprek gehad, stuurt zelf een berichtje terug.', '', '', '', '', 2],
   ['Fenna Jacobs', 'Prospect', 'Nieuw', 2, 'Vriendin van Mila. Nog niet gesproken.', '', '', '', '', 1],
   ['Rik Smit', 'Prospect', 'Opvolging', 1, 'Heeft de productlijst gelezen, twijfelt over timing.', '', '', '', '', 4],
   ['Lotte van Dijk', 'Prospect', 'Gesprek', 3, 'Nieuwsgierig naar de bibliotheek met acties.', '', '', '', '', 1],
   ['Eline Hoek', 'Prospect', 'Gestart', 0, 'Is vorige maand gestart na een workshop.', '', '', '', '', 8],
   ['Daan Peeters', 'Prospect', 'Later', 30, 'Zegt: na de zomer opnieuw contact.', '', '', '', '', 20],
   ['Amira El Idrissi', 'Teamlid', 'Gestart', 7, 'Net gestart. Welkomstgesprek is geweest.', '', '', '', addDays(t, -6), 3],
   ['Noor Visser', 'Teamlid', 'Gestart', 5, 'Start rustig, wil eerst de basis begrijpen.', '', '', '', addDays(t, -27), 16],
   ['Tess Kramer', 'Klant', 'Gestart', 0, 'Houdt van de zachte geuren. Vraagt vaak naar cadeautips.', addDays(t, -25), 28, addDays(t, 5).slice(5) === '' ? '' : '1990-' + addDays(t, 6).slice(5), '', 5],
   ['Bas de Wit', 'Klant', 'Gestart', 0, 'Bestelt trouw elke zes weken.', addDays(t, -10), 42, '', '', 2]
  ].forEach((c, i) => {
    out['contact-demo' + i] = { name: c[0], kind: c[1], stage: c[2], next: c[3] === 0 || c[3] > 5 && c[1] !== 'Prospect' ? '' : addDays(t, c[3]), note: c[4], lastOrder: c[5], cycle: c[6], birthday: c[7], startDate: c[8], updatedAt: old(c[9]) };
  });
  out['contact-demo1'].next = t; out['contact-demo6'].next = addDays(t, 1);
  out.figures = { name: 'voorbeeld-cijfers.csv', headers: ['Maand', 'Persoonlijk volume', 'Nieuwe leden', 'Actieve leden'], rows: [['Mei', '180', '1', '4'], ['Juni', '210', '0', '4'], ['Juli', '165', '2', '5'], ['Augustus', '240', '1', '6'], ['September', '260', '2', '8'], ['Oktober', '295', '1', '9']], importedAt: now };
  out.prefs = { rank: { name: 'Volgende stap', col: 1, target: 400, deadline: addDays(t, 60), newTarget: '5' }, done: { 'demo-p1': true, 'demo-p2': true }, quiz: {}, lastSeenLib: '2000-01-01', share: { on: false, sections: { score: true, streak: true, pipeline: true, playbook: true, active: true } }, board: false };
  out['event-demo0'] = { title: 'Rustige avond met oliën en thee', date: addDays(t, 6), place: 'Thuis bij Sanne', note: 'Kleine groep, informeel, geen verkooppraatje.', attendees: [{ name: 'Mila de Vries', status: 'Komt' }, { name: 'Fenna Jacobs', status: 'Uitgenodigd' }, { name: 'Lotte van Dijk', status: 'Komt' }] };
  out['event-demo1'] = { title: 'Kennismaking in het park', date: addDays(t, -9), place: 'Vondelpark', note: 'Eerste keer buiten.', attendees: [{ name: 'Rik Smit', status: 'Geweest' }, { name: 'Joost Bakker', status: 'Geweest' }] };
  [['Instagram-post', 'Mijn ochtendroutine in drie rustige stappen', 0, 'Idee'], ['Verhaal', 'Een kijkje achter de schermen van mijn werkdag', 1, 'Klaar'], ['Reel-script', 'Drie dingen die ik wou dat ik eerder wist als beginner', 3, 'Idee']].forEach((c, i) => {
    out['content-demo' + i] = { platform: c[0], idea: c[1], date: addDays(t, c[2]), status: c[3], text: '' };
  });
  return out;
}
function demoShared() {
  const now = new Date().toISOString(), t = todayKey();
  const L = [['Voorbeeld: welkomstactie', 'Acties en promoties', 'VOORBEELDTEKST, geen echte voorwaarden.\n\nNieuwe leden krijgen in hun eerste maand een welkomstgesprek en een persoonlijke startlijst. Vervang deze tekst door de officiële voorwaarden van de actie en zet erbij tot wanneer ze gelden.'],
    ['Voorbeeld: voorwaarden van een actie', 'Voorwaarden', 'VOORBEELDTEKST, geen echte voorwaarden.\n\nHier komen de volledige voorwaarden van een actie: wie meedoet, de looptijd, uitzonderingen en bij wie je terechtkunt met vragen.'],
    ['Voorbeeld: productlijst', 'Producten', 'VOORBEELDTEKST.\n\n- Product A: korte omschrijving\n- Product B: korte omschrijving\n- Product C: korte omschrijving\n\nZet hier alleen feitelijke omschrijvingen uit de officiële materialen.'],
    ['Voorbeeld: begrippenlijst', 'Begrippen en lijsten', 'VOORBEELDTEKST.\n\nUpline: de persoon boven jou in de structuur.\nOpvolging: een volgend contactmoment met iemand die interesse had.\nStartpakket: het pakket waarmee een nieuw lid begint.']];
  const d = { library: [], glibrary: [], training: [], playbook: [], agenda: [], challenge: [], kudos: [], shares: [], help: [], board: [], mentors: [], campaigns: [], campshares: [] };
  L.forEach((x, i) => d.library.push({ id: 'demo-lib' + i, title: x[0], category: x[1], text: x[2], updatedAt: now, note: i === 0 ? 'Voorbeeld van een wijzigingsnotitie: looptijd verlengd.' : '', prevText: i === 0 ? 'Eerdere versie: looptijd tot einde van de maand.' : '' }));
  d.training.push({ id: 'demo-tr0', title: 'Voorbeeld: eerste gesprek zonder druk', desc: 'Korte training over luisteren, vragen stellen en niets forceren.', url: '', category: 'Gesprekken', quiz: [{ q: 'Wat doe je als iemand "nee" zegt?', a: ['Bedank vriendelijk en laat de deur open', 'Probeer het nog twee keer', 'Stuur extra productinfo'], c: 0 }, { q: 'Wat is het doel van een eerste gesprek?', a: ['Kennismaken en luisteren', 'Zoveel mogelijk verkopen', 'Alle producten uitleggen'], c: 0 }] });
  [[1, 'Welkom en eerste afspraak', 'Plan een kennismaking met je upline en bekijk samen je doelen.'], [3, 'Je persoonlijke startlijst', 'Maak een lijst van vijf mensen met wie je als eerste wilt praten.'], [7, 'Eerste gesprek voeren', 'Gebruik het script uit de coach en oefen het eerst met een rollenspel.'], [14, 'Eerste opvolging', 'Neem contact op met iedereen die interesse toonde.'], [30, 'Terugblik op je eerste maand', 'Bespreek met je upline wat werkte en wat je anders wilt.']]
    .forEach((x, i) => d.playbook.push({ id: 'demo-p' + (i + 1), day: x[0], title: x[1], text: x[2] }));
  d.agenda.push({ id: 'demo-a1', title: 'Teamcall (voorbeeld)', date: addDays(t, 2), time: '20:00', place: 'Online', note: 'Korte update en vragen.' }, { id: 'demo-a2', title: 'Training nieuwe leden (voorbeeld)', date: addDays(t, 9), time: '19:30', place: 'Online', note: '' });
  d.challenge.push({ id: 'current', title: 'Zeven dagen, zeven opvolgingen', desc: 'Neem elke dag contact op met één persoon die je nog moest terugschrijven.', start: addDays(t, -2), end: addDays(t, 4), demo: true });
  d.mentors.push({ id: 'demo-m1', name: 'Eva (voorbeeld)', role: 'bied', text: 'Ik help graag met je eerste gesprekken.', contact: 'Stuur een bericht via de teamchat' }, { id: 'demo-m2', name: 'Kim (voorbeeld)', role: 'zoek', text: 'Ik zoek iemand om mee te sparren over opvolgen.', contact: 'Via de teamchat' });
  d.board.push({ id: 'demo-b1', name: 'Eva (voorbeeld)', score: 84, streak: 12, challenge: 3 }, { id: 'demo-b2', name: 'Kim (voorbeeld)', score: 61, streak: 4, challenge: 2 }, { id: 'demo-b3', name: 'Noor (voorbeeld)', score: 47, streak: 2, challenge: 1 });
  d.shares.push({ id: 'demo-s1', name: 'Eva (voorbeeld)', score7: 84, streak: 12, last: t, pipe: { Nieuw: 3, Gesprek: 2, Opvolging: 4, Gestart: 5, Later: 1 }, playbook: { done: 5, total: 5 }, updatedAt: now },
    { id: 'demo-s2', name: 'Kim (voorbeeld)', score7: 61, streak: 4, last: addDays(t, -1), pipe: { Nieuw: 1, Gesprek: 1, Opvolging: 2, Gestart: 1, Later: 0 }, playbook: { done: 3, total: 5 }, updatedAt: now },
    { id: 'demo-s3', name: 'Noor (voorbeeld)', score7: 20, streak: 0, last: addDays(t, -6), pipe: { Nieuw: 0, Gesprek: 1, Opvolging: 0, Gestart: 0, Later: 0 }, playbook: { done: 1, total: 5 }, updatedAt: now });
  const wbSteps = [{ id: 's1', label: 'Op de lijst', hint: 'Deze persoon kreeg de Welcome Back-mail.', msg: 'Hoi {naam}, leuk om je weer te zien in de buurt! Ik zag dat je een kleine verrassing kunt krijgen als je deze maand weer bestelt. Zin om even te kijken wat voor jou past?' }, { id: 's2', label: 'Bericht gestuurd', hint: 'Wacht op een reactie.', msg: 'Hoi {naam}, ik wilde even laten weten dat de Welcome Back-actie nog loopt tot het einde van de maand. Geen druk, ik help je graag als je vragen hebt.' }, { id: 's3', label: 'Reactie', hint: 'Ze reageerden. Bespreek wat past.', msg: 'Fijn dat je reageert, {naam}! Zullen we samen kijken wat je nodig hebt? Dan zet ik het voor je op een rijtje.' }, { id: 's4', label: 'Bestelling geplaatst', hint: 'Minstens 50 PV in november.', msg: 'Top, {naam}! Dank voor je bestelling. Laat gerust weten als je iets wilt weten over je producten.' }, { id: 's5', label: 'Cadeau ontvangen', hint: 'De gifts zijn automatisch toegevoegd.', msg: '' }];
  d.campaigns.push({ id: 'demo-camp', title: 'Welcome Back (voorbeeld)', status: 'active', summary: 'Brand Partners die een tijd niets bestelden, krijgen in november een cadeau bij een bestelling van minstens 50 PV.', start: addDays(t, -10), end: addDays(t, 14), rules: '- Alleen Brand Partners die de Welcome Back-mail ontvingen\n- Minstens 50 PV in \u00e9\u00e9n Loyalty- of One-Time bestelling in de actieperiode\n- De gifts worden automatisch aan de bestelling toegevoegd en je ontvangt ze \u00e9\u00e9n keer\n- Voorbeeldtekst: de echte voorwaarden staan in de bibliotheek', audience: 'Brand Partners die de Welcome Back-mail ontvingen', criteria: '- Laatste bestelling: minstens 4 en hoogstens 12 maanden geleden (kolom laatste bestelling)\n- Heeft de Welcome Back-mail ontvangen (kolom e-mail of status)', threshold: { pv: 50, label: 'PV' }, steps: wbSteps, libId: 'yl-welcome-back', updatedAt: now });
  d.campaigns.push({ id: 'demo-help5', kind: 'points', title: 'Help 5 (voorbeeld)', status: 'active', summary: 'Verzamel elke maand punten door anderen te helpen starten of terug te komen.', start: t.slice(0, 4) + '-01-01', end: t.slice(0, 4) + '-12-31', period: 'month', goal: 3, rules: '- Open voor actieve Brand Partners van 18+ die enroller zijn\n- Punten tellen per maand\n- Voorbeeldtekst: de echte voorwaarden staan in de bibliotheek', pointTypes: [{ id: 'p1', label: 'Enrol', hint: '1 nieuwe Brand Partner met minstens 100 PV', pts: 1 }, { id: 'p2', label: 'Reactiveer', hint: 'Een Brand Partner na 12+ maanden inactiviteit, bestelling van minstens 50 PV', pts: 1 }, { id: 'p3', label: 'Help starten met Loyalty', hint: 'Start Loyalty Rewards met een eerste bestelling', pts: 1 }], steps: [{ id: 's1', label: 'Uitnodigen', hint: 'Nodig iemand uit voor een gesprek', msg: 'Hoi {naam}, ik dacht aan je. Zou je het leuk vinden om samen te kijken wat Young Living voor jou kan betekenen?' }], updatedAt: now });
  d.campshares.push({ id: 'demo-cs1', name: 'Eva (voorbeeld)', camps: { 'demo-camp': { counts: { s1: 1, s2: 2, s3: 1, s4: 2, s5: 1 }, total: 7, names: [{ name: 'Lotte Smit', step: 's4' }, { name: 'Ruben Maas', step: 's2' }] } }, updatedAt: now },
    { id: 'demo-cs2', name: 'Kim (voorbeeld)', camps: { 'demo-camp': { counts: { s1: 2, s2: 1, s3: 0, s4: 0, s5: 0 }, total: 3 } }, updatedAt: now });
  d.help.push({ id: 'demo-h1', name: 'Noor (voorbeeld)', text: 'Ik weet niet goed hoe ik mijn eerste gesprek moet beginnen.', at: now });
  d.kudos.push({ id: 'demo-k1', to: 'demo-s1', toName: 'Eva (voorbeeld)', badge: 'Teamster', note: 'Je hielp drie nieuwe leden op weg.', at: now });
  return d;
}

/* ---------- AI ---------- */
async function getSample() { try { const cl = window.claude; return cl && cl.use ? await cl.use('sample') : null; } catch (e) { return null; } }
function aiErr(e) {
  const code = e && e.code;
  if (code === 'not_granted') return 'Je hebt de coach nog geen toestemming gegeven. Probeer opnieuw en kies toestaan.';
  if (code === 'limit' && e.message) return e.message;
  if (code === 'auth') return 'Je bent uitgelogd. Log opnieuw in.';
  if (e && e.detail) return 'De coach kon geen antwoord maken (' + e.detail + ').';
  if (code === 'rate_limited') return 'De coach heeft even rust nodig. Probeer het over een minuut opnieuw.';
  if (e && e.name === 'AbortError') return 'Gestopt.';
  return 'De coach kon geen antwoord maken. Probeer het opnieuw.';
}
function langNote() { const l = (profile() && profile().lang) || 'nl'; return l === 'nl' ? 'Antwoord in het Nederlands.' : 'Write the answer in ' + LANGS[l] + ' (the member chose this language).'; }
function rulesText() {
  const p = profile();
  return ['Je bent de coach in Lumo, een onafhankelijke app voor wellness-ondernemers. Je bent niet van Young Living en spreekt niet namens Young Living.',
    langNote() + ' Kort en concreet, met één duidelijke volgende stap. Korte alinea\'s of een lijstje van maximaal vijf punten.',
    'Toon: ' + (TONES[p.tone] || TONES.warm) + '.',
    'VANGRAILS: Doe geen inkomstenbeloften en geen uitspraken over wat iemand kan verdienen. Doe geen gezondheidsclaims: geen genezing, behandeling, diagnose of preventie, en geen medisch advies; verwijs bij gezondheidsvragen naar een arts of therapeut. Geen druk, geen misleiding, geen verzonnen getuigenissen.',
    'Leg promoties, voorwaarden en producten alleen uit op basis van de BIBLIOTHEEK hieronder. Staat het er niet in, zeg dat eerlijk en verwijs naar de officiële bron of de upline. Verzin geen regels, bedragen of data.',
    'OPVOLGING = WAARDE (harde regel): Stel nooit een opvolging of bericht voor zonder concrete reden. Elk opvolgbericht moet nieuwe, nuttige informatie voor precies deze persoon bevatten (bijvoorbeeld een antwoord op haar vraag, iets uit de bibliotheek dat past bij haar situatie, of een update over iets wat ze eerder aanhaalde) of een nieuwe afspraak voorstellen met een concreet moment. Schrijf geen check-ins zoals "even horen hoe het gaat", "ik dacht aan je" of "laat maar weten", want die vragen iets zonder iets te geven. Een dag of week stilte is op zich geen reden. Is er geen waarde of afspraak om aan te bieden, zeg dan eerlijk dat er nu niets te sturen valt, en stel voor eerst iets nuttigs te zoeken of een afspraak voor te bereiden. Noem in elk concept kort welke waarde of afspraak erin zit.',
    'Gebruik alleen de gegevens van dit lid. Berichten die je schrijft zijn concepten die het lid zelf verstuurt: respectvol, zonder druk, en accepteer een nee.'
  ].join('\n- ');
}
function buildContext() {
  const p = profile(), key = todayKey(), counts = dayDoc(key).counts || {};
  const goals = p.goals.map(g => g.label + ': ' + (counts[g.id] || 0) + ' van ' + g.target).join('; ');
  const cl = allContacts().slice(0, 50).map(c => '- ' + c.name + ' | ' + (c.kind || 'Prospect') + ' | fase ' + c.stage + (c.next ? ' | volgend contact ' + c.next : '') + (c.kind === 'Klant' && customerDue(c) ? ' | volgende bestelling rond ' + customerDue(c) : '') + (c.note ? ' | ' + c.note.slice(0, 160) : '')).join('\n') || '(geen contacten)';
  const f = state.docs.figures; let fig = '(geen cijfers geïmporteerd)';
  if (f) fig = (f.headers.join(' | ') + '\n' + f.rows.slice(0, 30).map(r => r.join(' | ')).join('\n')).slice(0, 3000);
  const up = upcoming(10).map(u => '- ' + u.date + ': ' + u.text).join('\n') || '(niets gepland)';
  let lib = '', budget = 12000;
  for (const i of libAll()) { const t = '## ' + i.title + ' (' + i.category + ')\n' + i.text + '\n\n'; if (t.length > budget) { lib += t.slice(0, budget); break; } lib += t; budget -= t.length; }
  return 'INSTRUCTIES\n- ' + rulesText() + '\n\nVANDAAG: ' + new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
    '\n\nLID\nNaam: ' + p.name + '\nDoel: ' + (p.goal || '-') + '\nWaarom: ' + (p.why || '-') + '\nDagdoelen vandaag: ' + goals + '\nReeks: ' + streak() + ' dagen; score laatste 7 dagen: ' + score7() + '%' +
    (p.voice ? '\nSchrijfstijl van het lid (voorbeeld): ' + p.voice.slice(0, 700) : '') +
    '\n\nMENSEN\n' + cl + '\n\nBINNENKORT\n' + up + '\n\nCIJFERS\n' + fig + '\n\nBIBLIOTHEEK\n' + (lib || '(leeg)');
}
async function aiStream(prompt, history, onText, signal) {
  const sample = await getSample(); if (!sample) throw { code: 'none' };
  const hist = (history || []).map(m => ({ role: m.role, content: m.text }));
  if (hist.length) hist[0] = { role: 'user', content: buildContext() + '\n\n---\nBericht van het lid:\n' + hist[0].content };
  else hist.push({ role: 'user', content: buildContext() + '\n\n---\nVerzoek van het lid:\n' + prompt });
  const res = await sample(hist, { signal, cache: false, modelTier: 'default', onText: ({ text }) => onText(text) });
  return res && res.text;
}
async function aiJSON(prompt) {
  const sample = await getSample(); if (!sample) throw { code: 'none' };
  const full = buildContext() + '\n\n---\n' + prompt;
  if (typeof sample.json === 'function') { try { return await sample.json(full, { cache: false }); } catch (e) { if (e && e.code) throw e; } }
  const r = await sample(full, { cache: false }); const m = (r.text || '').match(/[\[{][\s\S]*[\]}]/); return JSON.parse(m[0]);
}

/* ---------- gedeelde stukjes ---------- */
function subTabs(view) {
  let list = SUBS[view].filter(s => (s !== 'Overzicht' || store.isAdmin) && (s !== 'Trend' || allContacts().some(c => c.yl)));
  return '<div class="seg" role="group" aria-label="Onderdeel">' + list.map(s => '<button class="chip" data-act="sub" data-view="' + view + '" data-sub="' + s + '" aria-pressed="' + (state.sub[view] === s) + '">' + s + (view === 'team' && s === 'Bibliotheek' && newLibCount() ? ' <span class="dot" aria-label="nieuw"></span>' : '') + '</button>').join('') + '</div>';
}
function pill(t, cls) { return '<span class="pill' + (cls ? ' ' + cls : '') + '">' + esc(t) + '</span>'; }
const coachBtn = (label, prompt, cls) => '<button class="btn ' + (cls || 'ghost') + ' small" data-act="coach-chip" data-prompt="' + esc(prompt) + '">' + label + '</button>';

/* ---------- Vandaag ---------- */
function viewVandaag() {
  const p = profile(), key = todayKey(), counts = dayDoc(key).counts || {};
  const due = dueContacts(), q = quiet(), up = upcoming(10), nl = newLibCount();
  const goals = p.goals.map(g => {
    const n = counts[g.id] || 0, pct = Math.min(100, Math.round(n / g.target * 100));
    return '<div class="goal"><div class="head"><span class="name">' + esc(g.label) + '</span>' +
      '<button class="icon-btn" data-act="dec" data-id="' + g.id + '" aria-label="Eén minder: ' + esc(g.label) + '">−</button>' +
      '<span class="count" aria-label="' + n + ' van ' + g.target + '">' + n + ' / ' + g.target + '</span>' +
      '<button class="icon-btn" data-act="inc" data-id="' + g.id + '" aria-label="Eén erbij: ' + esc(g.label) + '">+</button></div>' +
      '<div class="bar' + (n >= g.target ? ' full' : '') + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div></div>';
  }).join('');
  const days = [6, 5, 4, 3, 2, 1, 0].map(i => {
    const d = dayBack(i), r = dayRatio(keyOf(d)), h = Math.max(4, Math.round(r * 72));
    return '<div class="col"><div class="b' + (r > 0 ? ' on' : '') + (i === 0 ? ' today' : '') + '" style="height:' + h + 'px" role="img" aria-label="' + d.toLocaleDateString('nl-NL', { weekday: 'long' }) + ' ' + Math.round(r * 100) + ' procent"></div><span>' + d.toLocaleDateString('nl-NL', { weekday: 'short' }).slice(0, 2) + '</span></div>';
  }).join('');
  const row = (name, tag, id) => '<div class="row"><b>' + esc(name) + '</b>' + tag + '<span class="spacer"></span><button class="btn ghost small" data-act="contact-edit" data-id="' + id + '">Open</button></div>';
  const assist = '<section class="card" aria-labelledby="h-ass"><h2 id="h-ass">Mijn assistent</h2><div class="row"><button class="btn" data-act="brief-run"' + (state.brief && state.brief.busy ? ' disabled' : '') + '>Ochtendbriefing</button>' +
    coachBtn('Weekreview', 'Maak een weekreview: wat ging goed, wat bleef liggen, en een plan voor volgende week met maximaal drie prioriteiten. Gebruik mijn dagcijfers en pipeline.') + '</div>' +
    (state.brief ? '<div class="brief" id="brief" aria-live="polite">' + (state.brief.text ? md(state.brief.text) : '<p class="muted">De briefing wordt gemaakt…</p>') + '</div>' : '') + '</section>';
  return '<div><p class="eyebrow">' + esc(longDate()) + '</p><h1>' + greeting() + ', ' + esc(p.name) + '</h1></div>' + mgHtml() + nuDoenHtml() +
    '<section class="card" aria-labelledby="h-dag"><h2 id="h-dag">Dagdoelen</h2>' + goals + '</section>' + (typeof webInboxBanner === 'function' ? webInboxBanner() : '') + campToday() +
    '<section class="card" aria-labelledby="h-up"><h2 id="h-up">Binnenkort</h2>' + (up.length ? up.map(u => '<div class="row"><span class="pill">' + esc(fmtDate(u.date)) + '</span><span>' + esc(u.text) + '</span></div>').join('') : '<p class="muted">De komende tien dagen staat er niets gepland.</p>') + '</section>' +
    '<div class="grid2"><section class="card soft" aria-labelledby="h-streak"><h2 id="h-streak" class="eyebrow">Reeks</h2><div class="big">' + streak() + '</div><p class="small">dagen achter elkaar actief</p></section>' +
    '<section class="card" aria-labelledby="h-week"><h2 id="h-week" class="eyebrow">Afgelopen 7 dagen</h2><div class="week">' + days + '</div></section></div>' + assist + voFeedHtml() +
    (nl ? '<section class="card gold"><h2>Nieuw in de bibliotheek</h2><p>' + nl + ' tekst' + (nl > 1 ? 'en zijn' : ' is') + ' nieuw of bijgewerkt sinds je laatste bezoek.</p><div><button class="btn ghost small" data-act="goto" data-view="team" data-sub="Bibliotheek">Bekijk</button></div></section>' : '');
}

/* ---------- Mensen ---------- */
function stageSelect(c) {
  return '<label class="sr" for="sel-' + c.id + '">Fase van ' + esc(c.name) + '</label><select id="sel-' + c.id + '" data-change="stage" data-id="' + c.id + '" style="width:auto;min-height:36px;padding:4px 10px">' + STAGES.map(x => '<option' + (x === c.stage ? ' selected' : '') + '>' + x + '</option>').join('') + '</select>';
}
function contactCard(c) {
  const t = todayKey(), k = c.kind || 'Prospect'; let meta = '', acts = '';
  if (k === 'Prospect') { meta = c.next ? pill(fmtDate(c.next), c.next <= t && c.stage !== 'Gestart' ? 'due' : '') : ''; acts = stageSelect(c); }
  if (k === 'Klant') {
    const d = customerDue(c); meta = d ? pill('Volgende bestelling ' + fmtDate(d), d <= addDays(t, 3) ? 'due' : '') : '';
    acts = coachBtn('Cadeau- of productidee', 'Geef drie cadeau- of productideeën voor ' + c.name + ', alleen op basis van de bibliotheek en mijn notitie: ' + (c.note || 'geen notitie') + '. Geen gezondheidsclaims.');
  }
  if (k === 'Teamlid') {
    const day = c.startDate ? daysBetween(c.startDate, t) : null; meta = day != null ? pill('Dag ' + day) : '';
    acts = coachBtn('Bericht met waarde', 'Schrijf een kort bericht voor teamlid ' + c.name + (day != null ? ' (dag ' + day + ' sinds de start)' : '') + '. ' + (c.note || '') + ' Het bericht moet iets nuttigs bevatten voor haar huidige stap (een tip, uitleg of bron uit de bibliotheek) of een nieuwe afspraak voorstellen. Geen check-in. Weet je niet wat ze nu nodig heeft, vraag me dat eerst. Geef één concept en zeg welke waarde erin zit.');
  }
  return '<div class="contact"><div class="row"><span class="nm">' + esc(c.name) + '</span><span class="spacer"></span>' + meta + '</div>' +
    (c.note ? '<p class="small muted">' + esc(c.note.length > 120 ? c.note.slice(0, 120) + '…' : c.note) + '</p>' : '') +
    (c.birthday && nextBirthday(c.birthday) <= addDays(t, 14) ? '<p class="small">Verjaardag ' + esc(fmtDate(nextBirthday(c.birthday))) + '</p>' : '') +
    '<div class="row">' + acts + '<span class="spacer"></span><button class="btn ghost small" data-act="contact-edit" data-id="' + c.id + '">Bewerk</button></div></div>';
}
function viewMensen() {
  let sub = state.sub.mensen; if (!SUBS.mensen.includes(sub)) sub = state.sub.mensen = ({ Pipeline: 'Prospects', Teamleden: 'Organisatie', Netwerk: 'Organisatie' })[sub] || 'Prospects';
  let body = '';
  if (sub === 'Prospects') {
    const all = byKind('Prospect');
    body = '<div class="board">' + STAGES.map(s => { const l = all.filter(c => (STAGES.includes(c.stage) ? c.stage : 'Nieuw') === s); return '<section class="stage" aria-labelledby="st-' + s + '"><h3 id="st-' + s + '">' + s + ' ' + pill(l.length) + '</h3>' + (l.map(contactCard).join('') || '<p class="small muted">Leeg</p>') + '</section>'; }).join('') + '</div>';
  } else if (sub === 'Klanten') {
    body = orgPageHtml('Klant');
  } else if (sub === 'Organisatie') {
    body = orgNetHtml();
  } else {
    const ws = workshops();
    body = '<div class="row"><span class="spacer"></span><button class="btn" data-act="event-new">Nieuwe workshop</button></div>' + (ws.map(w => {
      const att = (w.attendees || []).map((a, i) => '<div class="row"><span>' + esc(a.name) + '</span><span class="spacer"></span><label class="sr" for="at' + w.id + i + '">Status van ' + esc(a.name) + '</label><select id="at' + w.id + i + '" data-change="att-status" data-id="' + w.id + '" data-i="' + i + '" style="width:auto;min-height:36px;padding:4px 10px">' +
        ['Uitgenodigd', 'Komt', 'Geweest', 'Opgevolgd', 'Kon niet'].map(s => '<option' + (s === a.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>' +
        (allContacts().some(c => c.name === a.name) ? '' : '<button class="btn ghost small" data-act="att-contact" data-id="' + w.id + '" data-i="' + i + '">Naar pipeline</button>') + '</div>').join('');
      return '<section class="card"><div class="row"><h3>' + esc(w.title) + '</h3><span class="spacer"></span>' + pill(w.date ? fmtDate(w.date) : 'zonder datum', w.date && w.date >= todayKey() ? 'due' : '') + '</div>' +
        '<p class="small muted">' + esc(w.place || '') + (w.note ? ' · ' + esc(w.note) : '') + '</p>' + (att || '<p class="small muted">Nog geen gasten.</p>') +
        '<div class="row">' + coachBtn('Uitnodiging schrijven', 'Schrijf een warme uitnodiging voor mijn workshop "' + w.title + '" op ' + w.date + (w.place ? ' bij ' + w.place : '') + '. ' + (w.note || '') + ' Geen druk, geen claims.') +
        coachBtn('Opvolging na afloop', 'Schrijf een kort opvolgbericht voor gasten van mijn workshop "' + w.title + '" (' + (w.attendees || []).filter(a => a.status === 'Geweest').map(a => a.name).join(', ') + '). Maak één algemeen concept en één persoonlijke variant.') +
        '<span class="spacer"></span><button class="btn ghost small" data-act="event-edit" data-id="' + w.id + '">Bewerk</button></div></section>';
    }).join('') || '<div class="card soft"><p>Nog geen workshops. Plan er een en nodig je gasten uit.</p></div>');
  }
  return '<div class="row"><h1>Mensen</h1><span class="spacer"></span><button class="btn small" data-act="contact-new">+ Nieuw</button></div>' + subTabs('mensen') + body + '<p class="small muted" style="margin-top:18px">Alleen jij ziet deze lijsten. Bewaar alleen wat je nodig hebt: het zijn gegevens van anderen.</p>';
}

/* ---------- Coach ---------- */
function viewCoach() {
  coachPull();
  const c = state.coach, cl = allContacts();
  const msgs = c.msgs.map((m, i) => '<div class="msg ' + m.role + '">' + (m.role === 'assistant' ? md(m.text || '…') + (m.text && !c.busy ? '<div class="tools"><button class="btn ghost small" data-act="copy" data-i="' + i + '">Kopieer</button><button class="btn ghost small" data-act="to-check" data-i="' + i + '">Controleer</button></div>' : '') : esc(m.text).replace(/\n/g, '<br>')) + '</div>').join('');
  const chips = [['Dagplan', 'Maak een dagplan voor vandaag. Maximaal drie acties.'], ['Weekplan', 'Maak een weekplan met maximaal drie prioriteiten en per dag één concrete actie.'], ['Check-in', 'Doe een korte avondcheck-in met me: wat ging goed en wat is morgen de eerste stap?'], ['Promotie uitleggen', 'Leg de huidige promoties kort en eerlijk uit, alleen op basis van de bibliotheek.'], ['Gesprek voorbereiden', 'Help me een eerste gesprek voorbereiden met iemand die nieuwsgierig is naar wellness.']];
  const roles = [['Iemand die twijfelt', 'iemand die twijfelt of het iets voor haar is'], ['Een kritische vriend', 'een vriend die sceptisch is over netwerkmarketing'], ['Iemand zonder tijd', 'iemand die zegt dat ze geen tijd heeft']];
  const scripts = [['Eerste uitnodiging', 'een eerste uitnodiging voor een kennismakingsgesprek'], ['Opvolging na workshop', 'een opvolging na een workshop met iets nuttigs voor elke gast (materiaal, antwoord op een vraag) en een voorstel voor een nieuw moment'], ['Herbestelling', 'een bericht aan een klant rond een nieuw bestelmoment, met iets nuttigs erin (tip, info over haar product) in plaats van een losse herinnering'], ['Welkom nieuw teamlid', 'een welkomstbericht voor een nieuw teamlid'], ['Iemand zegt nee', 'een reactie als iemand nee zegt, zodat de deur open blijft']];
  const sel = (id, label, opts) => '<label class="f" for="' + id + '">' + label + '<select id="' + id + '" data-change="' + id + '"><option value="">Kies…</option>' + opts + '</select></label>';
  const sug = typeof nuDoen === 'function' ? nuDoen().slice(0, 3) : [];
  const intro = '<div class="card soft"><h2>Wat zal ik voor je doen?</h2>' +
    (sug.length ? '<div class="orgl">' + sug.map(x => '<button class="btn ghost" style="justify-content:flex-start;text-align:left" data-act="org-now" data-id="' + x.c.id + '" data-k="' + x.k + '" data-why="' + esc(x.why) + '"><span><b>' + esc(x.c.name) + '</b><br><span class="small muted">' + esc(x.why) + '</span></span></button>').join('') + '</div>' : '') +
    '<div class="row">' + chips.map(x => '<button class="chip" data-act="coach-chip" data-prompt="' + esc(x[1]) + '">' + x[0] + '</button>').join('') + '</div></div>';
  const meer = c.more ? '<div class="card"><h2>Meer</h2><div class="grid2">' + sel('role', 'Rollenspel: oefen met…', roles.map((r, i) => '<option value="' + i + '">' + r[0] + '</option>').join('')) +
    sel('script', 'Script voor…', scripts.map((r, i) => '<option value="' + i + '">' + r[0] + '</option>').join('')) +
    (cl.length ? sel('follow', 'Bericht voor…', cl.map(x => '<option value="' + x.id + '">' + esc(x.name) + ' (' + esc(x.kind || 'Prospect') + ')</option>').join('')) : '') + '</div></div>' +
    '<div class="card">' + checkBodyHtml() + '</div>' : '';
  window.__roles = roles; window.__scripts = scripts;
  return '<div class="row"><h1>Coach</h1><span class="spacer"></span><button class="btn ghost small" data-act="coach-more" aria-expanded="' + !!c.more + '">' + (c.more ? 'Minder' : 'Meer') + '</button></div>' + meer + '<div class="chat" aria-live="polite" id="chat">' + (c.msgs.length ? msgs : intro) + '</div>' +
    '<div class="composer"><label class="sr" for="coachInput">Bericht aan de coach</label><textarea id="coachInput" rows="1" placeholder="Schrijf je vraag…">' + esc(c.draft) + '</textarea>' +
    (c.busy ? '<button class="btn danger" data-act="coach-stop">Stop</button>' : '<button class="btn" data-act="coach-send">Stuur</button>') + '</div>' +
    (c.msgs.length ? '<div class="row"><button class="btn ghost small" data-act="coach-reset">Nieuw gesprek</button></div>' : '');
}

function checkBodyHtml() {
    const k = state.check;
    const flags = k.local;
    return '<section class="card" aria-labelledby="h-chk"><h2 id="h-chk">Compliance-check</h2><p class="small muted">Plak een tekst of social post. De check wijst op inkomensbeloften en gezondheidsclaims en stelt een veilige versie voor. Het blijft een hulpmiddel: lees de regels van Young Living zelf ook.</p>' +
      areaField('chk-text', 'Tekst', k.text, '', true) + '<div class="row"><button class="btn" data-act="check-run"' + (k.busy ? ' disabled' : '') + '>Controleer</button></div>' +
      (flags ? '<div><h3>Snelle scan</h3>' + (flags.length ? '<div class="row" style="margin-top:8px">' + flags.map(f => pill(f.type + ': ' + f.term, 'due')).join('') + '</div>' : '<p class="small">Geen opvallende woorden gevonden.</p>') + '</div>' : '') +
      (k.busy ? '<p class="muted">De coach leest mee…</p>' : '') +
      (k.ai ? '<div><h3>Beoordeling</h3><div class="row" style="margin:8px 0">' + pill(k.ai.verdict || '?', k.ai.verdict === 'ok' ? '' : 'due') + '</div>' +
        (k.ai.issues || []).map(i => '<div class="contact"><p><i>"' + esc(i.quote) + '"</i></p><p class="small">' + esc(i.why) + '</p><p class="small"><b>Veiliger:</b> ' + esc(i.fix) + '</p></div>').join('') +
        (k.ai.rewrite ? '<h3 style="margin-top:12px">Voorgestelde versie</h3><div class="brief" style="white-space:pre-wrap">' + esc(k.ai.rewrite) + '</div><div class="row"><button class="btn ghost small" data-act="check-copy">Kopieer</button></div>' : '') + '</div>' : '') + '</section>';
}
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond'; }
function longDate() { return new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }); }
const field = (id, label, val, extra) => '<label class="f" for="' + id + '">' + label + '<input type="text" id="' + id + '" value="' + esc(val || '') + '" ' + (extra || '') + '></label>';
const dateField = (id, label, val) => '<label class="f" for="' + id + '">' + label + '<input type="date" id="' + id + '" value="' + esc(val || '') + '"></label>';
const areaField = (id, label, val, hint, tall) => '<label class="f" for="' + id + '">' + label + (hint ? '<span class="hint">' + hint + '</span>' : '') + '<textarea id="' + id + '"' + (tall ? ' style="min-height:200px"' : '') + '>' + esc(val || '') + '</textarea></label>';
const optList = (arr, sel) => arr.map(x => '<option' + (x === sel ? ' selected' : '') + '>' + esc(x) + '</option>').join('');

/* ---------- Groei ---------- */
const CT_TYPES = ['Instagram-post', 'Verhaal', 'Reel-script', 'WhatsApp-status', 'Blog-intro'];
function viewGroei() {
  const hasVo = allContacts().some(c => c.yl); if (hasVo) state.sub.groei = 'Trend'; else if (state.sub.groei === 'Controle' || state.sub.groei === 'Trend') state.sub.groei = 'Content';
  const sub = state.sub.groei; let body = '';
  if (sub === 'Trend') {
    body = groeiOverzichtHtml();
  } else if (sub === 'Content') {
    const c = state.content, items = contentItems(), p = profile();
    body = '<section class="card" aria-labelledby="h-ct"><h2 id="h-ct">Schrijf in jouw stem</h2>' +
      (p.voice ? '' : '<p class="small muted">Tip: plak in Instellingen een voorbeeld van je eigen schrijfstijl, dan klinkt het meer als jou.</p>') +
      '<label class="f" for="ct-type">Soort<select id="ct-type">' + optList(CT_TYPES, c.type) + '</select></label>' +
      '<label class="f" for="ct-topic">Onderwerp<input type="text" id="ct-topic" value="' + esc(c.topic) + '" placeholder="Bijvoorbeeld: mijn avondroutine"></label>' +
      '<div class="row"><button class="btn" data-act="content-write"' + (c.busy ? ' disabled' : '') + '>Schrijf</button></div>' +
      (c.out || c.busy ? '<div class="brief" id="contentOut" aria-live="polite">' + (c.out ? md(c.out) : '<p class="muted">Wordt geschreven…</p>') + '</div>' +
        (c.out && !c.busy ? '<div class="row"><button class="btn ghost small" data-act="content-copy">Kopieer</button><button class="btn ghost small" data-act="content-check">Controleer</button><button class="btn ghost small" data-act="content-plan">Plan in</button></div>' : '') : '') + '</section>' +
      '<section class="card" aria-labelledby="h-cal"><div class="row"><h2 id="h-cal">Contentkalender</h2><span class="spacer"></span><button class="btn ghost small" data-act="content-new">Idee toevoegen</button><button class="btn small" data-act="content-week">Week laten plannen</button></div>' +
      (items.length ? items.map(i => '<div class="contact"><div class="row"><b>' + esc(fmtDate(i.date)) + '</b>' + pill(i.platform || 'Idee') + '<span class="spacer"></span><label class="sr" for="cs' + i.id + '">Status</label><select id="cs' + i.id + '" data-change="content-status" data-id="' + i.id + '" style="width:auto;min-height:36px;padding:4px 10px">' + optList(['Idee', 'Klaar', 'Geplaatst'], i.status) + '</select></div>' +
        '<p>' + esc(i.idea) + '</p>' + (i.text ? '<details><summary class="small" style="cursor:pointer;min-height:32px">Tekst</summary><p style="white-space:pre-wrap">' + esc(i.text) + '</p></details>' : '') +
        '<div class="row"><button class="btn ghost small" data-act="content-del" data-id="' + i.id + '">Verwijder</button></div></div>').join('') : '<p class="muted">Nog niets gepland.</p>') + '</section>';
  } else {
    const f = state.docs.figures, rk = prefs().rank || {}, t = todayKey();
    const figHTML = f ? '<div class="tablewrap"><table><thead><tr>' + f.headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + f.rows.slice(0, 12).map(r => '<tr>' + f.headers.map((_, i) => '<td>' + esc(r[i] || '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div><p class="small muted">' + esc(f.name || 'Import') + ' · ' + f.rows.length + ' rijen · ' + esc(new Date(f.importedAt).toLocaleDateString('nl-NL')) + '</p>' : '<p class="muted small">Nog geen cijfers. Exporteer ze uit je eigen backoffice als CSV en laad ze hier. Niemands wachtwoord is nodig.</p>';
    let rank = '';
    if (f) {
      const ci = Math.min(Math.max(parseInt(rk.col != null ? rk.col : 1, 10) || 0, 0), f.headers.length - 1), vals = f.rows.map(r => numOf(r[ci])).filter(v => v != null), cur = vals.length ? vals[vals.length - 1] : null;
      const tgt = numOf(rk.target), left = cur != null && tgt != null ? Math.max(0, tgt - cur) : null, pct = cur != null && tgt ? Math.min(100, Math.round(cur / tgt * 100)) : 0;
      const weeks = rk.deadline ? Math.max(0.5, daysBetween(t, rk.deadline) / 7) : null, conv = conversion(), nt = numOf(rk.newTarget);
      rank = '<section class="card" aria-labelledby="h-rank"><h2 id="h-rank">Voortgang naar mijn volgende stap</h2>' +
        field('rk-name', 'Naam van de stap', rk.name || '') +
        '<label class="f" for="rk-col">Kolom met mijn volume<select id="rk-col">' + f.headers.map((h, i) => '<option value="' + i + '"' + (i === ci ? ' selected' : '') + '>' + esc(h) + '</option>').join('') + '</select></label>' +
        field('rk-target', 'Doelwaarde', rk.target || '', 'inputmode="numeric"') + dateField('rk-dead', 'Uiterlijk op', rk.deadline) +
        field('rk-new', 'Nieuwe teamleden die ik wil begeleiden (optioneel)', rk.newTarget || '', 'inputmode="numeric"') +
        '<div class="row"><button class="btn" data-act="rank-save">Opslaan</button></div>' +
        (cur != null && tgt ? '<div class="bar' + (pct >= 100 ? ' full' : '') + '"><i style="width:' + pct + '%"></i></div><p>Nu <b>' + cur + '</b> van <b>' + tgt + '</b> (' + pct + '%). ' + (left ? 'Nog <b>' + left + '</b> te gaan' + (weeks ? ', ongeveer <b>' + Math.ceil(left / weeks) + '</b> per week tot ' + esc(fmtDate(rk.deadline)) : '') + '.' : 'Doel bereikt.') + '</p>' : '<p class="small muted">Vul een doelwaarde in om je voortgang te zien.</p>') +
        (nt && conv === 0 ? '<p class="small muted">Nog niemand in je pipeline is gestart, dus er is nog geen verhouding om mee te rekenen.</p>' : '') + (nt && conv ? '<p>Rekenvoorbeeld: bij jouw huidige verhouding (' + Math.round(conv * 100) + '% van je prospects is gestart) heb je ongeveer <b>' + Math.ceil(nt / conv) + '</b> gesprekken nodig voor ' + nt + ' nieuwe teamleden' + (weeks ? ', dus ongeveer ' + Math.ceil(nt / conv / weeks) + ' per week' : '') + '.</p>' : (nt && conv == null ? '<p class="small muted">Voor een rekenvoorbeeld heb je minstens vijf prospects in je pipeline nodig.</p>' : '')) +
        '<p class="small muted">Dit rekent met je eigen cijfers en is geen voorspelling of belofte.</p></section>';
    }
    body = '<section class="card" aria-labelledby="h-fig"><div class="row"><h2 id="h-fig">Mijn cijfers</h2><span class="spacer"></span>' + (f ? '<button class="btn danger small" data-act="fig-clear">Verwijder</button>' : '') + '<label class="btn ghost small" for="figfile" style="cursor:pointer">CSV laden</label><input id="figfile" class="sr" type="file" accept=".csv,.txt,text/csv" data-change="fig-file"></div>' + figHTML + '</section>' + rank;
  }
  return '<h1>Groei</h1>' + (profile() && profile().goal ? '<section class="card soft"><p class="eyebrow">Mijn lange termijndoel</p><p>' + esc(profile().goal) + '</p></section>' : '') + (hasVo ? '' : subTabs('groei')) + body;
}
const FLAG_INCOME = /(verdien\w*|passief inkomen|financi[eë]le vrijheid|financieel vrij|stop met werken|extra inkomen|rijk worden|gegarandeerd\w*|garantie|zeker succes|ontslag\w*)/gi;
const FLAG_HEALTH = /(genees\w*|geneeskrachtig\w*|behandel\w*|kanker|depressi\w*|angststoornis\w*|diabet\w*|ontsteking\w*|virus\w*|covid|corona|medicij\w*|ontgift\w*|voorkom\w*|beschermt tegen|vermindert pijn|slaapprobleem\w*|slaapproblemen|burn-out|adhd|autisme|allergie\w*)/gi;
function flagText(t) {
  const out = [], seen = {};
  [[FLAG_INCOME, 'inkomen'], [FLAG_HEALTH, 'gezondheid']].forEach(([re, type]) => { (t.match(re) || []).forEach(m => { const k = type + m.toLowerCase(); if (!seen[k]) { seen[k] = 1; out.push({ type, term: m }); } }); });
  return out;
}

/* ---------- Team ---------- */
function libList(items) {
  const seen = prefs().lastSeenLib || '';
  if (!items.length) return '<div class="card soft"><p>' + (libAll().length ? 'Niets gevonden voor deze zoekopdracht.' : (store.isAdmin ? 'De bibliotheek is nog leeg. Voeg de eerste voorwaarden, promotie of lijst toe.' : 'De bibliotheek is nog leeg. De beheerder voegt hier informatie toe.')) + '</p></div>';
  return items.map(i => '<details class="item"><summary>' + pill(i.category || 'Overig') + '<b style="flex:1">' + esc(i.title) + '</b>' + (i.central ? pill('Centraal') : '') + ((i.updatedAt || '') > seen ? pill('Nieuw', 'due') : '') + '</summary><div class="body">' + esc(i.text) +
    (i.note ? '<p class="small" style="margin-top:12px"><b>Wat is er veranderd:</b> ' + esc(i.note) + '</p>' : '') +
    '<p class="small muted" style="margin-top:12px">Bijgewerkt op ' + esc(i.updatedAt ? new Date(i.updatedAt).toLocaleDateString('nl-NL') : '—') + '</p>' +
    '<div class="row" style="margin-top:8px">' + ((i.central ? store.isOwner : store.isAdmin) ? '<button class="btn ghost small" data-act="lib-edit" data-id="' + esc(i.id) + '">Bewerk</button>' : '') + (store.isAdmin ? '<button class="btn ghost small" data-act="lib-camp" data-id="' + esc(i.id) + '">Maak campagne</button>' : '') + '</div>' + '</div></details>').join('');
}
function viewTeam() {
  const sub = state.sub.team, t = todayKey(), pr = prefs(), me = meId(); let body = '';
  const adminBtn = (act, label) => store.isAdmin ? '<button class="btn" data-act="' + act + '">' + label + '</button>' : '';
  if (sub === 'Bibliotheek') {
    const q = state.libSearch.toLowerCase(), cat = state.libCat;
    const items = libAll().filter(i => (cat === 'Alles' || i.category === cat) && (!q || (i.title + ' ' + i.text).toLowerCase().includes(q))).sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.title || '').localeCompare(b.title || ''));
    const changed = libAll().filter(i => (i.updatedAt || '') > (pr.lastSeenLib || '') && (i.prevText || i.note));
    body = '<div class="row"><span class="spacer"></span>' + (store.isAdmin || store.isOwner ? '<button class="btn" data-act="lib-new">Toevoegen</button>' : '') + '</div>' +
      '<p class="small muted">Gedeelde informatie: voorwaarden van acties, promoties, productlijsten en begrippen. De coach gebruikt dit als bron.</p>' +
      (changed.length ? '<div class="row">' + coachBtn('Vat de wijzigingen samen', 'Vat samen wat er is veranderd in de bibliotheek. Dit zijn de gewijzigde teksten met hun vorige versie of wijzigingsnotitie:\n' + changed.map(i => '## ' + i.title + '\nNu: ' + i.text.slice(0, 600) + '\nVorige versie: ' + (i.prevText || '-').slice(0, 600) + '\nNotitie: ' + (i.note || '-')).join('\n\n') + '\nGeef per tekst één zin: wat is anders en wat betekent dat voor mij.', 'btn') + '</div>' : '') +
      '<label class="f"><span class="sr">Zoeken in de bibliotheek</span><input type="search" id="libq" data-input="libsearch" placeholder="Zoeken…" value="' + esc(state.libSearch) + '"></label>' +
      '<div class="seg" role="group" aria-label="Categorie">' + ['Alles'].concat(CATS).map(c => '<button class="chip" data-act="lib-cat" data-cat="' + esc(c) + '" aria-pressed="' + (c === cat) + '">' + esc(c) + '</button>').join('') + '</div>' +
      '<div id="liblist" style="display:flex;flex-direction:column;gap:10px">' + libList(items) + '</div>';
  } else if (sub === 'Campagnes') {
    body = viewCampagnes();
  } else if (sub === 'Training') {
    const tr = sh('training');
    body = '<div class="row"><span class="spacer"></span>' + adminBtn('train-new', 'Les toevoegen') + '</div>' + (tr.map(x => {
      const best = (pr.quiz || {})[x.id], ok = /^https?:\/\//i.test(x.url || '');
      return '<section class="card"><div class="row"><h3>' + esc(x.title) + '</h3><span class="spacer"></span>' + (x.category ? pill(x.category) : '') + '</div>' + (x.desc ? '<p class="small">' + esc(x.desc) + '</p>' : '') +
        '<div class="row">' + (ok ? '<a class="btn ghost small" href="' + esc(x.url) + '" target="_blank" rel="noopener">Open les of video</a>' : '') +
        ((x.quiz || []).length ? '<button class="btn small" data-act="quiz-start" data-id="' + esc(x.id) + '">Quiz (' + x.quiz.length + ')</button>' : '') + (best ? pill('Beste score ' + best.best + '/' + best.of, '') : '') +
        '<span class="spacer"></span>' + (store.isAdmin ? '<button class="btn ghost small" data-act="train-edit" data-id="' + esc(x.id) + '">Bewerk</button>' : '') + '</div></section>';
    }).join('') || '<div class="card soft"><p>Nog geen trainingen. ' + (store.isAdmin ? 'Voeg een les toe met een link en een korte quiz.' : 'De beheerder voegt ze hier toe.') + '</p></div>');
  } else if (sub === 'Draaiboek') {
    const steps = sh('playbook').slice().sort((a, b) => (a.day || 0) - (b.day || 0)), done = steps.filter(s => (pr.done || {})[s.id]).length;
    body = '<div class="row"><span class="spacer"></span>' + adminBtn('play-new', 'Stap toevoegen') + '</div><p class="small muted">Het draaiboek voor je eerste weken. Vink af wat je gedaan hebt.</p>' +
      (steps.length ? '<div class="bar' + (done === steps.length ? ' full' : '') + '"><i style="width:' + Math.round(done / steps.length * 100) + '%"></i></div><p class="small">' + done + ' van ' + steps.length + ' stappen gezet</p>' : '') +
      (steps.map(s => '<div class="contact"><label class="check"><input type="checkbox" data-change="play-done" data-id="' + esc(s.id) + '"' + ((pr.done || {})[s.id] ? ' checked' : '') + '><span><b>Dag ' + esc(s.day) + ': ' + esc(s.title) + '</b><br><span class="small muted">' + esc(s.text || '') + '</span></span></label>' +
        (store.isAdmin ? '<div class="row"><button class="btn ghost small" data-act="play-edit" data-id="' + esc(s.id) + '">Bewerk</button></div>' : '') + '</div>').join('') || '<div class="card soft"><p>Nog geen draaiboek. ' + (store.isAdmin ? 'Zet de stappen klaar voor nieuwe leden.' : 'Je upline zet het hier klaar.') + '</p></div>');
  } else if (sub === 'Agenda') {
    const ev = sh('agenda').filter(e => e.date >= t).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    body = '<div class="row"><span class="spacer"></span>' + adminBtn('agenda-new', 'Afspraak toevoegen') + '</div>' + (ev.map(e => '<div class="contact"><div class="row"><b>' + esc(e.title) + '</b><span class="spacer"></span>' + pill(fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' }) + (e.time ? ' ' + e.time : '')) + '</div><p class="small muted">' + esc(e.place || '') + (e.note ? ' · ' + esc(e.note) : '') + '</p>' +
      (store.isAdmin ? '<div class="row"><button class="btn ghost small" data-act="agenda-edit" data-id="' + esc(e.id) + '">Bewerk</button></div>' : '') + '</div>').join('') || '<div class="card soft"><p>Geen afspraken gepland.</p></div>');
  } else if (sub === 'Uitdaging') {
    const ch = sh('challenge')[0], mine = (pr.challenge || {}).days || {}, myCount = Object.keys(mine).length, board = sh('board').slice().sort((a, b) => (b.score || 0) - (a.score || 0));
    body = '<div class="row"><span class="spacer"></span>' + adminBtn('chal-edit', ch ? 'Uitdaging aanpassen' : 'Uitdaging maken') + '</div>' +
      (ch ? '<section class="card gold"><h2>' + esc(ch.title) + '</h2><p>' + esc(ch.desc || '') + '</p><p class="small">' + esc(fmtDate(ch.start)) + ' tot ' + esc(fmtDate(ch.end)) + '</p>' +
        (t >= ch.start && t <= ch.end ? '<div class="row"><button class="btn" data-act="chal-today">' + (mine[t] ? 'Vandaag gedaan (tik om terug te draaien)' : 'Ik heb vandaag meegedaan') + '</button>' + pill(myCount + ' dag' + (myCount === 1 ? '' : 'en'), '') + '</div>' : '<p class="small">De uitdaging loopt niet vandaag.</p>') + '</section>' : '<div class="card soft"><p>Er loopt nu geen teamuitdaging.</p></div>') +
      '<section class="card" aria-labelledby="h-lb"><h2 id="h-lb">Leaderboard (vrijwillig)</h2><label class="check"><input type="checkbox" data-change="board-toggle"' + (pr.board ? ' checked' : '') + '><span>Toon mijn naam, score en reeks aan het team. Je kunt dit altijd uitzetten.</span></label>' +
      (board.length ? '<div class="tablewrap"><table><thead><tr><th>Naam</th><th>Score 7 dagen</th><th>Reeks</th><th>Uitdaging</th></tr></thead><tbody>' + board.map(b => '<tr><td>' + esc(b.name) + (b.id === me ? ' (jij)' : '') + '</td><td>' + (b.score || 0) + '%</td><td>' + (b.streak || 0) + '</td><td>' + (b.challenge || 0) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="small muted">Nog niemand doet mee.</p>') + '</section>';
  } else if (sub === 'Mentor') {
    const ms = sh('mentors'), mine = ms.find(x => x.id === me), others = ms.filter(x => x.id !== me);
    body = '<section class="card"><h2>Mijn rol</h2><label class="f" for="m-role">Ik wil…<select id="m-role"><option value="geen">niets delen</option><option value="zoek"' + (mine && mine.role === 'zoek' ? ' selected' : '') + '>een mentor zoeken</option><option value="bied"' + (mine && mine.role === 'bied' ? ' selected' : '') + '>mentor zijn</option></select></label>' +
      areaField('m-text', 'Waar kan of wil je mee helpen of sparren?', mine && mine.text) + field('m-contact', 'Hoe kunnen anderen je bereiken?', mine && mine.contact, 'placeholder="Bijvoorbeeld: via de teamchat"') +
      '<div class="row"><button class="btn" data-act="mentor-save">Opslaan</button></div></section>' +
      ['bied', 'zoek'].map(r => '<section class="card"><h3>' + (r === 'bied' ? 'Mentoren' : 'Zoeken een mentor') + '</h3>' + (others.filter(x => x.role === r).map(x => '<div class="contact"><b>' + esc(x.name) + '</b><p class="small">' + esc(x.text || '') + '</p><p class="small muted">' + esc(x.contact || '') + '</p></div>').join('') || '<p class="small muted">Nog niemand.</p>') + '</section>').join('');
  } else if (sub === 'Erkenning') {
    const mine = badges(), kd = sh('kudos').filter(k => k.to === me), members = {};
    sh('shares').concat(sh('board'), sh('mentors')).forEach(x => { members[x.id] = x.name; });
    body = '<section class="card"><h2>Mijn badges</h2>' + (mine.length ? mine.map(b => '<div class="row"><span class="badge">' + esc(b[0]) + '</span><span class="small muted">' + esc(b[1]) + '</span></div>').join('') : '<p class="muted">Nog geen badges. Ze komen vanzelf.</p>') + '</section>' +
      '<section class="card"><h2>Erkenning van mijn upline</h2>' + (kd.length ? kd.map(k => '<div class="contact"><span class="badge">' + esc(k.badge) + '</span><p>' + esc(k.note || '') + '</p></div>').join('') : '<p class="muted">Nog niets ontvangen.</p>') + '</section>' +
      (store.isAdmin ? '<section class="card"><h2>Erkenning geven</h2><label class="f" for="k-to">Aan<select id="k-to"><option value="">Kies een lid</option>' + Object.keys(members).map(id => '<option value="' + esc(id) + '">' + esc(members[id]) + '</option>').join('') + '</select></label>' +
        '<label class="f" for="k-badge">Badge<select id="k-badge">' + optList(['Teamster', 'Doorzetter', 'Hulpvaardig', 'Inspiratie', 'Eerste gesprek', 'Mijlpaal'], '') + '</select></label>' + field('k-note', 'Persoonlijke boodschap', '') +
        '<div class="row"><button class="btn" data-act="kudos-give">Geef erkenning</button></div></section>' : '');
  } else if (sub === 'Hulp') {
    if (store.isAdmin) {
      const hl = sh('help');
      body = '<section class="card"><h2>Hulpvragen van leden</h2>' + (hl.map(h => '<div class="contact"><div class="row"><b>' + esc(h.name) + '</b><span class="spacer"></span>' + pill(h.at ? fmtDate(h.at.slice(0, 10)) : '') + '</div><p>' + esc(h.text) + '</p><p class="small muted">Neem zelf contact op. Het lid haalt de vraag weg als het opgelost is.</p></div>').join('') || '<p class="muted">Geen openstaande hulpvragen.</p>') + '</section>';
    } else {
      body = '<section class="card"><h2>Ik loop vast</h2>' + (pr.helpOpen ? '<p>Je hulpvraag staat open voor je upline:</p><div class="brief">' + esc(pr.helpText || '') + '</div><div class="row"><button class="btn" data-act="help-clear">Opgelost, haal weg</button></div>' :
        '<p class="small muted">Je upline ziet je naam en je vraag. Meer niet.</p>' + areaField('h-text', 'Waar kun je hulp bij gebruiken?', '') + '<div class="row"><button class="btn" data-act="help-send">Stuur naar mijn upline</button></div>') + '</section>';
    }
  } else {
    const sr = sh('shares').slice().sort((a, b) => (a.last || '').localeCompare(b.last || ''));
    body = '<section class="card"><h2>Teamoverzicht</h2><p class="small muted">Alleen wat leden zelf hebben vrijgegeven. Wie niets deelt, staat hier niet.</p>' + (sr.length ? '<div class="tablewrap"><table><thead><tr><th>Naam</th><th>Score 7 dagen</th><th>Reeks</th><th>Laatst actief</th><th>Pipeline</th><th>Draaiboek</th></tr></thead><tbody>' + sr.map(s => {
      const late = s.last && daysBetween(s.last, t) >= 5, pipe = s.pipe ? Object.keys(s.pipe).reduce((a, k) => a + (s.pipe[k] || 0), 0) : null;
      return '<tr><td>' + esc(s.name) + (late ? ' ' + pill('aandacht', 'due') : '') + '</td><td>' + (s.score7 != null ? s.score7 + '%' : '') + '</td><td>' + (s.streak != null ? s.streak : '') + '</td><td>' + (s.last ? esc(fmtDate(s.last)) : '') + '</td><td>' + (pipe != null ? pipe : '') + '</td><td>' + (s.playbook ? s.playbook.done + '/' + s.playbook.total : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="muted">Nog niemand deelt gegevens.</p>') + '</section>';
  }
  return '<h1>Team</h1>' + subTabs('team') + body;
}


/* ---------- voorbeeldweergaven (visueel, nog niet functioneel) ---------- */
const MOCK_TITLES = { push: 'Meldingen', voice: 'Spraaknotitie', calendar: 'Agenda-koppeling', yl: 'Young Living-koppeling', pay: 'Abonnement', lang: 'Taal van de app', vo: 'Virtual Office ophalen' };
function mockHTML(kind) {
  const bar = '<div class="mockbar"><b>Voorbeeld.</b> Zo zou dit eruitzien. De functie werkt nog niet en er wordt niets verstuurd of opgeslagen.</div>';
  const noop = (label, cls) => '<button class="btn ' + (cls || '') + '" data-act="mock-noop">' + label + '</button>';
  const tg = (label, sub, on) => '<label class="tgl"><span><b>' + label + '</b><br><span class="small muted">' + sub + '</span></span><input type="checkbox"' + (on ? ' checked' : '') + '></label>';
  let body = '';
  if (kind === 'push') body = '<div class="lock"><div class="time">08:00</div>' +
    '<div class="notif">' + ICON.today + '<span><b>Goedemorgen, ' + esc(profile().name) + '</b><br>Je hebt 3 mensen om op te volgen en je teamcall begint vanavond om 20:00.<small>Lumo · nu</small></span></div>' +
    '<div class="notif">' + ICON.people + '<span><b>Even laten horen</b><br>Mila de Vries wacht al 12 dagen op een bericht.<small>Lumo · 2 min geleden</small></span></div>' +
    '<div class="notif">' + ICON.team + '<span><b>Nieuw in de bibliotheek</b><br>De welkomstactie is bijgewerkt.<small>Lumo · gisteren</small></span></div></div>' +
    '<div>' + tg('Ochtendbriefing', 'Elke dag om 08:00', true) + tg('Opvolgherinneringen', 'Wanneer een gesprek gepland staat', true) + tg('Opvolging met reden', 'Alleen als er iets te bieden valt', true) + tg('Teamnieuws', 'Agenda en bibliotheek', false) + tg('Avondcheck-in', 'Elke avond om 21:00', false) + '</div>';
  if (kind === 'voice') { const h = [14, 30, 22, 40, 18, 34, 44, 26, 38, 16, 28, 36, 20, 42, 24, 32, 12, 30, 22, 38]; body = '<div class="wave" aria-hidden="true">' + h.map(x => '<i style="height:' + x + 'px"></i>').join('') + '</div>' +
    '<button class="mic" data-act="mock-noop" aria-label="Opnemen (voorbeeld)">' + SVG('<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>') + '</button><p class="small muted" style="text-align:center">Tik en praat. 00:24</p>' +
    '<div class="brief"><p class="eyebrow">Uitgeschreven</p><p>"Net gebeld met Mila. Ze wil graag het startpakket bekijken, maar eerst met haar man overleggen. Donderdag opnieuw contact."</p></div>' +
    '<div class="brief"><p class="eyebrow">Lumo maakt er dit van</p><p><b>Contact:</b> Mila de Vries<br><b>Fase:</b> Opvolging<br><b>Volgend contact:</b> donderdag<br><b>Notitie:</b> Overlegt met haar man over het startpakket.</p></div>' + '<div class="row">' + noop('Bewaar bij Mila') + noop('Opnieuw opnemen', 'ghost') + '</div>'; }
  if (kind === 'calendar') body = '<div class="mockrow"><span class="ico">' + SVG('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>') + '</span><span style="flex:1"><b>Google Agenda</b><br><span class="small muted">sanne@voorbeeld.nl</span></span>' + pill('Verbonden') + '</div>' +
    '<div class="mockrow"><span class="ico">' + SVG('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>') + '</span><span style="flex:1"><b>Apple Agenda</b><br><span class="small muted">Niet verbonden</span></span>' + noop('Verbind', 'ghost small') + '</div>' +
    '<div>' + tg('Opvolgingen in mijn agenda', 'Elke opvolgdatum wordt een afspraak', true) + tg('Workshops in mijn agenda', 'Met gastenlijst in de omschrijving', true) + tg('Teamagenda erbij', 'Calls en trainingen van je upline', false) + '</div>' +
    '<div class="brief"><p class="eyebrow">Zo ziet je dag eruit</p><p><b>10:00</b> Opvolging: Mila de Vries<br><b>14:30</b> Opvolging: Rik Smit<br><b>20:00</b> Teamcall</p></div>';
  if (kind === 'yl') body = '<div class="mockrow"><span class="ico">' + LOGO.replace('width="32" height="32"', 'width="26" height="26"') + '</span><span style="flex:1"><b>Backoffice koppelen</b><br><span class="small muted">Met jouw toestemming, nooit met een wachtwoord</span></span></div>' +
    '<div class="brief"><p class="eyebrow">Dit zou Lumo mogen lezen</p><ul class="plain"><li>Je persoonlijke volume per maand</li><li>Je teamleden en hun status</li><li>Je voortgang naar de volgende stap</li></ul></div>' +
    '<label class="check"><input type="checkbox" checked><span>Ik geef Lumo toestemming om deze gegevens te lezen. Ik kan dit altijd intrekken.</span></label><div class="row">' + noop('Verbinden') + noop('Liever zelf een CSV laden', 'ghost') + '</div>' +
    '<p class="small muted">Er bestaat nog geen officiële koppeling met Young Living. Tot die er is, laad je je eigen cijfers als CSV.</p>';
  if (kind === 'pay') body = '<div class="card soft"><p class="eyebrow">Jouw abonnement</p><div class="price">€ [prijs] <span class="small muted">per maand</span></div><ul class="plain"><li>Coach en briefing zonder limiet</li><li>Team- en leiderfuncties</li><li>Bibliotheek, training en draaiboek</li></ul></div>' +
    '<div class="mockrow"><span class="ico">' + SVG('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>') + '</span><span style="flex:1"><b>Betaalmethode</b><br><span class="small muted">iDEAL of kaart</span></span></div>' + '<div class="row">' + noop('Afrekenen') + noop('Factuur bekijken', 'ghost') + '</div>';
  if (kind === 'vo') body = campVoMock();
  if (kind === 'lang') body = '<div class="seg" role="group" aria-label="Taal">' + ['Nederlands', 'English', 'Deutsch', 'Français'].map((l, i) => '<button class="chip" data-act="mock-noop" aria-pressed="' + (i === 0) + '">' + l + '</button>').join('') + '</div>' +
    '<div class="brief"><p class="eyebrow">Voorbeeld in English</p><p><b>Good morning, ' + esc(profile().name) + '</b><br>Daily goals · People · Coach · Growth · Team</p></div><div class="brief"><p class="eyebrow">Voorbeeld in Deutsch</p><p><b>Guten Morgen, ' + esc(profile().name) + '</b><br>Tagesziele · Menschen · Coach · Wachstum · Team</p></div>' +
    '<p class="small muted">De coach schrijft nu al in deze talen. Dit voorbeeld toont hoe de hele app zou meeschakelen.</p>';
  return '<div class="row"><h2>' + MOCK_TITLES[kind] + '</h2><span class="spacer"></span><span class="mock-tag">Voorbeeld</span></div>' + bar + body + '<div class="row"><button class="btn ghost" data-act="overlay-close">Sluiten</button></div>';
}
function mockSection() {
  const items = [['push', 'Meldingen op je telefoon', 'Briefing, opvolging en teamnieuws', ICON.today], ['voice', 'Spraaknotitie na een gesprek', 'Inspreken in plaats van typen', SVG('<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>')],
    ['calendar', 'Agenda-koppeling', 'Opvolgingen en workshops in je agenda', SVG('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>')], ['yl', 'Young Living-koppeling', 'Je cijfers automatisch ophalen', ICON.team],
    ['pay', 'Abonnement en betalen', 'Plan, betaalmethode en facturen', SVG('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>')], ['lang', 'Taal van de app', 'Nederlands, English, Deutsch, Français', ICON.coach]];
  return '<section class="card" aria-labelledby="h-mock"><div class="row"><h2 id="h-mock">Binnenkort</h2><span class="spacer"></span><span class="mock-tag">Voorbeeld</span></div><p class="small muted">Zo zouden deze onderdelen eruitzien. Ze werken nog niet.</p>' +
    items.map(x => '<button class="mockrow" data-act="mock-open" data-kind="' + x[0] + '" style="text-align:left;cursor:pointer;width:100%"><span class="ico">' + x[3] + '</span><span style="flex:1"><b>' + x[1] + '</b><br><span class="small muted">' + x[2] + '</span></span><span aria-hidden="true">›</span></button>').join('') + '</section>';
}

/* ---------- Instellingen ---------- */
function goalEditor(goals) {
  return '<div id="goaled" style="display:flex;flex-direction:column;gap:8px">' + goals.map((g, i) => '<div class="goalrow"><label class="sr" for="gl' + i + '">Doel ' + (i + 1) + '</label><input type="text" id="gl' + i + '" data-g="label" data-i="' + i + '" value="' + esc(g.label) + '" placeholder="Bijvoorbeeld: nieuwe gesprekken">' +
    '<label class="sr" for="gt' + i + '">Aantal per dag</label><input type="number" id="gt' + i + '" data-g="target" data-i="' + i + '" min="1" max="99" value="' + g.target + '">' +
    '<button class="icon-btn" data-act="goal-del" data-i="' + i + '" aria-label="Verwijder doel ' + (i + 1) + '">×</button></div>').join('') + '<div><button class="btn ghost small" data-act="goal-add">Doel toevoegen</button></div></div>';
}
function readGoals() {
  return [...document.querySelectorAll('#goaled .goalrow')].map((r, i) => {
    const l = $('[data-g=label]', r).value.trim(), t = Math.max(1, Math.min(99, parseInt($('[data-g=target]', r).value, 10) || 1)), old = (state.editGoals && state.editGoals[i]) || {};
    return { id: old.id || uid('g'), label: l, target: t };
  }).filter(g => g.label);
}
function readGoalsKeepEmpty() {
  return [...document.querySelectorAll('#goaled .goalrow')].map((r, i) => ({ id: ((state.editGoals || [])[i] || {}).id || uid('g'), label: $('[data-g=label]', r).value, target: parseInt($('[data-g=target]', r).value, 10) || 1 }));
}
function toneRadios(sel, name) {
  return '<fieldset style="border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:8px"><legend class="eyebrow" style="padding:0 0 6px">Toon van de coach</legend>' +
    Object.keys(TONES).map(k => '<label class="check"><input type="radio" name="' + name + '" value="' + k + '"' + (k === sel ? ' checked' : '') + '><span>' + TONES[k] + '</span></label>').join('') + '</fieldset>';
}
function viewInstellingen() {
  const p = profile(), pr = prefs(), s = pr.share || { on: false, sections: {} }, sec = s.sections || {}; if (!state.editGoals) state.editGoals = clone(p.goals);
  const chk = (id, label, on) => '<label class="check"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span>' + label + '</span></label>';
  return '<h1>Instellingen en privacy</h1>' + (store.mode === 'local' ? '<div class="banner">Lokale modus: je gegevens staan alleen in deze browser en verdwijnen als je browsergegevens wist. Teamfuncties werken dan alleen voor jezelf.</div>' : '') + (typeof webTeamCard === 'function' ? webTeamCard() : '') + (typeof webInboxCard === 'function' ? webInboxCard() : '') +
    '<section class="card" aria-labelledby="h-prof"><h2 id="h-prof">Mijn profiel</h2>' + field('s-name', 'Naam', p.name) + field('s-goal', 'Mijn doel', p.goal) +
    areaField('s-why', 'Waarom dit belangrijk is', p.why, 'De coach gebruikt dit om je te motiveren.') +
    '<label class="f" for="s-lang">Taal van de coach<select id="s-lang">' + Object.keys(LANGS).map(k => '<option value="' + k + '"' + (k === (p.lang || 'nl') ? ' selected' : '') + '>' + LANGS[k] + '</option>').join('') + '</select></label>' +
    areaField('s-voice', 'Mijn schrijfstijl', p.voice, 'Plak één of twee eigen berichten. Dan schrijft de coach meer zoals jij.') +
    toneRadios(p.tone, 's-tone') + '<div><h3 style="margin-bottom:8px">Dagdoelen</h3>' + goalEditor(state.editGoals) + '</div><div class="row"><button class="btn" data-act="set-save">Opslaan</button></div></section>' +
    '<section class="card" aria-labelledby="h-share"><h2 id="h-share">Delen met mijn upline</h2><p class="small muted">Standaard deel je niets. Zet het aan en kies precies wat je upline mag zien. Je kunt het altijd uitzetten; dan wordt je gedeelde gegevens verwijderd.</p>' +
    chk('sh-on', 'Ik deel gegevens met mijn upline', s.on) + chk('sh-score', 'Mijn score van de laatste 7 dagen', sec.score !== false) + chk('sh-streak', 'Mijn reeks', sec.streak !== false) + chk('sh-active', 'Wanneer ik voor het laatst actief was', sec.active !== false) +
    chk('sh-pipe', 'Aantallen in mijn pipeline (geen namen)', sec.pipeline !== false) + chk('sh-play', 'Mijn voortgang in het draaiboek', sec.playbook !== false) + '<div class="row"><button class="btn" data-act="share-save">Opslaan</button></div></section>' +
    campMsgSettings() + mockSection() +
    '<section class="card" aria-labelledby="h-priv"><h2 id="h-priv">Jouw gegevens</h2><ul class="plain"><li>Je profiel, doelen, mensen, cijfers en workshops staan in jouw eigen ruimte. Andere leden zien ze niet.</li>' +
    '<li>Bij elke vraag aan de coach stuurt Lumo je doelen, mensen, cijfers en de bibliotheek naar Claude van Anthropic om een antwoord te maken.</li>' +
    '<li>Je gaf toestemming op ' + esc(new Date(p.consentAt).toLocaleDateString('nl-NL')) + '. Je kunt die altijd intrekken: dan worden al je gegevens gewist.</li></ul>' +
    '<div class="row">' + (store.canDownload ? '<button class="btn ghost" data-act="data-download">Download mijn gegevens</button>' : '') + '<button class="btn danger" data-act="data-wipe">Trek toestemming in en wis alles</button></div></section>' +
    '<p class="small muted">Lumo is een onafhankelijke tool voor wellness-ondernemers en is niet verbonden aan, gesponsord of goedgekeurd door Young Living. Versie 2, build ' + esc(String((window.LUMO_CONFIG || {}).version || '?')) + '.</p>';
}

/* ---------- wizard ---------- */
function wizardHTML() {
  const w = state.wiz, bars = '<div class="steps" aria-hidden="true">' + [0, 1, 2, 3].map(i => '<i class="' + (i <= w.step ? 'on' : '') + '"></i>').join('') + '</div>'; let body = '';
  if (w.step === 0) body = '<div class="row" style="color:var(--brand)">' + LOGO + '<span class="brand">Lumo</span></div><h1>Jouw dag, jouw team, jouw tempo.</h1>' +
    '<p>Lumo is je persoonlijke assistent voor je wellness-bedrijf: dagdoelen, mensen, een coach, hulp bij content en je team. Eerst een paar dingen over je gegevens.</p>' +
    '<ul class="plain"><li>Alles wat je invult blijft van jou. Andere leden zien het niet, tenzij je zelf iets deelt.</li><li>De coach krijgt bij elke vraag jouw doelen, mensen en cijfers om mee te denken. Dat gaat via Claude van Anthropic.</li><li>Je kunt je gegevens altijd downloaden of wissen.</li></ul>' +
    '<label class="check"><input type="checkbox" id="w-consent"' + (w.consent ? ' checked' : '') + '><span>Ik begrijp dit en geef toestemming om mijn gegevens zo te gebruiken.</span></label>' +
    '<p class="small muted">Lumo is een onafhankelijke tool en is niet verbonden aan, gesponsord of goedgekeurd door Young Living.</p>' +
    '<div class="row"><button class="btn" data-act="wiz-next">Verder</button><button class="btn ghost" data-act="demo-load">Eerst proberen met voorbeeldgegevens</button></div>';
  if (w.step === 1) body = '<h1>Wie ben jij?</h1>' + field('w-name', 'Je naam', w.name, 'data-autofocus') + field('w-goal', 'Wat wil je bereiken?', w.goal, 'placeholder="Bijvoorbeeld: mijn eerste vijf teamleden"') +
    areaField('w-why', 'Waarom is dat belangrijk voor jou?', w.why) + '<div class="row"><button class="btn ghost" data-act="wiz-back">Terug</button><button class="btn" data-act="wiz-next">Verder</button></div>';
  if (w.step === 2) body = '<h1>Je dagdoelen</h1><p class="muted">Kleine, haalbare aantallen per dag. Je kunt ze later aanpassen.</p>' + goalEditor(w.goals) + '<div class="row"><button class="btn ghost" data-act="wiz-back">Terug</button><button class="btn" data-act="wiz-next">Verder</button></div>';
  if (w.step === 3) body = '<h1>Hoe wil je dat de coach praat?</h1>' + toneRadios(w.tone, 'w-tone') + '<div class="row"><button class="btn ghost" data-act="wiz-back">Terug</button><button class="btn" data-act="wiz-finish">Start Lumo</button></div>';
  return '<div class="wiz">' + bars + body + '</div>';
}
function readWizard() {
  const w = state.wiz;
  if (w.step === 0) { const c = $('#w-consent'); if (c) w.consent = c.checked; }
  if (w.step === 1) { w.name = $('#w-name').value.trim(); w.goal = $('#w-goal').value.trim(); w.why = $('#w-why').value.trim(); }
  if (w.step === 2) { state.editGoals = state.editGoals || w.goals; w.goals = readGoalsKeepEmpty(); }
  if (w.step === 3) { const r = document.querySelector('input[name=w-tone]:checked'); if (r) w.tone = r.value; }
}

/* ---------- overlays ---------- */
function overlayHTML() {
  const d = state.dialog; if (!d) return ''; let inner = '';
  const btns = (save, id, delAct) => '<div class="row"><button class="btn" data-act="' + save + '" data-id="' + esc(id) + '">Opslaan</button><button class="btn ghost" data-act="overlay-close">Annuleer</button><span class="spacer"></span>' + (id !== 'new' && delAct ? '<button class="btn danger" data-act="' + delAct + '" data-id="' + esc(id) + '">Verwijder</button>' : '') + '</div>';
  const isNew = d.id === 'new';
  if (d.type === 'contact') {
    const c = isNew ? { name: '', kind: 'Prospect', stage: 'Nieuw' } : state.docs[d.id] || {};
    inner = '<h2>' + (isNew ? 'Nieuw contact' : 'Contact bewerken') + '</h2>' + field('c-name', 'Naam', c.name, 'data-autofocus') +
      '<label class="f" for="c-kind">Soort<select id="c-kind">' + optList(KINDS, c.kind || 'Prospect') + '</select></label>' +
      '<label class="f" for="c-stage">Fase<select id="c-stage">' + optList(STAGES, c.stage) + '</select></label>' + dateField('c-next', 'Volgend contact', c.next) + dateField('c-birth', 'Verjaardag (optioneel)', c.birthday) +
      '<fieldset class="fs"><legend>Alleen voor klanten</legend>' + dateField('c-last', 'Laatste bestelling', c.lastOrder) + '<label class="f" for="c-cycle">Gemiddelde cyclus in dagen (hoe vaak deze klant bestelt, bv. 30 = elke maand)<input type="number" id="c-cycle" min="1" max="365" value="' + esc(c.cycle || '') + '"></label></fieldset>' +
      '<fieldset class="fs"><legend>Alleen voor teamleden</legend>' + dateField('c-start', 'Startdatum', c.startDate) + '</fieldset>' + areaField('c-note', 'Notitie', c.note) + orgYlHtml(c, d.id) + campInfoHtml(c) + btns('contact-save', d.id, 'contact-del');
  }
  if (d.type === 'event') {
    const e = isNew ? {} : state.docs[d.id] || {};
    inner = '<h2>' + (isNew ? 'Nieuwe workshop' : 'Workshop bewerken') + '</h2>' + field('e-title', 'Titel', e.title, 'data-autofocus') + dateField('e-date', 'Datum', e.date) + field('e-place', 'Plek', e.place) + areaField('e-note', 'Notitie', e.note) +
      areaField('e-att', 'Gasten', (e.attendees || []).map(a => a.name).join('\n'), 'Eén naam per regel.') + btns('event-save', d.id, 'event-del');
  }
  if (d.type === 'content') inner = '<h2>Idee toevoegen</h2>' + dateField('k-date', 'Datum', todayKey()) + '<label class="f" for="k-type">Soort<select id="k-type">' + optList(CT_TYPES, 'Instagram-post') + '</select></label>' + field('k-idea', 'Idee', '', 'data-autofocus') + btns('content-save', 'new', '');
  if (d.type === 'lib') {
    const it = isNew ? { category: CATS[0] } : libAll().find(x => x.id === d.id) || {};
    inner = '<h2>' + (isNew ? 'Toevoegen aan de bibliotheek' : 'Bewerken') + '</h2>' + field('l-title', 'Titel', it.title, 'data-autofocus') + '<label class="f" for="l-cat">Categorie<select id="l-cat">' + optList(CATS, it.category) + '</select></label>' +
      areaField('l-text', 'Tekst', it.text, 'Plak de tekst of laad een tekstbestand. Heb je een PDF? Kopieer de tekst eruit.', true) +
      '<div><label class="btn ghost small" for="libfile" style="cursor:pointer">Bestand laden</label><input id="libfile" class="sr" type="file" accept=".txt,.md,.csv,text/plain" data-change="lib-file"></div>' + field('l-note', 'Wat is er veranderd? (optioneel)', it.note) + (isNew && store.isOwner ? '<label class="f" for="l-scope">Waar plaatsen?<select id="l-scope"><option value="team">Alleen mijn team</option><option value="central">Centraal (alle teams)</option></select></label>' : '') + (it.central ? '<p class="small muted">Centraal item: wijzigingen zie je direct in alle teams.</p>' : '') + btns('lib-save', d.id, 'lib-del');
  }
  if (d.type === 'train') {
    const it = isNew ? {} : sh('training').find(x => x.id === d.id) || {};
    inner = '<h2>' + (isNew ? 'Les toevoegen' : 'Les bewerken') + '</h2>' + field('t-title', 'Titel', it.title, 'data-autofocus') + field('t-cat', 'Categorie', it.category) + areaField('t-desc', 'Korte omschrijving', it.desc) + field('t-url', 'Link naar les of video (https://…)', it.url) +
      areaField('t-quiz', 'Quizvragen (optioneel)', (it.quiz || []).map(q => [q.a[q.c]].concat(q.a.filter((_, i) => i !== q.c)).join(' | ')).map((x, i) => it.quiz[i].q + ' | ' + x).join('\n'), 'Eén vraag per regel: Vraag | goed antwoord | fout antwoord | fout antwoord', true) + btns('train-save', d.id, 'train-del');
  }
  if (d.type === 'quiz') {
    const qz = state.quiz, tr = sh('training').find(x => x.id === qz.id), q = tr.quiz[qz.i];
    if (qz.i >= tr.quiz.length) inner = '<h2>Klaar</h2><p>Je score: <b>' + qz.score + '</b> van <b>' + tr.quiz.length + '</b>.</p><div class="row"><button class="btn" data-act="overlay-close">Sluiten</button></div>';
    else inner = '<p class="eyebrow">Vraag ' + (qz.i + 1) + ' van ' + tr.quiz.length + '</p><h2>' + esc(q.q) + '</h2>' + (qz.picked == null ? qz.order[qz.i].map(oi => '<button class="btn ghost" data-act="quiz-ans" data-o="' + oi + '" style="justify-content:flex-start;text-align:left">' + esc(q.a[oi]) + '</button>').join('') :
      '<p><b>' + (qz.picked === q.c ? 'Goed!' : 'Niet helemaal.') + '</b> Het goede antwoord: ' + esc(q.a[q.c]) + '</p><div class="row"><button class="btn" data-act="quiz-next">Volgende</button></div>');
  }
  if (d.type === 'play') { const it = isNew ? { day: 1 } : sh('playbook').find(x => x.id === d.id) || {}; inner = '<h2>' + (isNew ? 'Stap toevoegen' : 'Stap bewerken') + '</h2><label class="f" for="p-day">Dag<input type="number" id="p-day" min="1" max="365" value="' + esc(it.day || 1) + '"></label>' + field('p-title', 'Titel', it.title, 'data-autofocus') + areaField('p-text', 'Uitleg', it.text) + btns('play-save', d.id, 'play-del'); }
  if (d.type === 'agenda') { const it = isNew ? {} : sh('agenda').find(x => x.id === d.id) || {}; inner = '<h2>' + (isNew ? 'Afspraak toevoegen' : 'Afspraak bewerken') + '</h2>' + field('a-title', 'Titel', it.title, 'data-autofocus') + dateField('a-date', 'Datum', it.date) + field('a-time', 'Tijd', it.time, 'placeholder="20:00"') + field('a-place', 'Plek of link', it.place) + areaField('a-note', 'Notitie', it.note) + btns('agenda-save', d.id, 'agenda-del'); }
  if (d.type === 'chal') { const it = sh('challenge')[0] || {}; inner = '<h2>Teamuitdaging</h2>' + field('ch-title', 'Titel', it.title, 'data-autofocus') + areaField('ch-desc', 'Wat doen we?', it.desc) + dateField('ch-start', 'Start', it.start || todayKey()) + dateField('ch-end', 'Einde', it.end || addDays(todayKey(), 6)) + btns('chal-save', it.id || 'new', it.id ? 'chal-del' : ''); }
  if (d.type === 'mock') inner = mockHTML(d.kind);
  { const cd = campDialog(d); if (cd) inner = cd; } { const wd = typeof webDialog === 'function' ? webDialog(d) : ''; if (wd) inner = wd; } { const od = orgDialog(d); if (od) inner = od; }
  if (d.type === 'wipe') inner = '<h2>Alles wissen?</h2><p>Je profiel, doelen, mensen, cijfers en workshops worden verwijderd en je toestemming wordt ingetrokken. Dit kan niet ongedaan worden gemaakt.</p><div class="row"><button class="btn danger" data-act="data-wipe-confirm">Ja, wis alles</button><button class="btn ghost" data-act="overlay-close" data-autofocus>Annuleer</button></div>';
  return '<div class="veil" data-act="veil"><div class="sheet" role="dialog" aria-modal="true">' + inner + '</div></div>';
}

/* ---------- render ---------- */
function navHTML() {
  const t = [['vandaag', 'Vandaag', ICON.today], ['mensen', 'Mensen', ICON.people], ['coach', 'Coach', ICON.coach], ['groei', 'Groei', ICON.growth], ['team', 'Team', ICON.team]];
  return '<nav class="tabs" aria-label="Hoofdmenu">' + t.map(x => '<button data-act="nav" data-view="' + x[0] + '"' + (state.view === x[0] ? ' aria-current="page"' : '') + '>' + x[2] + '<span>' + x[1] + '</span></button>').join('') + '</nav>';
}
function render() {
  const app = $('#app'); captureInputs(); state.pending = false;
  if (!state.ready) { app.innerHTML = '<div class="wiz"><p class="muted">Lumo wordt geladen…</p></div>'; return; }
  if (needsWizard()) { app.innerHTML = wizardHTML(); if (state.focusNext) { const f = $('[data-autofocus]'); if (f) f.focus(); state.focusNext = false; } return; }
  const views = { vandaag: viewVandaag, mensen: viewMensen, coach: viewCoach, groei: viewGroei, team: viewTeam, instellingen: viewInstellingen };
  app.innerHTML = '<header class="top"><span class="brand">' + LOGO + 'Lumo</span><span class="who">' + esc(profile().name) + '</span><button class="icon-btn" data-act="nav" data-view="instellingen" aria-label="Instellingen" style="border:0;background:none">' + ICON.gear.replace('<svg', '<svg width="24" height="24"') + '</button></header>' + navHTML() +
    '<main id="main">' + (profile().demo ? '<div class="banner row">Je ziet fictieve voorbeeldgegevens.<span class="spacer"></span><button class="btn ghost small" data-act="data-wipe">Wis en begin zelf</button></div>' : '') +
    (store.mode === 'local' && state.view !== 'instellingen' ? '<div class="banner">Lokale modus: je gegevens staan alleen in deze browser.</div>' : '') + views[state.view]() + '</main>' + overlayHTML();
  if (state.dialog && state.focusNext) { const f = $('[data-autofocus]'); if (f) f.focus(); state.focusNext = false; }
  scheduleSync();
}
function softRender() {
  const a = document.activeElement;
  if (a && a.closest && a.closest('#app') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { state.pending = true; return; }
  render();
}

/* ---------- delen met upline en leaderboard ---------- */
let syncTimer = null;
function scheduleSync() { if (!state.ready || needsWizard()) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 1500); }
async function syncNow() {
  const p = profile(), pr = prefs(), me = meId(); if (!p) return; syncCamps();
  const s = pr.share || {}, sec = s.sections || {};
  if (s.on) {
    const d = { name: p.name, updatedAt: new Date().toISOString() };
    if (sec.score !== false) d.score7 = score7(); if (sec.streak !== false) d.streak = streak(); if (sec.active !== false) d.last = lastActive();
    if (sec.pipeline !== false) { d.pipe = {}; STAGES.forEach(x => { d.pipe[x] = byKind('Prospect').filter(c => c.stage === x).length; }); }
    if (sec.playbook !== false) { const steps = sh('playbook'); d.playbook = { done: steps.filter(x => (pr.done || {})[x.id]).length, total: steps.length }; }
    const sig = JSON.stringify(Object.assign({}, d, { updatedAt: 0 }));
    if (sig !== state.sig.shares) { state.sig.shares = sig; putShared('shares', me, d); }
  } else if (state.sig.shares) { state.sig.shares = ''; dropShared('shares', me); }
  if (pr.board) {
    const d = { name: p.name, score: score7(), streak: streak(), challenge: Object.keys((pr.challenge || {}).days || {}).length }, sig = JSON.stringify(d);
    if (sig !== state.sig.board) { state.sig.board = sig; putShared('board', me, d); }
  } else if (state.sig.board) { state.sig.board = ''; dropShared('board', me); }
}

/* ---------- campagnes: acties en incentives van Young Living, per campagne op maat ---------- */
state.camp = { id: null, filter: 'Alles', q: '', limit: 30, view: 'board', month: null };
const CAMP_STALE_DAYS = 5;
const CAMP_KINDS = { line: 'Lijst met deelnemers', points: 'Puntenspel', checklist: 'Checklist', info: 'Alleen uitleg en berichten' };
const campKind = c => (c && CAMP_KINDS[c.kind] ? c.kind : 'line');
const campMonthKey = d => String(d || '').slice(0, 7);
const campEntries = c => campDoc(c.id).entries || [];
const campSum = list => list.reduce((n, e) => n + (Number(e.pts) || 0), 0);
function campMonths(c) {
  const t = todayKey(), a = (c.start || t.slice(0, 4) + '-01-01').slice(0, 7), z = (c.end || t.slice(0, 4) + '-12-31').slice(0, 7), out = [];
  let y = +a.slice(0, 4), m = +a.slice(5, 7);
  while ((y + '-' + String(m).padStart(2, '0')) <= z && out.length < 14) { out.push(y + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; y++; } }
  return out.length ? out : [t.slice(0, 7)];
}
function campMonthSel(c) { const t = todayKey().slice(0, 7); return state.camp.month || (c.period === 'total' ? 'all' : (campMonths(c).includes(t) ? t : campMonths(c)[0])); }
const campMonthLabel = m => new Date(m + '-15T12:00').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
function campTasksDone(c) { const dn = campDoc(c.id).tasks || {}; return (c.tasks || []).filter(t => dn[t.id]).length; }
function campSub(c) {
  const k = campKind(c), doc = campDoc(c.id);
  if (k === 'points') { const e = campEntries(c), m = todayKey().slice(0, 7), mp = campSum(e.filter(x => campMonthKey(x.date) === m)); return c.period === 'total' ? campSum(e) + ' punten' : mp + ' punten deze maand, ' + campSum(e) + ' totaal'; }
  if (k === 'checklist') return campTasksDone(c) + ' van ' + (c.tasks || []).length + ' taken gedaan';
  if (k === 'info') return 'Uitleg en berichten';
  const open = campOpen(c), stale = doc.people.filter(p => campStale(c, p)).length;
  return doc.people.length ? open + ' van ' + doc.people.length + ' nog open' + (stale ? ', ' + stale + ' om op te volgen' : '') : 'Nog geen deelnemers toegevoegd';
}
function campCount(c) { const k = campKind(c), doc = campDoc(c.id); return k === 'line' ? (doc.people.length ? doc.people.length + ' deelnemers' : 'Nog geen deelnemers') : k === 'points' ? campSum(campEntries(c)) + ' punten' : k === 'checklist' ? campTasksDone(c) + '/' + (c.tasks || []).length + ' gedaan' : ''; }
const campParseSteps = t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 10).map((l, i) => { const q = l.split('|').map(z => z.trim()); return { id: 's' + (i + 1), label: (q[0] || 'Stap ' + (i + 1)).slice(0, 60), hint: (q[1] || '').slice(0, 240), msg: (q[2] || '').slice(0, 700) }; });
const campParsePts = t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 12).map((l, i) => { const q = l.split('|').map(z => z.trim()); return { id: 'p' + (i + 1), label: (q[0] || 'Punt ' + (i + 1)).slice(0, 60), hint: (q[1] || '').slice(0, 300), pts: Number(String(q[2] || '1').replace(',', '.')) || 1 }; });
const campParseTasks = t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 20).map((l, i) => { const q = l.split('|').map(z => z.trim()); return { id: 't' + (i + 1), label: (q[0] || 'Taak ' + (i + 1)).slice(0, 80), hint: (q[1] || '').slice(0, 300), due: /^\d{4}-\d{2}-\d{2}$/.test(q[2] || '') ? q[2] : '' }; });
function campReadDraft(dlg) {
  const g = id => { const e = $('#' + id); return e ? e.value : null; }, x = Object.assign({}, dlg.draft);
  [['title', 'cm-title'], ['summary', 'cm-summary'], ['start', 'cm-start'], ['end', 'cm-end'], ['rules', 'cm-rules'], ['criteria', 'cm-crit'], ['audience', 'cm-aud'], ['status', 'cm-status'], ['period', 'cm-period'], ['goal', 'cm-goal']].forEach(([k, id]) => { const v = g(id); if (v !== null) x[k] = v; });
  const pv = g('cm-pv'); if (pv !== null) x.threshold = Number(pv) > 0 ? { pv: Number(pv), label: g('cm-pvl') || 'PV' } : null;
  const st = g('cm-steps'); if (st !== null) x.steps = campParseSteps(st);
  const pt = g('cm-pts'); if (pt !== null) x.pointTypes = campParsePts(pt);
  const tk = g('cm-tasks'); if (tk !== null) x.tasks = campParseTasks(tk);
  return x;
}

const campAll = () => sh('campaigns').filter(c => c.status === 'active' || (store.isAdmin && c.status !== 'ended'));
const campById = id => sh('campaigns').find(c => c.id === id);
const campDoc = id => state.docs['camp-' + id] || { people: [], share: 'off', entries: [], tasks: {} };
function saveCamp(id, doc) { save('camp-' + id, doc); }
const normName = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
function campDays(c) {
  const t = todayKey();
  if (c.end && c.end < t) return { txt: 'afgelopen', cls: 'due', left: -1 };
  if (c.start && c.start > t) return { txt: 'start over ' + daysBetween(t, c.start) + ' dagen', cls: '', left: 999 };
  if (c.end) { const n = daysBetween(t, c.end); return { txt: n === 0 ? 'laatste dag' : 'nog ' + n + ' dagen', cls: n <= 3 ? 'due' : '', left: n }; }
  return { txt: 'loopt', cls: '', left: 999 };
}
function campStepIdx(c, p) { const i = (c.steps || []).findIndex(s => s.id === p.step); return i < 0 ? 0 : i; }
function campCounts(c, people) { const out = {}; (c.steps || []).forEach(s => { out[s.id] = 0; }); people.forEach(p => { const s = c.steps[campStepIdx(c, p)]; if (s) out[s.id]++; }); return out; }
function campStale(c, p) {
  const last = (c.steps || []).length - 1; if (campStepIdx(c, p) >= last) return false;
  return !!p.updated && daysBetween(p.updated.slice(0, 10), todayKey()) >= CAMP_STALE_DAYS;
}
function campOpen(c) { const d = campDoc(c.id).people; return d.filter(p => campStepIdx(c, p) < (c.steps || []).length - 1).length; }
function campFirstStepMsg(c, p, st) { return (st && st.msg ? st.msg : '').replace(/\{naam\}/gi, (p.name || '').split(' ')[0]); }

/* ---------- Vandaag-kaart ---------- */
function campToday() {
  const list = campAll().filter(c => c.status === 'active' && campDays(c).left >= 0 && campDays(c).left !== 999); if (!list.length) return '';
  return '<section class="card" aria-labelledby="h-camp"><h2 id="h-camp">Lopende campagnes</h2>' + list.map(c => {
    const dd = campDays(c);
    return '<div class="row"><div><b>' + esc(c.title) + '</b><br><span class="small muted">' + esc(campSub(c)) + '</span></div><span class="spacer"></span>' + pill(dd.txt, dd.cls) + '<button class="btn small" data-act="camp-open" data-id="' + esc(c.id) + '">Open</button></div>';
  }).join('') + '</section>';
}

/* ---------- lijst en detail ---------- */
function viewCampagnes() {
  if (state.camp.id && campById(state.camp.id)) return viewCampDetail(campById(state.camp.id));
  state.camp.id = null;
  const list = campAll().sort((a, b) => (a.status === b.status ? (a.end || '9').localeCompare(b.end || '9') : a.status === 'active' ? -1 : 1));
  const ended = sh('campaigns').filter(c => c.status === 'ended');
  return '<div class="row"><span class="spacer"></span>' + (store.isAdmin ? '<button class="btn" data-act="camp-new">Nieuwe campagne</button>' : '') + '</div>' +
    '<p class="small muted">Acties en incentives van Young Living, op maat gemaakt. Elke campagne heeft zijn eigen opzet: een lijn met deelnemers, een puntenspel of een checklist, met deadline en eigen berichten.</p>' +
    (list.map(c => {
      const doc = campDoc(c.id), dd = campDays(c);
      return '<section class="card"><div class="row"><h3>' + esc(c.title) + '</h3><span class="spacer"></span>' + (c.status === 'draft' ? pill('Concept') : pill(dd.txt, dd.cls)) + '</div>' + (c.summary ? '<p class="small">' + esc(c.summary) + '</p>' : '') +
        '<div class="row small muted">' + (c.start || c.end ? esc((c.start ? fmtDate(c.start) : '') + ' tot ' + (c.end ? fmtDate(c.end) : '')) : '') + '<span class="spacer"></span>' + esc(campCount(c)) + '</div>' +
        '<div class="row"><button class="btn" data-act="camp-open" data-id="' + esc(c.id) + '">Open</button>' + (store.isAdmin ? '<button class="btn ghost small" data-act="camp-edit" data-id="' + esc(c.id) + '">Bewerk</button>' : '') + '</div></section>';
    }).join('') || '<div class="card soft"><p>Er loopt nu geen campagne. ' + (store.isAdmin ? 'Kies een actie uit de bibliotheek en laat Claude een campagne voorstellen.' : 'Je beheerder zet hier een campagne aan zodra er een actie loopt.') + '</p></div>') +
    (ended.length ? '<p class="small muted">' + ended.length + ' afgelopen campagne' + (ended.length > 1 ? 's' : '') + (store.isAdmin ? ' (te heropenen via Bewerk)' : '') + '</p>' : '');
}
function stepLine(c, p) {
  const n = c.steps.length, i = campStepIdx(c, p);
  return '<div class="stepline" aria-hidden="true">' + c.steps.map((s, k) => '<i class="' + (k < i ? 'done' : k === i ? 'now' : '') + '"></i>').join('<b class="' + 'sl"></b>') + '</div>';
}
function campFiltered(c) {
  const doc = campDoc(c.id), steps = c.steps || [], f = state.camp.filter, q = normName(state.camp.q || '');
  return doc.people.filter(p => (f === 'Alles' || (f === 'check' ? p.check && p.check.status === 'no' : (steps[campStepIdx(c, p)] || {}).id === f)) && (!q || normName(p.name).includes(q)));
}
function campCards(c) {
  const steps = c.steps || [], last = steps.length - 1, th = c.threshold && c.threshold.pv ? c.threshold : null;
  const all = campFiltered(c).sort((a, b) => (b.check && b.check.status === 'no') - (a.check && a.check.status === 'no') || campStepIdx(c, a) - campStepIdx(c, b) || a.name.localeCompare(b.name));
  const limit = state.camp.limit || 30, shown = all.slice(0, limit);
  const html = shown.map(p => {
    const i = campStepIdx(c, p), st = steps[i], pct = th ? Math.min(100, Math.round((Number(p.pv) || 0) / th.pv * 100)) : 0, stale = campStale(c, p), no = p.check && p.check.status === 'no';
    return '<div class="contact"><div class="row"><b>' + esc(p.name) + '</b>' + (p.contactId && state.docs[p.contactId] ? pill('In je contacten') : '') + (no ? pill('Voldoet mogelijk niet', 'due') : '') + (stale ? pill('Opvolgen', 'due') : '') + '<span class="spacer"></span><span class="small muted">' + esc(st ? st.label : '') + '</span></div>' +
      (no ? '<p class="small"><b>Let op:</b> ' + esc(p.check.why || 'Voldoet mogelijk niet aan de voorwaarden.') + ' Controleer dit in het Virtual Office.</p>' : '') +
      campInfoHtml(p) + stepLine(c, p) + (st && st.hint ? '<p class="small muted">' + esc(st.hint) + '</p>' : '') +
      (th ? '<div class="bar' + (pct >= 100 ? ' full' : '') + '"><i style="width:' + pct + '%"></i></div><p class="small">' + (Number(p.pv) || 0) + ' van ' + th.pv + ' ' + esc(th.label || 'PV') + '</p>' : '') +
      (p.note ? '<p class="small">' + esc(p.note) + '</p>' : '') +
      '<div class="row">' + (i < last ? '<button class="btn small" data-act="camp-next" data-id="' + esc(p.id) + '">Volgende stap</button>' : pill('Klaar')) + (i < last ? '<button class="btn ghost small" data-act="camp-msg" data-id="' + esc(p.id) + '">Bericht</button>' : '') +
      '<span class="spacer"></span><button class="btn ghost small" data-act="camp-person" data-id="' + esc(p.id) + '">Bewerk</button></div></div>';
  }).join('');
  return (html || '<div class="card soft"><p>' + (campDoc(c.id).people.length ? 'Niemand gevonden.' : 'Nog niemand op de lijn. Voeg deelnemers toe uit je contacten of plak ze uit het Virtual Office.') + '</p></div>') +
    (all.length > limit ? '<div class="row"><button class="btn ghost" data-act="camp-more">Toon meer (' + (all.length - limit) + ' te gaan)</button></div>' : '');
}

function campBoard(c) {
  const steps = c.steps || [], last = steps.length - 1, th = c.threshold && c.threshold.pv ? c.threshold : null, q = normName(state.camp.q || '');
  const people = campDoc(c.id).people.filter(p => !q || normName(p.name).includes(q));
  if (!people.length) return '<div class="card soft"><p>' + (campDoc(c.id).people.length ? 'Niemand gevonden.' : 'Nog niemand op het bord. Voeg deelnemers toe uit je contacten of plak ze uit het Virtual Office.') + '</p></div>';
  return '<div class="kb" role="list" aria-label="Deelnemers per stap">' + steps.map((s, k) => {
    const col = people.filter(p => campStepIdx(c, p) === k).sort((a, b) => (b.check && b.check.status === 'no') - (a.check && a.check.status === 'no') || a.name.localeCompare(b.name));
    return '<div class="kc" role="listitem"><div class="kh' + (k === last ? ' ok' : '') + '"><b>' + esc(s.label) + '</b><span>' + col.length + '</span></div><div class="kl">' +
      (col.map(p => {
        const no = p.check && p.check.status === 'no', stale = campStale(c, p), pct = th ? Math.min(100, Math.round((Number(p.pv) || 0) / th.pv * 100)) : 0;
        return '<div class="kp' + (no ? ' warn' : '') + '"><button class="kn" data-act="camp-person" data-id="' + esc(p.id) + '" aria-label="Bewerk ' + esc(p.name) + '">' + esc(p.name) + '</button>' +
          (no || stale ? '<div class="kf">' + (no ? pill('Let op', 'due') : '') + (stale ? pill('Opvolgen', 'due') : '') + '</div>' : '') +
          (th ? '<div class="bar' + (pct >= 100 ? ' full' : '') + '"><i style="width:' + pct + '%"></i></div>' : '') +
          '<div class="ka">' + (k < last ? '<button class="btn small" data-act="camp-next" data-id="' + esc(p.id) + '" aria-label="Volgende stap voor ' + esc(p.name) + '">Volgende ›</button><button class="btn ghost small" data-act="camp-msg" data-id="' + esc(p.id) + '">Bericht</button>' : '') + '</div></div>';
      }).join('') || '<p class="small muted" style="padding:8px">Leeg</p>') + '</div></div>';
  }).join('') + '</div>';
}
function campBody(c) { return state.camp.view === 'board' ? campBoard(c) : campCards(c); }

function campPointsView(c) {
  const doc = campDoc(c.id), types = c.pointTypes || [], ents = doc.entries || [], sel = campMonthSel(c), months = campMonths(c);
  const inSel = e => sel === 'all' || campMonthKey(e.date) === sel, list = ents.filter(inSel).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const tot = campSum(list), goal = Number(c.goal) || 0, pct = goal ? Math.min(100, Math.round(tot / goal * 100)) : 0;
  const chips = '<div class="seg" role="group" aria-label="Periode">' + months.map(m => '<button class="chip" data-act="camp-month" data-m="' + m + '" aria-pressed="' + (sel === m) + '">' + esc(new Date(m + '-15T12:00').toLocaleDateString('nl-NL', { month: 'short' })) + ' ' + campSum(ents.filter(e => campMonthKey(e.date) === m)) + '</button>').join('') + '<button class="chip" data-act="camp-month" data-m="all" aria-pressed="' + (sel === 'all') + '">Totaal ' + campSum(ents) + '</button></div>';
  return '<section class="card" aria-labelledby="h-cpt"><h2 id="h-cpt">Mijn punten</h2>' +
    '<div class="row" style="align-items:baseline"><span style="font-size:40px;font-weight:700;font-family:Fraunces,serif;color:var(--brand)">' + tot + '</span><span class="muted">punten ' + (sel === 'all' ? 'in totaal' : 'in ' + esc(campMonthLabel(sel))) + '</span></div>' +
    (goal ? '<div class="bar' + (pct >= 100 ? ' full' : '') + '"><i style="width:' + pct + '%"></i></div><p class="small">' + tot + ' van ' + goal + ' (je eigen doel)</p>' : '') + chips +
    (types.length ? types.map(t => { const n = list.filter(e => e.type === t.id); return '<div class="contact"><div class="row"><b>' + esc(t.label) + '</b><span class="spacer"></span><span class="pill">' + n.length + '× · ' + campSum(n) + ' p</span></div>' + (t.hint ? '<p class="small muted">' + esc(t.hint) + '</p>' : '') + '<div class="row"><button class="btn small" data-act="camp-pt-add" data-t="' + esc(t.id) + '">+ Punt</button></div></div>'; }).join('') : '<p class="muted">Deze campagne heeft nog geen puntensoorten.</p>') +
    '<h3>Wat ik noteerde</h3>' + (list.length ? list.map(e => { const t = types.find(x => x.id === e.type) || {}; return '<div class="row small"><span><b>' + esc(t.label || 'Punt') + '</b> · ' + esc(fmtDate(e.date)) + (e.who ? ' · ' + esc(e.who) : '') + (e.note ? '<br><span class="muted">' + esc(e.note) + '</span>' : '') + '</span><span class="spacer"></span><span class="pill">' + (Number(e.pts) || 0) + ' p</span><button class="btn ghost small" data-act="camp-pt-del" data-id="' + esc(e.id) + '" aria-label="Verwijder deze regel">✕</button></div>'; }).join('') : '<p class="small muted">Nog niets genoteerd in deze periode.</p>') +
    '<p class="small muted">Dit is je eigen kladblok. Young Living telt de officiële punten. Controleer die in het Virtual Office.</p></section>';
}
function campChecklistView(c) {
  const dn = campDoc(c.id).tasks || {}, ts = c.tasks || [], n = campTasksDone(c), t = todayKey();
  return '<section class="card" aria-labelledby="h-ctk"><div class="row"><h2 id="h-ctk">Taken</h2><span class="spacer"></span><span class="pill">' + n + ' van ' + ts.length + '</span></div>' +
    '<div class="bar' + (ts.length && n === ts.length ? ' full' : '') + '"><i style="width:' + (ts.length ? Math.round(n / ts.length * 100) : 0) + '%"></i></div>' +
    (ts.length ? ts.map(x => '<label class="check"><input type="checkbox" data-change="camp-task" data-id="' + esc(x.id) + '"' + (dn[x.id] ? ' checked' : '') + '><span><b>' + esc(x.label) + '</b>' + (x.due ? ' ' + pill('voor ' + fmtDate(x.due), !dn[x.id] && x.due < t ? 'due' : '') : '') + (x.hint ? '<br><span class="small muted">' + esc(x.hint) + '</span>' : '') + '</span></label>').join('') : '<p class="muted">Nog geen taken.</p>') + '</section>';
}
function campCopyRows(c) {
  const ms = (c.steps || []).filter(x => campTpl(c, x)); if (!ms.length) return '';
  return '<label class="f"><span>Voor wie? (voornaam)</span><input type="text" id="cmname" placeholder="Bijvoorbeeld Anna"></label>' + ms.map(x => '<div class="row"><span>' + esc(x.label) + '</span><span class="spacer"></span><button class="btn ghost small" data-act="camp-copytpl" data-id="' + esc(x.id) + '">Kopieer</button></div>').join('');
}
function campKindBody(c) { const k = campKind(c); return k === 'points' ? campPointsView(c) : k === 'checklist' ? campChecklistView(c) : ''; }
function viewCampDetail(c) {
  const doc = campDoc(c.id), people = doc.people, dd = campDays(c), steps = c.steps || [], counts = campCounts(c, people), f = state.camp.filter;
  const bad = people.filter(p => p.check && p.check.status === 'no').length;
  const chips = '<div class="seg" role="group" aria-label="Filter op stap"><button class="chip" data-act="camp-filter" data-f="Alles" aria-pressed="' + (f === 'Alles') + '">Alles (' + people.length + ')</button>' +
    (bad ? '<button class="chip" data-act="camp-filter" data-f="check" aria-pressed="' + (f === 'check') + '">Let op (' + bad + ')</button>' : '') +
    steps.map(s => '<button class="chip" data-act="camp-filter" data-f="' + esc(s.id) + '" aria-pressed="' + (f === s.id) + '">' + esc(s.label) + ' (' + counts[s.id] + ')</button>').join('') + '</div>';
  const mine = '<section class="card" aria-labelledby="h-cshare"><h2 id="h-cshare">Delen met je upline</h2><p class="small muted">Standaard blijft alles privé. Kies wat je beheerder van deze campagne mag zien.</p>' +
    '<label class="f" for="cshare">Wat deel je?<select id="cshare" data-change="camp-share" data-id="' + esc(c.id) + '"><option value="off"' + (doc.share === 'off' || !doc.share ? ' selected' : '') + '>Niets</option><option value="counts"' + (doc.share === 'counts' ? ' selected' : '') + '>' + (campKind(c) === 'points' ? 'Mijn puntentotaal' : 'Alleen aantallen per stap') + '</option>' + (campKind(c) === 'points' ? '' : '<option value="names"' + (doc.share === 'names' ? ' selected' : '') + '>Aantallen en namen</option>') + '</select></label>' +
    '<p class="small muted">' + (campKind(c) === 'points' ? 'Je beheerder ziet alleen je totaal, geen namen of notities. Je kunt dit altijd weer uitzetten.' : 'Namen zijn gegevens van anderen. Deel ze alleen als zij daar geen bezwaar tegen hebben. Je kunt dit altijd weer uitzetten.') + '</p></section>';
  return '<div class="row"><button class="btn ghost small" data-act="camp-back">‹ Alle campagnes</button><span class="spacer"></span>' + (store.isAdmin ? '<button class="btn ghost small" data-act="camp-edit" data-id="' + esc(c.id) + '">Bewerk</button>' : '') + '</div>' +
    '<section class="card"><div class="row"><h2>' + esc(c.title) + '</h2><span class="spacer"></span>' + (c.status === 'draft' ? pill('Concept') : pill(dd.txt, dd.cls)) + '</div>' + (c.summary ? '<p>' + esc(c.summary) + '</p>' : '') +
    (c.start || c.end ? '<p class="small muted">' + esc((c.start ? fmtDate(c.start, { day: 'numeric', month: 'long' }) : '') + ' tot ' + (c.end ? fmtDate(c.end, { day: 'numeric', month: 'long' }) : '')) + '</p>' : '') +
    (c.rules ? '<details><summary>Voorwaarden in het kort</summary><div class="brief">' + md(c.rules) + '</div></details>' : '') +
    '<p class="small muted">Samenvatting door Claude op basis van de voorwaarden in de bibliotheek. De officiële tekst in het Virtual Office gaat voor.</p></section>' +
    (campKind(c) !== 'line' ? campKindBody(c) : '<section class="card" aria-labelledby="h-cl"><div class="row"><h2 id="h-cl">Deelnemers</h2><span class="spacer"></span><button class="btn small" data-act="camp-people" data-id="' + esc(c.id) + '">Toevoegen</button></div>' +
    '<button class="mockrow" data-act="mock-open" data-kind="vo" style="text-align:left;cursor:pointer;width:100%"><span class="ico">' + ICON.team + '</span><span style="flex:1"><b>Ophalen uit het Virtual Office</b><br><span class="small muted">Verbind en haal je deelnemers automatisch op</span></span><span class="mock-tag">Voorbeeld</span></button>' +
    (bad ? '<div class="card gold"><p><b>' + bad + ' deelnemer' + (bad > 1 ? 's voldoen' : ' voldoet') + ' mogelijk niet aan de voorwaarden.</b> Bekijk ' + (bad > 1 ? 'ze' : 'die persoon') + ' onder Let op.</p></div>' : '') +
    (people.length ? '<div class="seg" role="group" aria-label="Weergave"><button class="chip" data-act="camp-view" data-v="board" aria-pressed="' + (state.camp.view === 'board') + '">Bord</button><button class="chip" data-act="camp-view" data-v="list" aria-pressed="' + (state.camp.view !== 'board') + '">Lijst</button></div><label class="f"><span class="sr">Zoek op naam</span><input type="search" id="campq" data-input="campsearch" placeholder="Zoek op naam…" value="' + esc(state.camp.q || '') + '"></label>' + (state.camp.view === 'board' ? '' : chips) : '') +
    '<div id="camplist" style="display:flex;flex-direction:column;gap:10px">' + campBody(c) + '</div></section>') +
    ((c.steps || []).some(x => x.msg) ? '<section class="card" aria-labelledby="h-ctpl"><h2 id="h-ctpl">Mijn berichten</h2><p class="small muted">De voorbeeldberichten van deze campagne zijn een startpunt. Maak ze van jou.</p>' + (campKind(c) === 'line' ? '' : campCopyRows(c)) + '<div class="row"><button class="btn ghost" data-act="camp-tpl" data-id="' + esc(c.id) + '">Pas mijn berichten aan</button></div></section>' : '') + (['line', 'points'].includes(campKind(c)) ? mine : '') + (store.isAdmin ? campOverview(c) : '');
}
function campOverview(c) {
  if (campKind(c) === 'points') { const rows = sh('campshares').filter(m => m.camps && m.camps[c.id]); return '<section class="card" aria-labelledby="h-cov"><h2 id="h-cov">Teamoverzicht</h2>' + (rows.length ? '<p class="small muted">Alleen de totalen die leden delen.</p>' + rows.map(m => { const x = m.camps[c.id]; return '<div class="row"><b>' + esc(m.name) + '</b><span class="spacer"></span><span class="small muted">deze maand ' + (x.month || 0) + ' · totaal ' + (x.points || 0) + '</span></div>'; }).join('') : '<p class="muted">Nog geen leden delen iets voor deze campagne.</p>') + '</section>'; }
  if (campKind(c) !== 'line') return '';
  const steps = c.steps || [], rows = sh('campshares').filter(m => m.camps && m.camps[c.id]);
  const tot = {}; steps.forEach(s => { tot[s.id] = 0; });
  rows.forEach(m => steps.forEach(s => { tot[s.id] += (m.camps[c.id].counts || {})[s.id] || 0; }));
  const all = steps.reduce((n, s) => n + tot[s.id], 0);
  return '<section class="card" aria-labelledby="h-cov"><h2 id="h-cov">Teamoverzicht</h2>' + (rows.length ? '<p class="small muted">Alleen wat leden voor deze campagne delen. Je ziet ' + rows.length + ' lid' + (rows.length > 1 ? 'en' : '') + ' met samen ' + all + ' deelnemers.</p>' +
    '<div class="row">' + steps.map(s => '<span class="pill">' + esc(s.label) + ': ' + tot[s.id] + '</span>').join('') + '</div>' +
    rows.map(m => { const x = m.camps[c.id]; return '<div class="contact"><div class="row"><b>' + esc(m.name) + '</b><span class="spacer"></span><span class="small muted">' + (x.total || 0) + ' deelnemers</span></div><div class="row">' + steps.map(s => '<span class="small">' + esc(s.label) + ' ' + ((x.counts || {})[s.id] || 0) + '</span>').join('<span class="muted">·</span>') + '</div>' +
      (x.names && x.names.length ? '<details><summary>Namen (' + x.names.length + ')</summary><ul class="plain">' + x.names.map(n => '<li>' + esc(n.name) + ' <span class="muted">— ' + esc((steps.find(s => s.id === n.step) || {}).label || '') + '</span></li>').join('') + '</ul></details>' : '<p class="small muted">Alleen aantallen gedeeld.</p>') + '</div>'; }).join('')
    : '<p class="muted">Nog geen leden delen iets voor deze campagne.</p>') + '</section>';
}

/* ---------- dialogs ---------- */
function campDialog(d) {
  const btnRow = (save, id, del) => '<div class="row"><button class="btn" data-act="' + save + '" data-id="' + esc(id) + '">Opslaan</button><button class="btn ghost" data-act="overlay-close">Annuleer</button><span class="spacer"></span>' + (del ? '<button class="btn danger" data-act="' + del + '" data-id="' + esc(id) + '">Verwijder</button>' : '') + '</div>';
  if (d.type === 'campedit') {
    const x = d.draft || {}, isNew = d.id === 'new', libs = libAll(), k = campKind(x);
    const stepsText = (x.steps || []).map(s => [s.label, s.hint || '', s.msg || ''].join(' | ')).join('\n');
    const ptsText = (x.pointTypes || []).map(t => [t.label, t.hint || '', t.pts || 1].join(' | ')).join('\n');
    const tasksText = (x.tasks || []).map(t => [t.label, t.hint || '', t.due || ''].join(' | ')).join('\n');
    const kindSel = '<label class="f" for="cm-kind">Type campagne<select id="cm-kind" data-change="camp-kind">' + Object.keys(CAMP_KINDS).map(q => '<option value="' + q + '"' + (q === k ? ' selected' : '') + '>' + CAMP_KINDS[q] + '</option>').join('') + '</select></label><p class="small muted">' +
      (k === 'line' ? 'Je volgt mensen langs stappen, zoals bij Welcome Back.' : k === 'points' ? 'Je noteert zelf punten of aantallen, per maand of in totaal, zoals bij Help 5.' : k === 'checklist' ? 'Een vaste reeks taken met optionele data.' : 'Alleen uitleg en voorbeeldberichten. Er valt niets bij te houden.') + '</p>';
    const msgArea = areaField('cm-steps', k === 'line' ? 'Stappen van de lijn' : 'Voorbeeldberichten (optioneel)', stepsText, k === 'line' ? 'Een stap per regel: naam | uitleg | berichtconcept (gebruik {naam}). De laatste stap is het einde.' : 'Een bericht per regel: naam | uitleg | berichtconcept (gebruik {naam}).', k === 'line');
    return '<h2>' + (isNew ? 'Nieuwe campagne' : 'Campagne bewerken') + '</h2>' +
      '<fieldset class="fs"><legend>Stap 1: kies de actie</legend><label class="f" for="cm-lib">Tekst uit de bibliotheek<select id="cm-lib"><option value="">Kies een tekst…</option>' + libs.map(i => '<option value="' + esc(i.id) + '"' + (i.id === x.libId ? ' selected' : '') + '>' + esc(i.title) + '</option>').join('') + '</select></label>' +
      '<div class="row"><button class="btn" data-act="camp-ai"' + (d.busy ? ' disabled' : '') + '>' + (d.busy ? 'Claude werkt…' : 'Laat Claude een voorstel maken') + '</button></div><p class="small muted">Claude leest de voorwaarden, kiest het type dat past en stelt alles voor. Jij past alles aan, ook het type.</p></fieldset>' +
      '<fieldset class="fs"><legend>Stap 2: controleer en pas aan</legend>' + kindSel + field('cm-title', 'Naam van de campagne', x.title, 'data-autofocus') + areaField('cm-summary', 'Korte uitleg voor de leden', x.summary) +
      '<div class="row">' + dateField('cm-start', 'Start', x.start) + dateField('cm-end', 'Einde', x.end) + '</div>' +
      areaField('cm-rules', 'Voorwaarden in het kort', x.rules, 'Een regel per punt. Alleen wat in de officiële tekst staat.') +
      (k === 'line' ? areaField('cm-crit', 'Controle bij het toevoegen van deelnemers', x.criteria, 'Wat moet kloppen per persoon, en welke kolom daarvoor nodig is. Claude gebruikt dit om geplakte lijsten te controleren.') +
        '<div class="row"><label class="f" for="cm-pv">Drempel (optioneel)<input type="number" id="cm-pv" min="0" value="' + esc((x.threshold && x.threshold.pv) || '') + '"></label>' + field('cm-pvl', 'Eenheid', (x.threshold && x.threshold.label) || 'PV') + '</div>' +
        field('cm-aud', 'Wie komt op de lijn?', x.audience, 'placeholder="Bijvoorbeeld: Brand Partners die de Welcome Back-mail kregen"') : '') +
      (k === 'points' ? '<div class="row"><label class="f" for="cm-period">Tellen per<select id="cm-period"><option value="month"' + (x.period !== 'total' ? ' selected' : '') + '>Maand</option><option value="total"' + (x.period === 'total' ? ' selected' : '') + '>Totaal over de hele periode</option></select></label><label class="f" for="cm-goal">Eigen doel (optioneel)<input type="number" id="cm-goal" min="0" value="' + esc(x.goal || '') + '"></label></div>' +
        areaField('cm-pts', 'Puntensoorten', ptsText, 'Een soort per regel: naam | uitleg | punten. Bijvoorbeeld: Enrol | 1 nieuwe Brand Partner met 100 PV | 1', true) : '') +
      (k === 'checklist' ? areaField('cm-tasks', 'Taken', tasksText, 'Een taak per regel: taak | uitleg | uiterste datum (jjjj-mm-dd, mag leeg)', true) : '') +
      msgArea +
      '<label class="f" for="cm-status">Status<select id="cm-status"><option value="draft"' + (x.status === 'draft' ? ' selected' : '') + '>Concept (alleen jij ziet het)</option><option value="active"' + (x.status === 'active' ? ' selected' : '') + '>Actief (alle leden zien het)</option><option value="ended"' + (x.status === 'ended' ? ' selected' : '') + '>Afgelopen</option></select></label></fieldset>' +
      btnRow('camp-save', d.id, isNew ? '' : 'camp-del');
  }
  if (d.type === 'camppoint') {
    const c = campById(d.id), types = c.pointTypes || [], names = [...new Set(allContacts().map(q => q.name).concat(campDoc(d.id).people.map(q => q.name)).concat((campDoc(d.id).entries || []).map(q => q.who).filter(Boolean)))];
    return '<h2>Punt noteren</h2><p class="small muted">' + esc(c.title) + '</p><label class="f" for="cpt-type">Soort<select id="cpt-type">' + types.map(t => '<option value="' + esc(t.id) + '"' + (t.id === d.t ? ' selected' : '') + '>' + esc(t.label) + ' (' + t.pts + ' p)</option>').join('') + '</select></label>' +
      '<label class="f" for="cpt-who">Over wie? (optioneel)<input type="text" id="cpt-who" list="cpt-names" autocomplete="off"><datalist id="cpt-names">' + names.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist></label>' +
      '<div class="row">' + dateField('cpt-date', 'Datum', todayKey()) + '<label class="f" for="cpt-pts">Punten<input type="number" id="cpt-pts" min="0" step="0.5" value="' + esc((types.find(t => t.id === d.t) || types[0] || {}).pts || 1) + '"></label></div>' +
      areaField('cpt-note', 'Notitie (optioneel)', '') + '<div class="row"><button class="btn" data-act="camp-pt-save" data-id="' + esc(d.id) + '">Opslaan</button><button class="btn ghost" data-act="overlay-close">Annuleer</button></div>';
  }
  if (d.type === 'camppeople') {
    const c = campById(d.id), doc = campDoc(d.id), have = new Set(doc.people.map(p => p.contactId).filter(Boolean)), cts = allContacts().filter(x => !have.has(x.id));
    return '<h2>Deelnemers toevoegen</h2><p class="small muted">' + esc(c.audience || 'Wie meedoet staat in de voorwaarden.') + '</p>' +
      areaField('cp-paste', 'Plak de lijst uit het Virtual Office', d.prefill || '', 'Plak liefst de hele tabel met kolomkoppen (zoals laatste bestelling of status). Dan controleert Claude of iedereen aan de voorwaarden voldoet. Alleen namen kan ook, maar dan is er niets te controleren.', true) +
      '<div><label class="btn ghost small" for="cpfile" style="cursor:pointer">CSV of tekstbestand laden</label><input id="cpfile" class="sr" type="file" accept=".txt,.csv,text/plain,text/csv" data-change="camp-file"></div>' +
      (cts.length ? '<fieldset class="fs"><legend>Of kies uit je contacten</legend><div style="max-height:220px;overflow:auto;display:flex;flex-direction:column;gap:6px">' + cts.map(x => '<label class="check"><input type="checkbox" class="cp-c" value="' + esc(x.id) + '"><span>' + esc(x.name) + ' <span class="muted small">' + esc(x.kind || 'Prospect') + '</span></span></label>').join('') + '</div></fieldset>' : '') +
      '<div class="row"><button class="btn" data-act="camp-people-save" data-id="' + esc(d.id) + '">Toevoegen</button><button class="btn ghost" data-act="overlay-close">Annuleer</button></div>';
  }
  if (d.type === 'campreview') {
    const it = d.items || [], n = s => it.filter(x => x.status === s).length;
    if (d.busy) return '<h2>Claude controleert de lijst</h2><p class="muted">' + esc(d.prog || 'Even geduld\u2026') + '</p>';
    return '<h2>Controle van de lijst</h2><div class="row"><span class="pill">Voldoet: ' + n('ok') + '</span>' + (n('no') ? '<span class="pill due">Voldoet niet: ' + n('no') + '</span>' : '') + (n('unknown') ? '<span class="pill">Niet te controleren: ' + n('unknown') + '</span>' : '') + '</div>' +
      '<p class="small muted">Claude controleert alleen op de kolommen die je plakte. De offici\u00eble voorwaarden in het Virtual Office gaan voor. Mensen die niet voldoen staan standaard uit.</p>' +
      '<div style="max-height:320px;overflow:auto;display:flex;flex-direction:column;gap:8px">' + it.map((x, k) => '<label class="check"><input type="checkbox" class="cr-i" value="' + k + '"' + (x.status !== 'no' ? ' checked' : '') + '><span><b>' + esc(x.name) + '</b> ' + (x.status === 'ok' ? '<span class="pill">Voldoet</span>' : x.status === 'no' ? '<span class="pill due">Voldoet niet</span>' : '<span class="pill">Niet te controleren</span>') + (x.why ? '<br><span class="small muted">' + esc(x.why) + '</span>' : '') + '</span></label>').join('') + '</div>' +
      '<div class="row"><button class="btn" data-act="camp-review-save" data-id="' + esc(d.id) + '">Toevoegen</button><button class="btn ghost" data-act="overlay-close">Annuleer</button></div>';
  }
  if (d.type === 'camptpl') {
    const c = campById(d.id), doc = campDoc(d.id), vo = profile() && profile().voice;
    return '<h2>Mijn berichten</h2><p class="small muted">' + esc(c.title) + '. Gebruik {naam} voor de voornaam. De coach gebruikt jouw tekst als basis voor elk bericht.</p>' +
      c.steps.filter(s => s.msg || (doc.msgs || {})[s.id]).map(s => areaField('mt-' + s.id, s.label, d.fill && d.fill[s.id] != null ? d.fill[s.id] : campTpl(c, s))).join('') +
      '<div class="row"><button class="btn" data-act="camp-tpl-save" data-id="' + esc(d.id) + '">Opslaan</button><button class="btn ghost" data-act="camp-tpl-ai" data-id="' + esc(d.id) + '"' + (d.busy ? ' disabled' : '') + '>' + (d.busy ? 'Claude schrijft\u2026' : 'Herschrijf in mijn stijl') + '</button><button class="btn ghost" data-act="camp-tpl-reset" data-id="' + esc(d.id) + '">Standaard terug</button><button class="btn ghost" data-act="overlay-close">Annuleer</button></div>' +
      (vo ? '' : '<p class="small muted">Tip: vul bij Instellingen een voorbeeld van je schrijfstijl in, dan klinkt de herschrijving echt als jou.</p>');
  }
  if (d.type === 'campperson') {
    const c = campById(d.camp), p = campDoc(d.camp).people.find(x => x.id === d.id) || {}, th = c.threshold && c.threshold.pv;
    return '<h2>Deelnemer bewerken</h2>' + field('cpp-name', 'Naam', p.name, 'data-autofocus') + '<label class="f" for="cpp-step">Stap<select id="cpp-step">' + c.steps.map(s => '<option value="' + esc(s.id) + '"' + (s.id === (c.steps[campStepIdx(c, p)] || {}).id ? ' selected' : '') + '>' + esc(s.label) + '</option>').join('') + '</select></label>' +
      (th ? '<label class="f" for="cpp-pv">' + esc(c.threshold.label || 'PV') + ' tot nu toe<input type="number" id="cpp-pv" min="0" value="' + esc(p.pv || '') + '"></label>' : '') + areaField('cpp-note', 'Notitie', p.note) + campInfoHtml(p) +
      '<div class="row"><button class="btn" data-act="camp-person-save" data-id="' + esc(d.id) + '" data-camp="' + esc(d.camp) + '">Opslaan</button><button class="btn ghost" data-act="overlay-close">Annuleer</button><span class="spacer"></span><button class="btn danger" data-act="camp-person-del" data-id="' + esc(d.id) + '" data-camp="' + esc(d.camp) + '">Van de lijn halen</button></div>';
  }
  if (d.type === 'campmsg') {
    return '<h2>Bericht voor ' + esc(d.name) + '</h2><p class="small muted">Concept van de coach. Pas aan en verstuur het zelf.</p>' + campInfoHtml((campDoc(d.camp).people || []).find(x => x.id === d.id)) + '<div class="brief" id="campmsgOut" aria-live="polite">' + (d.text ? md(d.text) : '<p class="muted">Het bericht wordt gemaakt…</p>') + '</div><div class="row"><button class="btn" data-act="camp-msg-copy">Kopieer</button><button class="btn ghost" data-act="camp-msg-std" data-id="' + esc(d.id) + '">Standaardtekst</button><button class="btn ghost" data-act="camp-msg-again" data-id="' + esc(d.id) + '">Ander concept</button><button class="btn ghost" data-act="overlay-close">Sluiten</button></div>';
  }
  return null;
}
function campVoMock() {
  const c = state.camp.id ? campById(state.camp.id) : null;
  const rows = [['Mila de Vries', 'Welcome Back-mail ontvangen'], ['Joost Bakker', 'Welcome Back-mail ontvangen'], ['Fenna Jacobs', 'Welcome Back-mail ontvangen']];
  return '<div class="mockrow"><span class="ico">' + ICON.team + '</span><span style="flex:1"><b>Virtual Office verbinden</b><br><span class="small muted">Met jouw toestemming, nooit met een wachtwoord</span></span></div>' +
    '<div class="brief"><p class="eyebrow">Zo zou het eruitzien: gevonden in jouw organisatie</p><ul class="plain">' + rows.map(r => '<li>' + esc(r[0]) + ' <span class="muted">— ' + esc(r[1]) + '</span></li>').join('') + '</ul></div>' +
    '<div class="row"><button class="btn" data-act="mock-noop">Verbinden</button></div><p class="small muted">Er bestaat nog geen officiële koppeling met Young Living. Tot die er is, plak je de namen uit het Virtual Office. Dat doet precies hetzelfde in de lijn.</p>' +
    (c ? '<div class="row"><button class="btn ghost" data-act="camp-people" data-id="' + esc(c.id) + '">Namen plakken of uploaden</button></div>' : '');
}

/* ---------- eigen berichten ---------- */
const campTpl = (c, st) => { const o = (campDoc(c.id).msgs || {})[st.id]; return o != null && o !== '' ? o : (st.msg || ''); };
function campMsgSettings() {
  const list = sh('campaigns').filter(c => c.status === 'active' || (store.isAdmin && c.status === 'draft'));
  return '<section class="card" aria-labelledby="h-mt"><h2 id="h-mt">Mijn berichten</h2><p class="small muted">Alle voorbeeldberichten die Lumo voorstelt, kun je hier in je eigen stijl zetten. Dan klinken ze als jij.</p>' +
    (list.length ? list.map(c => '<div class="row"><span style="flex:1"><b>' + esc(c.title) + '</b><br><span class="small muted">' + (c.steps || []).filter(s => s.msg).length + ' voorbeeldberichten' + (Object.keys(campDoc(c.id).msgs || {}).length ? ', ' + Object.keys(campDoc(c.id).msgs).length + ' aangepast' : '') + '</span></span><button class="btn ghost small" data-act="camp-tpl" data-id="' + esc(c.id) + '">Aanpassen</button></div>').join('') : '<p class="muted">Zodra er een campagne loopt, vind je hier de berichten ervan.</p>') + '</section>';
}

/* ---------- AI: voorstel en berichten ---------- */
async function campPropose(libId) {
  const it = libAll().find(x => x.id === libId); if (!it) throw { code: 'nolib' };
  const msgRule = 'conceptbericht aan de ontvanger met {naam}, vriendelijk, zonder druk, zonder inkomstenbeloften en zonder gezondheidsclaims';
  const prompt = 'Maak een campagnevoorstel voor een Young Living-actie, alleen op basis van de onderstaande voorwaardentekst. Verzin niets: staat een datum, drempel, doel of beloning er niet, laat het veld leeg.\n\nTEKST: ' + it.title + '\n' + it.text.slice(0, 9000) +
    '\n\nKies eerst het TYPE dat echt bij deze actie past:\n- "line": de actie draait om andere mensen (klanten of teamleden) die je elk langs stappen begeleidt, bijvoorbeeld mensen die een mail kregen en een bestelling moeten plaatsen.\n- "points": de actie draait om punten of aantallen die je zelf verzamelt, per maand of in totaal (bijvoorbeeld een puntenspel waarin je prijzen wint).\n- "checklist": de actie vraagt een vaste reeks taken of mijlpalen van jezelf, eventueel met data.\n- "info": alleen informatie, er valt niets bij te houden.\n\nGeef uitsluitend JSON. Altijd: {"kind": "line"|"points"|"checklist"|"info", "title": korte naam, "summary": twee zinnen voor leden, geen inkomstenbeloften, "rules": een regel per punt met de belangrijkste voorwaarden (regels gescheiden door \\n, begin elke regel met "- "), "start": "jjjj-mm-dd" of "", "end": "jjjj-mm-dd" of ""}.\nBij "line" extra: "threshold": {"pv": getal, "label": "PV"} of null, "audience": een zin: welke mensen komen op de lijn, "criteria": een regel per toetsbare voorwaarde per persoon met de kolom die daarvoor nodig is, "steps": 4 tot 7 stappen {"label": korte naam, "hint": een zin wat het lid nu doet, "msg": ' + msgRule + '; leeg bij de laatste stap}. De eerste stap is het begin van de lijn en de laatste betekent klaar of beloning ontvangen.\nBij "points" extra: "period": "month" of "total", "goal": getal of null (alleen als de tekst een doel noemt), "pointTypes": een lijst {"label": naam, "hint": een zin wat er voor nodig is, "pts": getal punten}, één per manier om punten te verdienen, precies zoals in de tekst, "steps": 2 tot 4 voorbeeldberichten {"label","hint","msg": ' + msgRule + '} voor mensen die je uitnodigt of helpt.\nBij "checklist" extra: "tasks": {"label","hint","due": "jjjj-mm-dd" of ""}, "steps": 0 tot 3 voorbeeldberichten.\nBij "info" extra: "steps": 0 tot 3 voorbeeldberichten.';
  return aiJSON(prompt);
}
async function campMsgRun() {
  const d = state.dialog; if (!d || d.type !== 'campmsg') return;
  const c = campById(d.camp), p = campDoc(d.camp).people.find(x => x.id === d.id); if (!c || !p) return;
  const st = c.steps[campStepIdx(c, p)];
  d.text = ''; d.busy = true; const el = $('#campmsgOut'); if (el) el.innerHTML = '<p class="muted">Het bericht wordt gemaakt…</p>';
  try {
    const full = await aiStream('Schrijf een kort bericht aan ' + p.name + ' voor de campagne "' + c.title + '", in de stap "' + st.label + '". Mijn eigen voorbeeldbericht voor deze stap (houd de stem en inhoud aan): ' + (campFirstStepMsg(c, p, { msg: campTpl(c, st) }) || st.hint || '-') + '. Uitleg van de campagne: ' + (c.summary || '-') + '\nVoorwaarden:\n' + (c.rules || '-') + '\nGebruik alleen deze voorwaarden, noem geen bedragen of data die er niet staan en schrijf geen inkomstenbeloften of gezondheidsclaims. Geef één concept dat ik zelf kan versturen, zonder uitleg eromheen.', null, t => { d.text = t; const o = $('#campmsgOut'); if (o) o.innerHTML = md(t); });
    if (full) d.text = full;
  } catch (e) { d.text = d.text || (e && e.code === 'none' ? 'De coach is in deze weergave niet beschikbaar.' : aiErr(e)); }
  d.busy = false; const o = $('#campmsgOut'); if (o) o.innerHTML = md(d.text);
}

/* ---------- deelnemers inlezen en controleren ---------- */
const campSplit = l => l.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.replace(/^"|"$/g, '').trim());
function campNameOf(cells) {
  let name = cells.find(c => /[A-Za-zÀ-ɏ]{2,}/.test(c) && !/@/.test(c) && !/^\d+$/.test(c) && !/^\d{1,4}[-\/.]\d{1,2}[-\/.]\d{1,4}$/.test(c)) || '';
  return name.replace(/^\d+[\).\-\s]+/, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}
function campInfoOf(header, cells, name) {
  if (!header) return [];
  const out = [], nm = normName(name);
  cells.forEach((v, i) => { const k = String(header[i] || '').trim(), val = String(v || '').trim(); if (!k || !val || normName(val) === nm) return; out.push({ k: k.slice(0, 40), v: val.slice(0, 120) }); });
  return out.slice(0, 16);
}
const campIsPhone = (k, v) => /\b(tel|telefoon\w*|gsm\w*|mobiel|mobile|phone)\b/i.test(k) || (/^[+0][\d\s().\/-]{8,}$/.test(v) && v.replace(/\D/g, '').length >= 9 && v.replace(/\D/g, '').length <= 15);
function campInfoHtml(p) {
  const info = p && p.info || []; if (!info.length) return '';
  return '<details class="pinfo"><summary>Gegevens uit je lijst (' + info.length + ')</summary><dl>' + info.map(x => '<dt>' + esc(x.k) + '</dt><dd>' + (campIsPhone(x.k, x.v) ? '<a href="tel:' + esc(x.v.replace(/[^\d+]/g, '')) + '">' + esc(x.v) + '</a>' : esc(x.v)) + '</dd>').join('') + '</dl></details>';
}

/* ---------- hele organisatie uit het rapport ---------- */
function orgDate(v) {
  v = String(v || '').trim(); let m;
  if ((m = v.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
  if ((m = v.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/))) { const a = +m[1], b = +m[2], us = v.indexOf('/') >= 0 && a <= 12 && !(b <= 12 && a > 12); const mo = us ? a : b, da = us ? b : a; if (mo > 12 || mo < 1 || da > 31 || da < 1) return ''; return m[3] + '-' + ('0' + mo).slice(-2) + '-' + ('0' + da).slice(-2); } // met schuine strepen: Amerikaans (maand/dag/jaar), zoals het Virtual Office
  return '';
}
function orgDialog(d) {
  if (d.type === 'orgpaste') return '<h2>Mijn organisatie importeren</h2><p class="small muted">Plak de tabel uit het Virtual Office of laad het CSV-bestand. Iedereen komt bij Mensen onder Teamleden, met sponsor, enroller en gsm erbij. Wie er al staat wordt bijgewerkt.</p>' +
    areaField('org-paste', 'Plak de lijst', d.prefill || '', 'Met kolomkoppen, bijvoorbeeld Name, Sponsor Name, Enroller Name, Phone.') +
    '<div><label class="btn ghost small" for="orgfile" style="cursor:pointer">CSV of tekstbestand laden</label><input id="orgfile" class="sr" type="file" accept=".txt,.csv,.tsv,text/plain,text/csv" data-change="org-file"></div>' +
    '<div class="row"><button class="btn" data-act="org-parse">Controleren</button><button class="btn ghost" data-act="overlay-close">Annuleer</button></div>';
  if (d.type === 'orgreview') {
    const p = orgPlan(d.rows || []), first = d.rows && d.rows[0] ? d.rows[0].name : '';
    return '<h2>Mijn organisatie</h2><p><b>' + (p.fresh.length + p.upd.length) + '</b> mensen in het rapport: <b>' + p.klanten + '</b> klanten (waarvan <b>' + p.lr + '</b> met Loyalty Rewards) en <b>' + p.team + '</b> teamleden.</p>' +
      '<p class="small muted">' + p.fresh.length + ' nieuw, ' + p.upd.length + ' staan er al en worden bijgewerkt' + (p.stale.length ? '. ' + p.stale.length + ' oude regels (met een verkeerde naam uit een eerdere import) worden vervangen' : '') + '.' + (first ? ' Eerste naam in de lijst: ' + esc(first) + '.' : '') + '</p>' +
      (d.hasHeader ? '' : '<p class="small">Zonder kolomkoppen kan ik geen niveau, PV of Loyalty Rewards bewaren.</p>') +
      '<div class="row"><button class="btn" data-act="org-save">Toevoegen</button><button class="btn ghost" data-act="overlay-close">Annuleer</button></div>';
  }
  return '';
}
function campParseRows(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim()), rows = lines.map(campSplit);
  const numLike = c => /^\d+([.,]\d+)?$/.test(c) || /\d{1,4}[-\/.]\d{1,2}[-\/.]\d{1,4}/.test(c);
  const isHead = r => r.filter(Boolean).length > 1 && r.filter(Boolean).every(c => !numLike(c));
  let hi = -1; for (let i = 0; i < Math.min(rows.length - 1, 12); i++) { if (isHead(rows[i]) && rows[i + 1].filter(Boolean).length > 1 && !isHead(rows[i + 1])) { hi = i; break; } }
  if (hi < 0 && rows.length > 1 && isHead(rows[0])) hi = 0;
  const header = hi >= 0 ? rows[hi] : null;
  const out = [], seen = new Set();
  const nameCol = header ? header.findIndex(h => /^(account\s*name|name|naam|member\s*name|full\s*name)$/i.test(String(h).trim())) : -1;
  rows.forEach((cells, ri) => {
    if (header && ri <= hi) return;
    const name = nameCol >= 0 && cells[nameCol] ? String(cells[nameCol]).replace(/\s+/g, ' ').trim().slice(0, 80) : campNameOf(cells);
    if (!name || /^(naam|name|member|lid|brand partner|id|downline|rank|status)$/i.test(name)) return;
    const k = normName(name); if (!k || seen.has(k)) return; seen.add(k); out.push({ name, cells, idx: ri - (hi >= 0 ? hi : -1), info: campInfoOf(header, cells, name) });
  });
  return { header, rows: out, hasData: out.some(r => r.cells.filter(Boolean).length > 1) };
}
const campParseNames = text => campParseRows(text).rows.map(r => r.name);

async function campCheck(c, parsed, onProgress) {
  const res = parsed.rows.map(r => ({ name: r.name, cells: r.cells, info: r.info || [], status: 'unknown', why: 'Alleen de naam is bekend, dus niet te controleren.' }));
  if (!parsed.hasData) return res;
  const rules = (c.criteria ? 'CONTROLECRITERIA:\n' + c.criteria + '\n\n' : '') + 'VOORWAARDEN:\n' + (c.rules || '-') + '\nWie komt op de lijn: ' + (c.audience || '-') + '\nPeriode: ' + (c.start || '?') + ' tot ' + (c.end || '?') + '. Vandaag is ' + todayKey() + '.';
  const size = 25;
  for (let a = 0; a < res.length; a += size) {
    const chunk = res.slice(a, a + size);
    const table = (parsed.header ? 'KOLOMMEN: ' + parsed.header.join(' | ') + '\n' : 'Geen kolomkoppen.\n') + chunk.map((r, k) => (a + k) + ' | ' + r.cells.join(' | ')).join('\n');
    const prompt = 'Beoordeel elke deelnemer hieronder: voldoet die persoon aan de voorwaarden van de actie? Baseer je ALLEEN op de kolommen die zijn gegeven. Staat er gegeven niet in, kies dan "unknown" en zeg welk gegeven ontbreekt. Raad niet.\n\n' + rules + '\n\nDEELNEMERS (nummer | kolommen)\n' + table + '\n\nGeef uitsluitend JSON: {"results":[{"i": nummer, "status": "ok" of "no" of "unknown", "why": korte reden in het Nederlands, maximaal 18 woorden}]} voor elk nummer.';
    try {
      const r = await aiJSON(prompt), list = Array.isArray(r) ? r : (r && r.results) || [];
      list.forEach(x => { const t = res[Number(x.i)]; if (t && ['ok', 'no', 'unknown'].includes(x.status)) { t.status = x.status; t.why = String(x.why || '').slice(0, 160); } });
    } catch (e) { chunk.forEach(t => { t.why = 'De controle lukte niet voor deze groep. Probeer het opnieuw.'; }); }
    if (onProgress) onProgress(Math.min(res.length, a + size), res.length);
  }
  return res;
}

/* ---------- delen met je upline ---------- */
let campSig = '';
function syncCamps() {
  if (!state.ready) return;
  const me = meId(), p = profile(); if (!p) return;
  const camps = {};
  sh('campaigns').forEach(c => {
    const doc = state.docs['camp-' + c.id]; if (!doc || !doc.share || doc.share === 'off') return;
    if (campKind(c) === 'points') { const e = doc.entries || [], mk = todayKey().slice(0, 7); camps[c.id] = { points: campSum(e), month: campSum(e.filter(z => campMonthKey(z.date) === mk)), total: e.length }; return; }
    if (campKind(c) !== 'line') return;
    const counts = campCounts(c, doc.people), x = { counts, total: doc.people.length };
    if (doc.share === 'names') x.names = doc.people.map(q => ({ name: q.name, step: (c.steps[campStepIdx(c, q)] || {}).id || '' }));
    camps[c.id] = x;
  });
  const has = Object.keys(camps).length, sig = JSON.stringify(camps);
  if (has && sig !== campSig) { campSig = sig; putShared('campshares', me, { name: p.name, camps, updatedAt: new Date().toISOString() }); }
  else if (!has && campSig) { campSig = ''; dropShared('campshares', me); }
}

function campAddPeople(id, items, pickedIds, fromReview, inboxId) {
  const c = campById(id), doc = clone(campDoc(id)); doc.people = doc.people || []; doc.share = doc.share || 'off';
  const have = new Set(doc.people.map(p => normName(p.name))), first = c.steps[0].id, now = new Date().toISOString(), contacts = allContacts(); let added = 0, upd = 0, dup = 0, linked = 0, bad = 0;
  const add = (name, contactId, check, info) => { const k = normName(name); if (!k) { dup++; return; } if (have.has(k)) { const ex = doc.people.find(q => normName(q.name) === k); if (ex && info && info.length) { ex.info = info; upd++; } dup++; return; } have.add(k); const m = contactId ? state.docs[contactId] : contacts.find(x => normName(x.name) === k); if (m) linked++; if (check && check.status === 'no') bad++; doc.people.push({ id: uid('cp'), name, step: first, contactId: m ? m.id : '', pv: 0, note: '', updated: now, check: check || null, info: info && info.length ? info : undefined }); added++; };
  items.forEach(x => add(x.name, '', x.check, x.info));
  (pickedIds || []).forEach(cid => { const ct = state.docs[cid]; if (ct) add(ct.name, cid, null); });
  saveCamp(id, doc); state.dialog = null; state.camp.q = ''; render(); if (inboxId && window.__lumoWeb && window.__lumoWeb.inbox) window.__lumoWeb.inbox.remove(inboxId).then(() => webInboxLoad(true), () => {});
  toast(added + ' toegevoegd' + (linked ? ', ' + linked + ' gekoppeld aan je contacten' : '') + (dup ? ', ' + dup + ' stonden er al op' : '') + (upd ? ' (gegevens bijgewerkt bij ' + upd + ')' : '') + (bad ? '. Let op: ' + bad + ' voldoen mogelijk niet' : '') + (!fromReview && items.length ? '. Niet gecontroleerd op de voorwaarden.' : '.'));
}

/* ---------- acties ---------- */
async function campAct(a, d, el) {
  if (String(a).indexOf('org-') === 0 && orgAct(a, d)) return true;
  const val2 = id => { const e = $('#' + id); return e ? e.value : ''; };
  if (a === 'camp-open') { state.view = 'team'; state.sub.team = 'Campagnes'; state.camp.id = d.id; state.camp.month = null; state.camp.filter = 'Alles'; state.camp.q = ''; state.camp.limit = 30; state.dialog = null; render(); window.scrollTo(0, 0); return true; }
  if (a === 'camp-back') { state.camp.id = null; render(); return true; }
  if (a === 'camp-view') { state.camp.view = d.v; if (d.v === 'board') state.camp.filter = 'Alles'; render(); return true; }
  if (a === 'camp-filter') { state.camp.filter = d.f; state.camp.limit = 30; render(); return true; }
  if (a === 'camp-new') { state.dialog = { type: 'campedit', id: 'new', draft: { status: 'draft', steps: [], threshold: null } }; state.focusNext = false; render(); return true; }
  if (a === 'camp-edit') { const c = campById(d.id); state.dialog = { type: 'campedit', id: d.id, draft: clone(c) }; render(); return true; }
  if (a === 'camp-ai') {
    const dlg = state.dialog, libId = val2('cm-lib'); if (!libId) { toast('Kies eerst een tekst uit de bibliotheek.'); return true; }
    dlg.draft = Object.assign(campReadDraft(dlg), { libId }); dlg.busy = true; render();
    try {
      const r = await campPropose(libId), kind = CAMP_KINDS[r.kind] ? r.kind : 'line', lim = (v, n) => String(v || '').slice(0, n);
      const steps = (r.steps || []).slice(0, 8).map((q, i) => ({ id: 's' + (i + 1), label: lim(q.label || 'Stap ' + (i + 1), 60), hint: lim(q.hint, 240), msg: lim(q.msg, 700) }));
      const date = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
      const nd = { libId, kind, status: dlg.draft.status || 'draft', title: lim(r.title, 90), summary: lim(r.summary, 400), rules: lim(r.rules, 2500), start: date(r.start), end: date(r.end), steps };
      if (kind === 'line') Object.assign(nd, { audience: lim(r.audience, 240), criteria: Array.isArray(r.criteria) ? r.criteria.map(q => '- ' + String(q).replace(/^-\s*/, '')).join('\n').slice(0, 1500) : lim(r.criteria, 1500), threshold: r.threshold && Number(r.threshold.pv) > 0 ? { pv: Number(r.threshold.pv), label: lim(r.threshold.label || 'PV', 12) } : null });
      if (kind === 'points') Object.assign(nd, { period: r.period === 'total' ? 'total' : 'month', goal: Number(r.goal) > 0 ? Number(r.goal) : '', pointTypes: (r.pointTypes || []).slice(0, 12).map((q, i) => ({ id: 'p' + (i + 1), label: lim(q.label || 'Punt ' + (i + 1), 60), hint: lim(q.hint, 300), pts: Number(q.pts) || 1 })) });
      if (kind === 'checklist') nd.tasks = (r.tasks || []).slice(0, 20).map((q, i) => ({ id: 't' + (i + 1), label: lim(q.label || 'Taak ' + (i + 1), 80), hint: lim(q.hint, 300), due: date(q.due) }));
      dlg.draft = nd;
    } catch (e) { toast(e && e.code === 'none' ? 'De coach is in deze weergave niet beschikbaar.' : e && e.code === 'nolib' ? 'Die tekst is niet gevonden.' : 'Claude kon geen voorstel maken. Probeer het opnieuw.'); }
    dlg.busy = false; render(); return true;
  }
  if (a === 'camp-save') {
    const x = campReadDraft(state.dialog), k = campKind(x);
    if (!String(x.title || '').trim()) { toast('Geef de campagne een naam.'); return true; }
    if (k === 'line' && (x.steps || []).length < 2) { toast('Een lijn heeft minstens twee stappen.'); return true; }
    if (k === 'points' && !(x.pointTypes || []).length) { toast('Voeg minstens één puntensoort toe.'); return true; }
    if (k === 'checklist' && !(x.tasks || []).length) { toast('Voeg minstens één taak toe.'); return true; }
    const old = d.id === 'new' ? null : campById(d.id);
    const data = { kind: k, title: String(x.title).trim(), summary: String(x.summary || '').trim(), start: x.start || '', end: x.end || '', rules: String(x.rules || '').trim(), steps: x.steps || [], status: x.status || 'draft', libId: x.libId || (old && old.libId) || val2('cm-lib') || '', updatedAt: new Date().toISOString() };
    if (k === 'line') Object.assign(data, { audience: String(x.audience || '').trim(), criteria: String(x.criteria || '').trim(), threshold: x.threshold || null });
    if (k === 'points') Object.assign(data, { period: x.period === 'total' ? 'total' : 'month', goal: Number(x.goal) > 0 ? Number(x.goal) : '', pointTypes: x.pointTypes });
    if (k === 'checklist') data.tasks = x.tasks;
    const id = d.id === 'new' ? uid('camp') : d.id;
    if (await putShared('campaigns', id, data)) { state.dialog = null; state.camp.id = id; state.camp.month = null; render(); toast(data.status === 'active' ? 'Campagne staat aan voor alle leden.' : 'Campagne bewaard.'); }
    return true;
  }
  if (a === 'camp-month') { state.camp.month = d.m; render(); return true; }
  if (a === 'camp-pt-add') { const c = campById(state.camp.id); if (!(c.pointTypes || []).length) { toast('Er zijn nog geen puntensoorten.'); return true; } state.dialog = { type: 'camppoint', id: c.id, t: d.t }; render(); return true; }
  if (a === 'camp-pt-save') {
    const id = state.camp.id, c = campById(id), t = (c.pointTypes || []).find(q => q.id === val2('cpt-type')); if (!t) return true;
    const doc = clone(campDoc(id)); doc.entries = doc.entries || [];
    doc.entries.push({ id: uid('pt'), type: t.id, who: val2('cpt-who').trim().slice(0, 80), date: val2('cpt-date') || todayKey(), pts: Number(val2('cpt-pts')) || t.pts || 1, note: val2('cpt-note').trim().slice(0, 300) });
    saveCamp(id, doc); state.dialog = null; render(); toast('Genoteerd: ' + t.label); return true;
  }
  if (a === 'camp-pt-del') { const id = state.camp.id, doc = clone(campDoc(id)); doc.entries = (doc.entries || []).filter(e => e.id !== d.id); saveCamp(id, doc); render(); return true; }
  if (a === 'camp-copytpl') { const c = campById(state.camp.id), st = (c.steps || []).find(q => q.id === d.id); if (st) { const nm = ($('#cmname') || {}).value; copyText(campTpl(c, st).replace(/\{naam\}/gi, (nm || '').trim().split(' ')[0] || '…')); } return true; }
  if (a === 'camp-del') { if (await dropShared('campaigns', d.id)) { state.dialog = null; state.camp.id = null; render(); } return true; }
  if (a === 'camp-people') { state.dialog = { type: 'camppeople', id: d.id }; render(); return true; }
  if (a === 'camp-people-save') {
    const c = campById(d.id), parsed = campParseRows(val2('cp-paste')), picked = [...document.querySelectorAll('.cp-c:checked')].map(b => b.value);
    if (!parsed.rows.length && !picked.length) { toast('Plak de lijst of kies contacten.'); return true; }
    if (parsed.rows.length && parsed.hasData && (c.criteria || c.rules)) {
      state.dialog = { type: 'campreview', id: d.id, inboxId: state.dialog && state.dialog.inboxId, busy: true, items: [], picked, prog: 'Claude leest ' + parsed.rows.length + ' regels…' }; render();
      const dlg = state.dialog;
      const res = await campCheck(c, parsed, (n, t) => { if (state.dialog === dlg) { dlg.prog = n + ' van ' + t + ' gecontroleerd…'; const sec = document.querySelector('.sheet .muted'); if (sec) sec.textContent = dlg.prog; } });
      if (state.dialog !== dlg) return true;
      dlg.items = res; dlg.busy = false; render(); return true;
    }
    campAddPeople(d.id, parsed.rows.map(r => ({ name: r.name, info: r.info })), picked, false, state.dialog && state.dialog.inboxId); return true;
  }
  if (a === 'camp-review-save') {
    const dlg = state.dialog, chosen = [...document.querySelectorAll('.cr-i:checked')].map(b => dlg.items[Number(b.value)]).filter(Boolean);
    campAddPeople(d.id, chosen.map(x => ({ name: x.name, info: x.info, check: { status: x.status, why: x.why } })), dlg.picked || [], true, dlg.inboxId); return true;
  }
  if (a === 'camp-more') { state.camp.limit = (state.camp.limit || 30) + 30; render(); return true; }
  if (a === 'camp-tpl') { state.dialog = { type: 'camptpl', id: d.id }; render(); return true; }
  if (a === 'camp-tpl-save') {
    const c = campById(d.id), doc = clone(campDoc(d.id)); doc.msgs = doc.msgs || {};
    c.steps.forEach(s => { const e = $('#mt-' + s.id); if (!e) return; const v = e.value.trim(); if (!v || v === (s.msg || '').trim()) delete doc.msgs[s.id]; else doc.msgs[s.id] = v; });
    saveCamp(d.id, doc); state.dialog = null; render(); toast('Je berichten zijn bewaard.'); return true;
  }
  if (a === 'camp-tpl-reset') { const doc = clone(campDoc(d.id)); doc.msgs = {}; saveCamp(d.id, doc); state.dialog = { type: 'camptpl', id: d.id }; render(); toast('De standaardberichten zijn terug.'); return true; }
  if (a === 'camp-tpl-ai') {
    const dlg = state.dialog, c = campById(d.id), cur = {}; c.steps.forEach(s => { const e = $('#mt-' + s.id); if (e) cur[s.id] = e.value; });
    dlg.fill = cur; dlg.busy = true; render();
    try {
      const r = await aiJSON('Herschrijf deze voorbeeldberichten in de stijl van het lid (zie schrijfstijl in het profiel). Behoud de inhoud, de volgorde en {naam}. Geen inkomstenbeloften, geen gezondheidsclaims, geen druk, geen nieuwe bedragen of data. Berichten per stap-id: ' + JSON.stringify(cur) + '\nGeef uitsluitend JSON: {"msgs": {"<stap-id>": "<herschreven bericht>"}}');
      const m = (r && r.msgs) || r || {}; dlg.fill = Object.assign({}, cur, Object.fromEntries(Object.keys(cur).filter(k => typeof m[k] === 'string' && m[k].trim()).map(k => [k, m[k].trim().slice(0, 900)])));
      toast('Controleer de berichten en klik op Opslaan.');
    } catch (e) { toast('Het herschrijven lukte niet. Probeer het opnieuw.'); }
    dlg.busy = false; render(); return true;
  }
  if (a === 'camp-next') { const id = state.camp.id, c = campById(id), doc = clone(campDoc(id)), p = doc.people.find(x => x.id === d.id); if (!p) return true; const i = campStepIdx(c, p); if (i < c.steps.length - 1) { p.step = c.steps[i + 1].id; p.updated = new Date().toISOString(); saveCamp(id, doc); render(); toast(p.name + ': ' + c.steps[i + 1].label); } return true; }
  if (a === 'camp-person') { state.dialog = { type: 'campperson', id: d.id, camp: state.camp.id }; render(); return true; }
  if (a === 'camp-person-save') {
    const doc = clone(campDoc(d.camp)), p = doc.people.find(x => x.id === d.id); if (!p) return true; const name = val2('cpp-name').trim(); if (!name) { toast('Geef een naam in.'); return true; }
    const ns = val2('cpp-step'); if (ns !== p.step) p.updated = new Date().toISOString(); p.name = name; p.step = ns; p.note = val2('cpp-note').trim(); if ($('#cpp-pv')) p.pv = Number(val2('cpp-pv')) || 0;
    saveCamp(d.camp, doc); state.dialog = null; render(); return true;
  }
  if (a === 'camp-person-del') { const doc = clone(campDoc(d.camp)); doc.people = doc.people.filter(x => x.id !== d.id); saveCamp(d.camp, doc); state.dialog = null; render(); return true; }
  if (a === 'camp-msg') { const c = campById(state.camp.id), p = campDoc(c.id).people.find(x => x.id === d.id); state.dialog = { type: 'campmsg', id: d.id, camp: c.id, name: p.name, text: '', busy: false }; render(); campMsgRun(); return true; }
  if (a === 'vo-seen') { voOrders().filter(e => !e.seen).forEach(e => { const d = Object.assign({}, state.docs[e.id], { seen: true }); save(e.id, d); }); render(); return true; }
  if (a === 'vo-notify') { if (typeof Notification !== 'undefined') Notification.requestPermission().then(() => render()); return true; }
  if (a === 'org-import') { state.dialog = { type: 'orgpaste' }; render(); return true; }
  if (a === 'org-parse') {
    const text = val('org-paste'); if (!text.trim()) { toast('Plak eerst de lijst of laad een bestand.'); return true; }
    const parsed = campParseRows(text); if (!parsed.rows.length) { toast('Ik vond geen namen. Controleer de lijst.'); return true; }
    state.dialog = { type: 'orgreview', rows: parsed.rows.map(r => ({ name: r.name, info: orgExtra(parsed.header, r.cells, r.name), yl: orgYL(parsed.header, r.cells, r.idx) })), inboxId: state.dialog && state.dialog.inboxId, hasHeader: !!parsed.header }; render(); return true;
  }
  if (a === 'org-save') { orgSave(state.dialog); return true; }
  if (a === 'camp-msg-std') { const dl = state.dialog; if (!dl || dl.type !== 'campmsg') return true; const c = campById(dl.camp), p = campDoc(dl.camp).people.find(x => x.id === dl.id); if (!c || !p) return true; const st = c.steps[campStepIdx(c, p)]; dl.text = campFirstStepMsg(c, p, { msg: campTpl(c, st) }) || st.hint || ''; const o = $('#campmsgOut'); if (o) o.innerHTML = md(dl.text); return true; }
  if (a === 'camp-msg-again') { campMsgRun(); return true; }
  if (a === 'camp-msg-copy') { if (state.dialog && state.dialog.text) copyText(state.dialog.text); return true; }
  return false;
}

/* ---------- organisatie: klanten, teamleden en netwerk (uit het Downline Viewer-rapport) ---------- */
const orgNum = v => { const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const orgKey = h => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ORG_MAPPED = ['level', 'pv', 'ogv', 'pgv', 'mwo', 'autoshipday', 'commissionqualified', 'accountstatus', 'customertype', 'activationdate', 'addresscity', 'phone', 'accountname', 'name', 'naam'];
function orgYL(header, cells, idx) {
  const m = {}; (header || []).forEach((h, i) => { const k = orgKey(h); if (k && m[k] === undefined) m[k] = String(cells[i] == null ? '' : cells[i]).trim(); });
  const g = (...ks) => { for (const k of ks) if (m[k]) return m[k]; return ''; };
  const au = g('autoshipday', 'autoship', 'loyaltyrewardsday');
  return { i: idx || 0, lvl: Math.round(orgNum(g('level'))), pv: orgNum(g('pv')), ogv: orgNum(g('ogv')), pgv: orgNum(g('pgv')), mwo: g('mwo') === '' ? null : Math.round(orgNum(g('mwo'))), au: au && au !== '0' ? au : '', cq: /^(1|true|yes|y|ja|x)$/i.test(g('commissionqualified')), st: g('accountstatus'), ct: g('customertype'), act: orgDate(g('activationdate')), city: g('addresscity'), phone: g('phone') };
}
function orgExtra(header, cells, name) {
  const nm = normName(name), out = [];
  (header || []).forEach((h, i) => { const k = String(h || '').trim(), v = String(cells[i] == null ? '' : cells[i]).trim(); if (!k || !v || normName(v) === nm || ORG_MAPPED.includes(orgKey(k))) return; out.push({ k: k.slice(0, 40), v: v.slice(0, 120) }); });
  return out.slice(0, 12);
}
// Het rapport staat in boomvolgorde: de ouder van iemand op niveau N is de laatste persoon erboven op niveau N-1.
function orgTreeOf(items, lvlOf) {
  const kids = items.map(() => 0), par = items.map(() => -1), stack = [];
  items.forEach((it, i) => { const l = lvlOf(it); if (!l) return; while (stack.length && lvlOf(items[stack[stack.length - 1]]) >= l) stack.pop(); if (stack.length) { par[i] = stack[stack.length - 1]; kids[par[i]]++; } stack.push(i); });
  return { kids, par };
}
function orgPlan(rows) {
  const have = new Map(allContacts().map(c => [normName(c.name), c])), seen = new Set(), fresh = [], upd = [];
  const tree = orgTreeOf(rows, r => r.yl && r.yl.lvl);
  rows.forEach((r, i) => {
    const k = normName(r.name); if (!k || seen.has(k)) return; seen.add(k);
    const c = have.get(k), kids = tree.kids[i];
    // Iedereen uit het rapport is klant, tenzij jij iemand zelf als teamlid aanwijst.
    const kind = c && (!c.org || c.kindSet) ? c.kind : 'Klant';
    (c ? upd : fresh).push({ r, c, kind, kids });
  });
  const stale = allContacts().filter(c => c.org && !c.yl && !seen.has(normName(c.name)));
  const all = fresh.concat(upd), cnt = kd => all.filter(x => x.kind === kd).length;
  return { fresh, upd, stale, klanten: cnt('Klant'), team: cnt('Teamlid'), lr: all.filter(x => x.kind === 'Klant' && x.r.yl && x.r.yl.au).length };
}
function orgSave(d) {
  if (!d || d.type !== 'orgreview') return; const p = orgPlan(d.rows || []), now = new Date().toISOString(), mk = todayKey().slice(0, 7);
  const doc = x => {
    const prev = x.c ? (state.docs[x.c.id] || {}) : {}, hist = Object.assign({}, prev.hist || {}), y = Object.assign({}, x.r.yl, { kids: x.kids }, prev.yl && prev.yl.mid ? { mid: prev.yl.mid, pm: prev.yl.pm } : {});
    hist[mk] = { pv: y.pv, ogv: y.ogv }; Object.keys(hist).sort().slice(0, -12).forEach(k => delete hist[k]);
    const base = x.c ? prev : { stage: 'Gestart', next: '', birthday: '', lastOrder: '', cycle: '', startDate: '', note: '' };
    return Object.assign({}, base, { name: x.c ? prev.name : x.r.name, kind: x.kind, org: x.c ? prev.org : true, yl: y, hist, info: x.r.info && x.r.info.length ? x.r.info : prev.info, updatedAt: now });
  };
  p.stale.forEach(c => remove(c.id));
  p.fresh.forEach(x => save(uid('contact'), doc(x)));
  p.upd.forEach(x => save(x.c.id, doc(x)));
  const ib = d.inboxId; state.dialog = null; state.view = 'mensen'; state.sub.mensen = 'Klanten'; state.orgq = ''; render(); window.scrollTo(0, 0);
  toast(p.fresh.length + ' toegevoegd' + (p.upd.length ? ', ' + p.upd.length + ' bijgewerkt' : '') + (p.stale.length ? ', ' + p.stale.length + ' oude regels opgeruimd' : '') + '.');
  if (ib && window.__lumoWeb && window.__lumoWeb.inbox) window.__lumoWeb.inbox.remove(ib).then(() => webInboxLoad(true), () => {});
}
const orgAgo = m => m == null ? '' : m === 0 ? 'deze maand' : m === 1 ? '1 maand geleden' : m + ' maanden geleden';
const orgFmt = n => (Math.round(n * 10) / 10).toLocaleString('nl-BE');
function orgAvg(c) { const v = Object.keys(c.hist || {}).map(k => c.hist[k].pv || 0); return v.length ? { avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length } : null; }
function orgBadges(c) {
  const y = c.yl || {}; let h = '';
  h += y.au ? pill('Loyalty Rewards · dag ' + y.au, 'lr') : (c.kind === 'Klant' ? pill('Geen Loyalty Rewards') : '');
  if (c.kind === 'Teamlid') h += pill('Teamlid');
  if (y.lvl) h += pill('Niveau ' + y.lvl);
  if (y.cq) h += pill('Commissie');
  return h;
}
function orgNeeds(c) {
  const y = c.yl || {}, t = todayKey(); if (!y.mid && y.lvl == null) return '';
  if (y.au && !y.aus && y.last && String(y.last).slice(0, 7) !== t.slice(0, 7) && new Date().getDate() > Number(y.au) + 1) return 'LR niet verzonden';
  const d = c.kind === 'Klant' ? customerDue(c) : null; if (d && d <= addDays(t, 3)) return 'Bestelmoment ' + fmtDate(d);
  if (y.mwo >= 3 && y.mwo <= 5) return y.mwo + ' mnd geen bestelling';
  return '';
}
function orgCard(c) {
  const y = c.yl || {}, need = orgNeeds(c);
  const why = need || (y.au ? 'Loyalty Rewards actief' : (c.kind === 'Teamlid' ? 'Teamlid' : 'Geen Loyalty Rewards'));
  return '<div class="orgc"><button class="orgc-main" data-act="contact-edit" data-id="' + c.id + '"><b>' + esc(c.name) + '</b><span class="orgc-why' + (need ? ' due' : '') + '">' + esc(why) + '</span></button>' +
    '<button class="btn small" data-act="org-now" data-id="' + c.id + '">Wat nu?</button></div>';
}
function orgPrio(c) {
  const y = c.yl || {}, n = orgNeeds(c);
  if (n === 'LR niet verzonden') return 0;
  if (n.indexOf('Bestelmoment') === 0) return 1;
  return n ? 2 : 3;
}

/* ---------- Vandaag: maanddoel en Nu doen ---------- */
try { state.mgOpen = localStorage.getItem('lumo-mgopen') === '1'; } catch (e) {}
const MG_METRICS = { pv: 'OGV', rankSilver: 'Rang Silver', rankGold: 'Rang Gold', new: 'Nieuwe leden', act: 'Leden met bestelling' };
const RANKS = { Silver: { ogv: 10000, legs: 2, leg: 4000, pgv: 1000 }, Gold: { ogv: 35000, legs: 3, leg: 6000, pgv: 1000 } };
const mgRank = g => g && g.metric.indexOf('rank') === 0 ? g.metric.slice(4) : '';
const mgOgvMetric = g => g && (g.metric === 'pv' || !!mgRank(g));
function mgLegs(r) {
  const R = RANKS[r], legs = allContacts().filter(c => c.yl && Number(c.yl.lvl) === 1).map(c => ({ c, v: Math.round(c.yl.ogv || 0) })).sort((a, b) => b.v - a.v);
  const top = legs.slice(0, R.legs), total = Math.round(allContacts().filter(c => c.yl && Number(c.yl.lvl) === 1).reduce((s, c) => s + (c.yl.ogv || 0), 0));
  return { R, top, total, pgv: Math.max(0, total - top.reduce((s, x) => s + x.v, 0)) };
}
function mgNow(m) {
  const mk = todayKey().slice(0, 7), cs = allContacts().filter(c => c.yl);
  if (m === 'pv' || m.indexOf('rank') === 0) return Math.round(cs.reduce((s, c) => s + (c.yl.pv || 0), 0));
  if (m === 'new') return cs.filter(c => String(c.yl.since || '').slice(0, 7) === mk).length;
  return cs.filter(c => String(c.yl.last || '').slice(0, 7) === mk).length;
}
function mgProj() {
  const d = new Date().getDate(); let add = 0, n = 0;
  allContacts().forEach(c => { const y = c.yl; if (y && y.au && !y.aus && Number(y.au) >= d && y.aupv) { add += y.aupv; n++; } });
  return { add: Math.round(add), n };
}
function mgRankShort(rk) {
  const L = mgLegs(rk), miss = L.top.filter(x => x.v < L.R.leg).length + (L.top.length < L.R.legs ? L.R.legs - L.top.length : 0);
  return miss ? miss + (miss === 1 ? ' groep' : ' groepen') + ' nog niet klaar' : 'groepen ok';
}
function mgRankHtml(rk, proj) {
  const L = mgLegs(rk), R = L.R, ok = x => '<span class="pill' + (x ? '' : ' due') + '">' + (x ? 'ok' : 'nog niet') + '</span>';
  const row = (t, a, b, good) => '<div class="mgrow"><span class="mgn">' + esc(t) + '</span><span class="small mgv">' + a + (b ? ' / ' + b : '') + ' ' + ok(good) + '</span></div>';
  return '<div class="mgrank"><p class="eyebrow" style="margin:10px 0 4px">Wat Silver vraagt</p>'.replace('Silver', rk) +
    L.top.map((x, i) => row('Groep ' + (i + 1) + ': ' + x.c.name.replace(/\b\w/g, m => m.toUpperCase()).toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase()), orgFmt(x.v), orgFmt(R.leg), x.v >= R.leg)).join('') +
    (L.top.length < R.legs ? '<p class="small muted">Je hebt nog maar ' + L.top.length + ' groep' + (L.top.length === 1 ? '' : 'en') + ' met volume.</p>' : '') +
    row('Buiten de groepen (PGV)', orgFmt(L.pgv), orgFmt(R.pgv), L.pgv >= R.pgv) +
    '<p class="small muted">Eigen 100 PV controleer je zelf. PGV is een schatting en houdt geen rekening met Silver-leden in je groepen.</p></div>';
}
function mgHtml() {
  const g = state.docs.mgoal, t = todayKey(), dt = new Date(), dim = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate(), left = dim - dt.getDate() + 1;
  const mname = dt.toLocaleDateString('nl-NL', { month: 'long' });
  if (!g || state.mgEdit) {
    return '<section class="card mg"><p class="eyebrow">Doel voor ' + esc(mname) + '</p>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><label class="f" style="flex:1;min-width:150px"><span class="sr">Wat meten</span><select id="mg-m">' + Object.keys(MG_METRICS).map(k => '<option value="' + k + '"' + (g && g.metric === k ? ' selected' : '') + '>' + MG_METRICS[k] + '</option>').join('') + '</select></label>' +
      '<label class="f" style="width:150px"><span class="sr">Doel</span><input id="mg-t" type="number" inputmode="numeric" min="1" placeholder="Doel (bij rang leeg laten)" value="' + (g ? g.target : '') + '"></label></div>' +
      '<div class="row"><button class="btn" data-act="org-mg-save">Opslaan</button>' + (g ? '<button class="btn ghost" data-act="org-mg-cancel">Annuleer</button>' : '') + '</div>' +
      '<p class="small muted">De voortgang wordt automatisch uit je Virtual Office berekend en elke maand opnieuw geteld.</p></section>';
  }
  const open = !!state.mgOpen, og = mgOgvMetric(g), rk = mgRank(g), n = mgNow(g.metric), pj = og ? mgProj() : null, pp = pj ? Math.min(100, Math.round((n + pj.add) / g.target * 100)) : 0, pct = Math.min(100, Math.round(n / g.target * 100)), need = Math.max(0, g.target - n), per = og ? Math.ceil(need / left) : Math.max(0, need / left);
  const pace = need <= 0 ? 'Doel gehaald' : 'nog ' + orgFmt(need) + (og ? ' OGV' : '') + ' · ' + left + (left === 1 ? ' dag' : ' dagen') + (og ? ' · ±' + orgFmt(per) + ' per dag' : '');
  return '<section class="card mg"><div class="row"><p class="eyebrow" style="margin:0">' + esc(mname) + ' · ' + esc(MG_METRICS[g.metric]) + '</p><span class="spacer"></span><button class="btn ghost small" data-act="org-mg-edit">Wijzig</button></div>' +
    '<div class="big">' + orgFmt(n) + ' <span class="small muted">/ ' + orgFmt(g.target) + '</span></div>' +
    '<div class="bar' + (n >= g.target ? ' full' : '') + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" style="position:relative">' + (pj && pj.add ? '<i style="position:absolute;left:0;top:0;height:100%;width:' + pp + '%;opacity:.3"></i>' : '') + '<i style="position:relative;width:' + pct + '%"></i></div>' +
    '<p class="small">' + pct + '% · ' + (pj ? 'verwacht <b>' + orgFmt(n + pj.add) + '</b>' : esc(pace)) + (rk ? ' · ' + mgRankShort(rk) : '') + '</p>' +
    '<button class="btn ghost small" data-act="org-mg-open" aria-expanded="' + open + '">' + (open ? 'Minder tonen' : 'Details') + '</button>' +
    (open ? '<div class="mgdet"><p class="small">' + esc(pace) + '</p>' +
    (pj ? '<p class="small">Verwacht einde maand: <b>' + orgFmt(n + pj.add) + ' OGV</b> <span class="muted">(+' + orgFmt(pj.add) + ' uit ' + pj.n + ' geplande Loyalty Rewards' + (n + pj.add >= g.target ? ' · doel in zicht' : ' · nog ' + orgFmt(g.target - n - pj.add) + ' erbij nodig') + ')</span></p>' : '') + (rk ? mgRankHtml(rk, n + (pj ? pj.add : 0)) : '') + '</div>' : '') + '</section>';
}
function legPrompt(c) {
  const g = state.docs.mgoal, rk = mgRank(g) || 'Silver', L = mgLegs(rk), x = L.top.find(t => t.c.id === c.id), R = L.R, td = new Date().getDate();
  const N = orgNodes(), down = []; (function walk(n) { (N.kids.get(n.id) || []).forEach(k => { down.push(k); walk(k); }); })(c);
  const act = down.filter(k => (k.yl.pv || 0) > 0).length, planned = down.filter(k => k.yl.au && !k.yl.aus && Number(k.yl.au) >= td), plannedPv = Math.round(planned.reduce((a, k) => a + (k.yl.aupv || 0), 0));
  const failed = down.filter(k => orgNeeds(k) === 'LR niet verzonden').length, noLr = down.filter(k => !k.yl.au).length, dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const v = x ? x.v : Math.round(c.yl.ogv || 0);
  return c.name + ' is een van de groepen die ik nodig heb voor ' + rk + '. De groep van ' + c.name + ' heeft ' + orgFmt(v) + ' van de ' + orgFmt(R.leg) + ' OGV die nodig is, dus er ontbreekt nog ' + orgFmt(Math.max(0, R.leg - v)) + ' OGV, en er zijn nog ' + (dim - td + 1) + ' dagen deze maand. Die groep telt ' + (down.length + 1) + ' mensen (de leider inbegrepen), ' + act + ' met bestelling deze maand, ' + planned.length + ' met nog geplande Loyalty Rewards (samen ongeveer ' + orgFmt(plannedPv) + ' PV), ' + failed + ' met een niet verzonden Loyalty Rewards, ' + noLr + ' zonder Loyalty Rewards. ' +
    'Geef maximaal twee concrete acties voor mij: wat kan ik met deze persoon bespreken om die ontbrekende OGV te halen (met waarde of nieuwe info, geen losse check-in), en bij wie in deze groep zit het meeste kans. Schrijf daarna één kort bericht aan deze persoon dat ik kan sturen. Zeg erbij als je iets mist, en doe geen beloftes over resultaat.';
}
function nuDoen() {
  const t = todayKey(), seen = {}, out = [], lim = addDays(t, -7);
  const add = (c, why, pr, k) => { if (!c || seen[c.id]) return; seen[c.id] = 1; out.push({ c, why, pr, k: k || '' }); };
  const needs = allContacts().filter(c => c.yl).map(c => ({ c, n: orgNeeds(c) })).filter(x => x.n);
  needs.filter(x => x.n === 'LR niet verzonden').forEach(x => add(x.c, x.n, 0));
  { const g = state.docs.mgoal, rk = mgRank(g); if (rk) { const L = mgLegs(rk); L.top.forEach((x, i) => { if (x.v < L.R.leg) add(x.c, 'Groep ' + (i + 1) + ' mist nog ' + orgFmt(L.R.leg - x.v) + ' OGV voor ' + rk, 0.5, 'leg'); }); } }
  voOrders().filter(e => (e.t === 'new' || e.t === 'conv' || e.t === 'stop') && String(e.at || '').slice(0, 10) >= lim && state.docs[e.cid]).forEach(e => add(Object.assign({ id: e.cid }, state.docs[e.cid]), voLabel(e), 1));
  dueContacts().forEach(c => add(c, 'Opvolging gepland', 2));
  needs.filter(x => x.n.indexOf('Bestelmoment') === 0).forEach(x => add(x.c, x.n, 3));
  needs.filter(x => x.n.indexOf('mnd') > -1).forEach(x => add(x.c, x.n, 4));
  return out.sort((a, b) => a.pr - b.pr);
}
function nuDoenHtml() {
  const l = nuDoen(), top = l.slice(0, 5);
  if (!l.length) return '<section class="card soft"><h2>Nu doen</h2><p class="muted">Niets dringends. Goed bezig.</p></section>';
  return '<section aria-labelledby="h-nu"><h2 id="h-nu" style="margin:6px 0">Nu doen <span class="small muted">' + l.length + '</span></h2><div class="orgl">' +
    top.map(x => '<div class="orgc"><button class="orgc-main" data-act="contact-edit" data-id="' + x.c.id + '"><b>' + esc(x.c.name) + '</b><span class="orgc-why due">' + esc(x.why) + '</span></button><button class="btn small" data-act="org-now" data-id="' + x.c.id + '">Wat nu?</button></div>').join('') + '</div>' +
    (l.length > 5 ? '<div class="row" style="margin-top:8px"><button class="btn ghost small" data-act="goto" data-view="mensen" data-sub="Klanten">Alle ' + l.length + ' bekijken</button></div>' : '') + '</section>';
}

/* ---------- Groei: overzicht per maand ---------- */
function grMonths(n) {
  const out = [], d = new Date(); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')); }
  return out;
}
function grSeries() {
  const ms = grMonths(6), cs = allContacts().filter(c => c.yl), l1 = cs.filter(c => Number(c.yl.lvl) === 1);
  const has = m => cs.some(c => c.hist && c.hist[m]);
  const ogv = ms.map(m => has(m) ? Math.round(l1.reduce((a, c) => a + ((c.hist && c.hist[m] && c.hist[m].ogv) || 0), 0)) : null);
  const act = ms.map(m => has(m) ? cs.filter(c => c.hist && c.hist[m] && c.hist[m].pv > 0).length : null);
  const nw = ms.map(m => cs.filter(c => String(c.yl.since || '').slice(0, 7) === m).length);
  const tot = ms.map(m => cs.filter(c => String(c.yl.since || '').slice(0, 7) <= m).length);
  return { ms, ogv, act, nw, tot };
}
function grTile(label, arr, ms) {
  const n = arr.length - 1, cur = arr[n], prev = arr[n - 1], max = Math.max.apply(null, arr.map(v => v || 0)) || 1;
  const d = cur != null && prev != null ? cur - prev : null, arrow = d == null ? '' : d > 0 ? '↑' : d < 0 ? '↓' : '→';
  const mn = m => new Date(m + '-01').toLocaleDateString('nl-NL', { month: 'short' }).replace('.', '');
  return '<div class="grt"><div class="row" style="align-items:baseline"><span class="small muted">' + esc(label) + '</span><span class="spacer"></span>' + (d != null ? '<span class="small ' + (d < 0 ? 'down' : 'up') + '">' + arrow + ' ' + (d > 0 ? '+' : '') + orgFmt(d) + ' t.o.v. vorige maand</span>' : '') + '</div>' +
    '<div class="big">' + (cur != null ? orgFmt(cur) : '-') + '</div>' +
    '<div class="grbars">' + arr.map((v, i) => '<div class="grc"><div class="grb' + (i === n ? ' on' : '') + '" style="height:' + (v == null ? 3 : Math.max(4, Math.round(v / max * 56))) + 'px"></div><span>' + mn(ms[i]) + '</span></div>').join('') + '</div></div>';
}
const grNm = n => String(n || '').toLowerCase().replace(/(^|[\s-])\S/g, m => m.toUpperCase());
function grBars(items) {
  const max = Math.max.apply(null, items.map(i => i.v)) || 1;
  return items.map(i => '<div class="hb"><span class="hl">' + esc(i.l) + '</span><span class="ht"><i style="width:' + Math.max(2, Math.round(i.v / max * 100)) + '%"></i></span><span class="hv">' + (i.t != null ? i.t : orgFmt(i.v)) + '</span></div>').join('');
}
function monthsSince(d) {
  if (!d) return null; const t = todayKey(); return (Number(t.slice(0, 4)) * 12 + Number(t.slice(5, 7))) - (Number(String(d).slice(0, 4)) * 12 + Number(String(d).slice(5, 7)));
}
function groeiOverzichtHtml() {
  const S = grSeries(), cs = allContacts().filter(c => c.yl), t = todayKey(), td = new Date().getDate();
  if (!cs.length) return '<div class="card soft"><p>Zodra je Virtual Office gekoppeld is, zie je hier hoe je organisatie groeit.</p></div>';
  const N = orgNodes(), kids = N.kids, desc = c => { const o = []; (function w(n) { (kids.get(n.id) || []).forEach(k => { o.push(k); w(k); }); })(c); return o; };
  const act = cs.filter(c => (c.yl.pv || 0) > 0).length, lr = cs.filter(c => c.yl.au), lrShip = lr.filter(c => c.yl.aus).length, lrFail = cs.filter(c => orgNeeds(c) === 'LR niet verzonden').length, pj = mgProj();
  const ogvNow = S.ogv[S.ogv.length - 1], pvAvg = act ? Math.round(cs.reduce((a, c) => a + (c.yl.pv || 0), 0) / act) : 0;
  /* groepen */
  const legs = cs.filter(c => Number(c.yl.lvl) === 1).map(c => { const d = desc(c); return { c, v: Math.round(c.yl.ogv || 0), n: d.length + 1, act: d.concat([c]).filter(x => (x.yl.pv || 0) > 0).length, lr: d.concat([c]).filter(x => x.yl.au).length }; }).filter(x => x.v > 0 || x.n > 1).sort((a, b) => b.v - a.v);
  const legTot = legs.reduce((a, x) => a + x.v, 0) || 1;
  /* niveaus */
  const lv = {}; cs.forEach(c => { const l = c.yl.lvl; if (l == null) return; lv[l] = lv[l] || { n: 0, a: 0 }; lv[l].n++; if ((c.yl.pv || 0) > 0) lv[l].a++; });
  const lvKeys = Object.keys(lv).sort((a, b) => a - b);
  /* laatste bestelling */
  const bk = { 'Deze maand': 0, '1 maand geleden': 0, '2 maanden': 0, '3 tot 5 maanden': 0, '6 maanden of langer': 0, 'Nooit besteld': 0 };
  cs.forEach(c => { const m = monthsSince(c.yl.last); if (m == null) bk['Nooit besteld']++; else if (m <= 0) bk['Deze maand']++; else if (m === 1) bk['1 maand geleden']++; else if (m === 2) bk['2 maanden']++; else if (m <= 5) bk['3 tot 5 maanden']++; else bk['6 maanden of langer']++; });
  /* nieuwe leden */
  const lim = addDays(t, -45), nieuw = cs.filter(c => String(c.yl.since || '').slice(0, 10) >= lim).sort((a, b) => String(b.yl.since).localeCompare(String(a.yl.since)));
  const nBest = nieuw.filter(c => c.yl.last && String(c.yl.last).slice(0, 10) >= String(c.yl.since).slice(0, 10)).length;
  const top = cs.filter(c => (c.yl.pv || 0) > 0).sort((a, b) => b.yl.pv - a.yl.pv).slice(0, 6);
  const sec = (h, body, note, def) => gsec('s:' + h, h, body, note, def);
  const facts = 'Mijn cijfers voor ' + new Date().toLocaleDateString('nl-NL', { month: 'long' }) + ': ' + cs.length + ' mensen, OGV ' + orgFmt(ogvNow || 0) + ' (verwacht einde maand ' + orgFmt((ogvNow || 0) + pj.add) + '), ' + act + ' leden met bestelling, ' + lr.length + ' met Loyalty Rewards (' + lrFail + ' niet verzonden), ' + nieuw.length + ' nieuwe leden in 45 dagen waarvan ' + nBest + ' al besteld hebben. Sterkste groepen: ' + legs.slice(0, 3).map(x => grNm(x.c.name) + ' ' + orgFmt(x.v) + ' OGV').join(', ') + '. Wat valt op, wat is mijn grootste kans en wat doe ik deze week? Maximaal drie punten, met waarde of nieuwe info voor mensen, zonder beloftes.';
  return commHtml() + gsec('org', 'Je organisatie', grTile('Mensen in totaal', S.tot, S.ms) + grTile('Nieuwe leden', S.nw, S.ms) + grTile('OGV', S.ogv, S.ms) + grTile('Leden met bestelling', S.act, S.ms) +
    '<p class="small muted">Nieuwe leden en het totaal lopen terug in de tijd. OGV en bestellingen worden bijgehouden vanaf november. De huidige maand is nog niet af.</p>' +
    '<div class="row"><button class="btn small" data-act="coach-chip" data-prompt="' + esc(facts) + '">Wat zeggen mijn cijfers?</button></div>', null, true) +
    sec('Deze maand in cijfers', '<div class="ostats" style="padding:4px 0"><div class="ost"><b>' + orgFmt(ogvNow || 0) + '</b><span class="small muted">OGV nu</span></div><div class="ost"><b>' + orgFmt((ogvNow || 0) + pj.add) + '</b><span class="small muted">verwacht</span></div><div class="ost"><b>' + act + '</b><span class="small muted">besteld</span></div><div class="ost"><b>' + orgFmt(pvAvg) + '</b><span class="small muted">gem. PV</span></div></div>', 'Verwacht = huidige OGV plus de Loyalty Rewards die nog gepland staan. Gem. PV is per lid dat besteld heeft.', true) +
    sec('Je groepen', grBars(legs.slice(0, 8).map(x => ({ l: grNm(x.c.name), v: x.v, t: orgFmt(x.v) + ' · ' + Math.round(x.v / legTot * 100) + '%' }))) + '<p class="small muted" style="margin-top:6px">Per groep: ' + legs.slice(0, 8).map(x => grNm(x.c.name).split(' ')[0] + ' ' + x.n + ' mensen, ' + x.act + ' besteld, ' + x.lr + ' LR').join(' · ') + '</p>', 'Een groep is een eerste-lijnspersoon met zijn of haar hele downline. Het percentage is het aandeel in je OGV.') +
    sec('Loyalty Rewards', '<div class="ostats" style="padding:4px 0"><div class="ost"><b>' + lr.length + '</b><span class="small muted">actief</span></div><div class="ost"><b>' + lrShip + '</b><span class="small muted">verzonden</span></div><div class="ost"><b>' + (lr.length - lrShip - lrFail) + '</b><span class="small muted">nog gepland</span></div><div class="ost"><b>' + lrFail + '</b><span class="small muted">niet verzonden</span></div></div><p class="small">Nog te verwachten uit gepland: <b>' + orgFmt(pj.add) + ' PV</b>. ' + Math.round(lr.length / cs.length * 100) + '% van je mensen heeft Loyalty Rewards.</p>') +
    sec('Wanneer bestelden ze voor het laatst', grBars(Object.keys(bk).map(k => ({ l: k, v: bk[k], t: String(bk[k]) })))) +
    sec('Niveaus', grBars(lvKeys.map(k => ({ l: 'Niveau ' + k, v: lv[k].n, t: lv[k].n + ' · ' + lv[k].a + ' besteld' }))), 'Hoe diep je organisatie gaat en hoeveel mensen per niveau actief zijn.') +
    sec('Nieuwe leden (45 dagen)', nieuw.length ? '<p class="small">' + nBest + ' van ' + nieuw.length + ' hebben al besteld.</p>' + nieuw.slice(0, 8).map(c => '<div class="hb"><span class="hl" style="width:55%">' + esc(grNm(c.name)) + '</span><span class="small muted" style="flex:1">' + esc(fmtDate(String(c.yl.since).slice(0, 10))) + '</span><span class="hv">' + (c.yl.last && String(c.yl.last).slice(0, 10) >= String(c.yl.since).slice(0, 10) ? 'besteld' : 'nog niet') + '</span></div>').join('') : '<p class="muted">Geen nieuwe leden in de laatste 45 dagen.</p>') +
    sec('Grootste bestellers deze maand', top.length ? grBars(top.map(c => ({ l: grNm(c.name), v: c.yl.pv, t: orgFmt(c.yl.pv) + ' PV' }))) : '<p class="muted">Nog geen bestellingen deze maand.</p>');
}

/* ---------- Commissie (schatting op basis van het Europese compensatieplan) ---------- */
const COMM_RATES = [0.08, 0.05, 0.04, 0.04, 0.04], COMM_EUR = 1;
function commEst(scen) {
  const N = orgNodes(), d = new Date(), td = d.getDate(), x = new Date(d.getFullYear(), d.getMonth() - 2, 1), lim = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-01';
  const base = c => scen === 'now' ? (c.yl.pv || 0) : (c.yl.pv || 0) + (c.yl.au && !c.yl.aus && Number(c.yl.au) >= td ? (c.yl.aupv || 0) : 0);
  const isFs = c => String(c.yl.since || '').slice(0, 10) >= lim && base(c) >= 50, vol = c => isFs(c) ? base(c) * 0.3 : base(c);
  const per = [0, 0, 0, 0, 0]; let fs = 0, all = 0;
  const walk = (n, level, carry) => {
    const kids = N.kids.get(n.id) || [], v = vol(n); all += vol(n);
    if (isFs(n)) { if (Number(n.yl.lvl) === 1) fs += base(n) * 0.25; else if (Number(n.yl.lvl) === 2) fs += base(n) * 0.10; }
    if (base(n) >= 100) { if (level <= 5) per[level - 1] += v + carry; kids.forEach(k => walk(k, level + 1, 0)); }
    else {
      const best = kids.slice().sort((a, b) => base(b) - base(a))[0];
      if (!kids.length) { if (level <= 5) per[level - 1] += v + carry; }
      kids.forEach(k => walk(k, level, k === best ? v + carry : 0));
    }
  };
  N.roots.forEach(r => walk(r, 1, 0));
  const og = Math.round(all), depth = og >= 4000 ? 5 : og >= 2000 ? 4 : og >= 500 ? 3 : 2;
  const uni = per.reduce((a, v, i) => a + (i < depth ? v * COMM_RATES[i] : 0), 0) * COMM_EUR;
  return { per, uni: Math.round(uni * 100) / 100, fs: Math.round(fs * COMM_EUR * 100) / 100, gen: Math.round(all * 0.025 * COMM_EUR * 100) / 100, depth };
}
const eur = v => '€' + (Math.round(v * 100) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
try { state.gopen = JSON.parse(localStorage.getItem('lumo-gopen') || '{}'); } catch (e) { state.gopen = {}; }
const gOpen = (k, def) => state.gopen && state.gopen[k] != null ? !!state.gopen[k] : !!def;
function gsec(k, title, body, note, def, hint) {
  const o = gOpen(k, def);
  return '<section class="card gsec"><button class="gsec-h" data-act="org-gopen" data-k="' + esc(k) + '" aria-expanded="' + (o ? 'true' : 'false') + '"><h2>' + title + '</h2>' + (hint ? '<span class="small muted gsec-hint">' + hint + '</span>' : '') + '<span class="spacer"></span><span class="gsec-chev" aria-hidden="true">' + (o ? '▾' : '▸') + '</span></button>' +
    (o ? body + (note ? '<p class="small muted">' + note + '</p>' : '') : '') + '</section>';
}
function commHist() {
  const h = Object.assign({}, state.docs.commhist || {}), r = state.docs.commref; delete h.updatedAt;
  if (r && r.month && !h[r.month]) h[r.month] = { total: r.total };
  return h;
}
function commChart(est) {
  const ms = grMonths(6), h = commHist(), cur = ms[ms.length - 1];
  const vals = ms.map((m, i) => i === ms.length - 1 ? est : (h[m] && h[m].total != null ? Number(h[m].total) : null)), max = Math.max.apply(null, vals.map(v => v || 0)) || 1;
  const mn = m => new Date(m + '-01').toLocaleDateString('nl-NL', { month: 'short' }).replace('.', '');
  return '<div class="grbars" style="height:112px;align-items:flex-end;margin-top:10px">' + vals.map((v, i) => '<div class="grc"><em class="gcv">' + (v == null ? '' : Math.round(v)) + '</em><div class="grb' + (i === vals.length - 1 ? ' est' : ' on') + '" style="height:' + (v == null ? 3 : Math.max(4, Math.round(v / max * 72))) + 'px"></div><span>' + mn(ms[i]) + '</span></div>').join('') + '</div>';
}
function commHtml() {
  const a = commEst('now'), b = commEst('exp'), ref = state.docs.commref, ogvExp = mgNow('pv') + mgProj().add, silverNow = ogvExp >= 10000;
  const est = b.uni + b.fs, now = a.uni + a.fs, ms = grMonths(6), h = commHist(), prev = h[ms[ms.length - 2]] && h[ms[ms.length - 2]].total, mnm = m => new Date(m + '-01').toLocaleDateString('nl-NL', { month: 'long' });
  const row = (l, x, y) => '<div class="mgrow"><span class="mgn">' + l + '</span><span class="small mgv">' + eur(x) + '</span><span class="small mgv" style="min-width:84px">' + eur(y) + '</span></div>';
  const opts = ms.slice(0, -1).map(m => '<option value="' + m + '">' + mnm(m) + '</option>').join('');
  const body = '<div class="cbig"><div class="small muted">Verwacht deze maand</div><div class="big cnum">' + eur(est) + '</div><div class="small muted">tot nu toe ' + eur(now) + (prev != null ? ' · vorige maand echt ' + eur(prev) : '') + '</div></div>' +
    commChart(est) + '<p class="small muted" style="margin:2px 0 8px">Donkere balken zijn wat je echt kreeg, de lichte balk is de schatting voor deze maand zonder leiderschapsbonus.</p>' +
    '<div class="mgrow small muted"><span class="mgn"></span><span class="mgv">tot nu toe</span><span class="mgv" style="min-width:84px">verwacht</span></div>' +
    row('Unilevel', a.uni, b.uni) + row('Fast Start', a.fs, b.fs) + '<div class="mgrow"><b class="mgn">Samen</b><b class="small mgv">' + eur(now) + '</b><b class="small mgv" style="min-width:84px">' + eur(est) + '</b></div>' +
    (silverNow ? '<p class="small">Met Silver komt er persoonlijke generatie bij, ongeveer <b>' + eur(b.gen) + '</b>.</p>' : '<p class="small">Haal je <b>Silver</b>, dan komt er persoonlijke generatie bij (2,5% op je groepen), ongeveer <b>+' + eur(b.gen) + '</b> per maand bij dit volume.</p>') +
    (ref ? '<p class="small muted">Ter vergelijking, ' + esc(mnm(ref.month)) + ' echt: unilevel ' + eur(ref.uni) + ', Fast Start ' + eur(ref.fs) + ', leiderschapsbonus ' + eur(ref.glb) + ', samen ' + eur(ref.total) + '.</p>' : '') +
    (state.chAdd ? '<div class="mgdet"><label class="f" for="ch-m">Maand<select id="ch-m">' + opts + '</select></label><label class="f" for="ch-v">Totaal verdiend in euro<input id="ch-v" inputmode="decimal" placeholder="bijvoorbeeld 521,82"></label><div class="row"><button class="btn small" data-act="org-ch-save">Opslaan</button><button class="btn ghost small" data-act="org-ch-add">Annuleer</button></div></div>' : '<div class="row"><button class="btn ghost small" data-act="org-ch-add">Vorige maand toevoegen</button></div>') +
    '<p class="small muted">Gebaseerd op het Europese plan: 8, 5 en 4% op vijf niveaus met compressie onder 100 PV, Fast Start 25% en 10% op de eerste drie maanden, en 1 PV als ongeveer €1. Het is een schatting en geen belofte van inkomen. De leiderschapsbonus, rangbonussen en afhoudingen zitten er niet in.</p>';
  return gsec('comm', 'Commissie', body, null, true, '≈ ' + eur(est));
}
const ORG_FILTERS = { Klant: ['Actie nodig', 'Alles', 'Loyalty Rewards', 'Geen LR', 'Lang niet besteld'], Teamlid: ['Alles', 'Loyalty Rewards', 'Geen LR', 'Lang niet besteld'] };
function orgListHtml(kind) {
  kind = kind || (state.sub.mensen === 'Klanten' ? 'Klant' : 'Teamlid');
  const all = byKind(kind), q = normName(state.orgq || ''), f = state.orgf || 'Actie nodig', s = state.orgsort || 'Naam';
  let hit = all.filter(c => !q || normName(c.name + ' ' + (c.yl ? c.yl.phone || '' : '') + ' ' + (c.info || []).map(x => x.v).join(' ')).includes(q));
  hit = hit.filter(c => f === 'Alles' || (f === 'Actie nodig' && orgNeeds(c)) || (f === 'Loyalty Rewards' && c.yl && c.yl.au) || (f === 'Geen LR' && !(c.yl && c.yl.au)) || (f === 'Lang niet besteld' && c.yl && c.yl.mwo != null && c.yl.mwo >= 3));
  const mw = c => c.yl && c.yl.mwo != null ? c.yl.mwo : -1, pv = c => c.yl ? c.yl.pv || 0 : 0, og = c => c.yl ? c.yl.ogv || 0 : 0;
  if (f === 'Actie nodig' && s === 'Naam') hit.sort((a, b) => orgPrio(a) - orgPrio(b) || (b.yl.mwo || 0) - (a.yl.mwo || 0) || a.name.localeCompare(b.name)); else hit.sort(s === 'Laatst besteld (oudste eerst)' ? (a, b) => mw(b) - mw(a) || a.name.localeCompare(b.name) : s === 'PV (hoog naar laag)' ? (a, b) => pv(b) - pv(a) : s === 'OGV (hoog naar laag)' ? (a, b) => og(b) - og(a) : (a, b) => (a.name || '').localeCompare(b.name || ''));
  const lr = all.filter(c => c.yl && c.yl.au).length, cap = (f === 'Actie nodig' && !q && !state.orgmore) ? 10 : 40;
  if (!all.length) return '<p class="muted">' + (kind === 'Klant' ? 'Nog geen klanten. Importeer je organisatie uit het Virtual Office, of voeg een contact toe.' : 'Nog geen teamleden. Open Klanten en tik bij iemand op Maak teamlid zodra die een actief business kiest.') + '</p>';
  return '<p class="small muted">' + hit.length + ' van ' + all.length + (kind === 'Klant' ? ' klanten' : ' teamleden') + (hit.length > cap && cap === 40 ? ' · zoek of filter voor de rest' : '') + '</p><div class="orgl">' + hit.slice(0, cap).map(c => c.yl ? orgCard(c) : contactCard(c)).join('') + '</div>' + (hit.length > cap && cap === 10 ? '<button class="btn" data-act="org-more">Toon alle ' + hit.length + '</button>' : '');
}
function orgPageHtml(kind) {
  state.orgkind = kind; const all = byKind(kind), f = state.orgf || 'Actie nodig';
  const sorts = kind === 'Klant' ? ['Naam', 'Laatst besteld (oudste eerst)', 'PV (hoog naar laag)'] : ['Naam', 'Laatst besteld (oudste eerst)', 'PV (hoog naar laag)', 'OGV (hoog naar laag)'];
  return (all.some(c => c.yl) ? '<label class="f"><span class="sr">Zoek op naam</span><input type="search" data-input="orgsearch" placeholder="Zoek op naam, gsm of plaats…" value="' + esc(state.orgq || '') + '"></label>' +
      '<div class="seg" role="group" aria-label="Filter">' + ORG_FILTERS[kind].map(x => '<button class="chip" data-act="org-filter" data-f="' + x + '" aria-pressed="' + (f === x) + '">' + x + '</button>').join('') + '</div>' : '') +
    '<div id="orglist">' + orgListHtml(kind) + '</div>';
}
/* ---------- netwerk (zoals de organisatieweergave in het Virtual Office) ---------- */
function orgNodes() {
  const nodes = allContacts().filter(c => c.yl && c.yl.lvl), kids = new Map(), roots = [];
  const linked = nodes.length > 0 && nodes.every(n => n.yl.mid && n.yl.pm !== undefined);
  if (linked) {
    /* echte boom: elke persoon wijst naar het lidnummer van zijn sponsor (yl.pm); niveau 1 wijst naar jou */
    const byMid = new Map(); nodes.forEach(n => byMid.set(String(n.yl.mid), n));
    nodes.forEach(n => { const p = n.yl.pm ? byMid.get(String(n.yl.pm)) : null; if (p) { if (!kids.has(p.id)) kids.set(p.id, []); kids.get(p.id).push(n); } else roots.push(n); });
    const ord = (a, b) => (b.yl.ogv || 0) - (a.yl.ogv || 0) || (b.yl.pv || 0) - (a.yl.pv || 0) || (a.name || '').localeCompare(b.name || '');
    kids.forEach(v => v.sort(ord)); roots.sort(ord);
  } else {
    const stack = []; nodes.sort((a, b) => a.yl.i - b.yl.i);
    nodes.forEach(n => { const l = n.yl.lvl; while (stack.length && stack[stack.length - 1].yl.lvl >= l) stack.pop(); const p = stack[stack.length - 1]; if (p) { if (!kids.has(p.id)) kids.set(p.id, []); kids.get(p.id).push(n); } else roots.push(n); stack.push(n); });
  }
  const sum = new Map(), calc = n => { if (sum.has(n.id)) return sum.get(n.id); const s = { n: 0, pv: 0, lr: 0 }; (kids.get(n.id) || []).forEach(k => { const t = calc(k); s.n += 1 + t.n; s.pv += (k.yl.pv || 0) + t.pv; s.lr += (k.yl.au ? 1 : 0) + t.lr; }); sum.set(n.id, s); return s; };
  nodes.forEach(calc);
  return { nodes, kids, roots, sum, ordered: linked || nodes.every(n => n.yl.i != null) };
}
function orgNetRow(n, g, flat) {
  const y = n.yl, k = g.kids.get(n.id) || [], open = !!(state.netOpen || {})[n.id], s = g.sum.get(n.id) || { n: 0, pv: 0, lr: 0 };
  return '<div class="net-node l' + Math.min(y.lvl, 8) + '" style="margin-left:' + (flat ? 0 : (y.lvl - 1) * 14) + 'px"><div class="row" style="gap:6px;flex-wrap:nowrap">' +
    (k.length && !flat ? '<button class="net-tog" data-act="org-net" data-id="' + n.id + '" aria-expanded="' + open + '" aria-label="' + (open ? 'Klap in' : 'Klap uit') + ' ' + esc(n.name) + '">' + (open ? '−' : '+') + '</button>' : '<span class="net-tog sp"></span>') +
    '<button class="net-name" data-act="contact-edit" data-id="' + n.id + '">' + esc(n.name) + '</button><span class="spacer"></span>' + (orgNeeds(n) ? pill(orgNeeds(n), 'due') : '') + (y.au ? pill('LR', 'lr') : '') + (n.kind === 'Teamlid' ? pill('Team') : '') + '</div>' +
    '<p class="small muted" style="margin:2px 0 0 30px">Niveau ' + y.lvl + ' · PV <b>' + orgFmt(y.pv || 0) + '</b>' + (n.kind === 'Teamlid' || y.ogv ? ' · OGV <b>' + orgFmt(y.ogv || 0) + '</b>' : '') + (y.mwo != null ? ' · ' + orgAgo(y.mwo) : '') + (k.length ? ' · groep ' + (s.n + 0) + ' pers.' : '') + '</p></div>';
}
function orgNetListHtml() {
  const g = orgNodes(), q = normName(state.netq || ''), nf = state.netf || 'Boom';
  if (!q && nf !== 'Boom') {
    const lim = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10), hit = g.nodes.filter(n => nf === 'Team' ? n.kind === 'Teamlid' : nf === 'Nieuw' ? String(n.yl.since || '') >= lim : nf === 'Loyalty Rewards' ? !!n.yl.au : !!orgNeeds(n));
    hit.sort((a, b) => (b.yl.ogv || 0) - (a.yl.ogv || 0) || (b.yl.pv || 0) - (a.yl.pv || 0));
    return '<p class="small muted">' + hit.length + ' ' + (nf === 'Team' ? 'teamleden' : nf === 'Nieuw' ? 'nieuw in de laatste 45 dagen' : nf === 'Loyalty Rewards' ? 'met Loyalty Rewards' : 'die aandacht vragen') + '</p>' + (hit.slice(0, 60).map(n => orgNetRow(n, g, true)).join('') || '<p class="muted">Niemand.</p>');
  }
  if (q) { const hit = g.nodes.filter(n => normName(n.name).includes(q)); return '<p class="small muted">' + hit.length + ' gevonden</p>' + hit.slice(0, 60).map(n => orgNetRow(n, g, true)).join(''); }
  if (!g.ordered) { const by = {}; g.nodes.forEach(n => { (by[n.yl.lvl] = by[n.yl.lvl] || []).push(n); }); return '<p class="small muted">De boomstructuur is nog niet beschikbaar voor deze lijst. Importeer je rapport één keer opnieuw (Mijn hele organisatie), dan zie je wie onder wie zit. Tot dan staat iedereen per niveau.</p>' + Object.keys(by).sort((a, b) => a - b).map(l => '<h3 style="margin:12px 0 4px">Niveau ' + l + ' <span class="small muted">(' + by[l].length + ')</span></h3>' + by[l].sort((a, b) => (b.yl.pv || 0) - (a.yl.pv || 0) || a.name.localeCompare(b.name)).slice(0, 80).map(n => orgNetRow(n, g, true)).join('')).join(''); }
  const out = [], walk = n => { out.push(orgNetRow(n, g, false)); if ((state.netOpen || {})[n.id]) (g.kids.get(n.id) || []).forEach(walk); };
  g.roots.forEach(walk); return out.join('');
}
function orgNetHtml() {
  const g = orgNodes(); if (!g.nodes.length) return '<div class="card soft"><p>Nog geen netwerk. Importeer je organisatie uit het Virtual Office (Rapport uit Gmail of CSV). Het rapport moet de kolom Level bevatten.</p><div class="row"><button class="btn" data-act="org-import">Organisatie importeren</button></div></div>';
  const lr = g.nodes.filter(n => n.yl.au).length, team = g.nodes.filter(n => n.kind === 'Teamlid').length, pv = g.nodes.reduce((a, n) => a + (n.yl.pv || 0), 0), l1 = g.roots.length;
  const stat = (v, l) => '<div class="ost"><b>' + v + '</b><span class="small muted">' + l + '</span></div>';
  return '<div class="card soft ostats">' + stat(g.nodes.length, 'mensen') + stat(team, 'teamleden') + stat(lr, 'met LR') + stat(allContacts().filter(c => c.yl && orgNeeds(c)).length, 'aandacht') + '</div>' +
    '<div class="seg" role="group" aria-label="Weergave">' + ['Boom', 'Actie nodig', 'Team', 'Nieuw', 'Loyalty Rewards'].map(x => '<button class="chip" data-act="org-netf" data-f="' + x + '" aria-pressed="' + ((state.netf || 'Boom') === x) + '">' + x + '</button>').join('') + '</div>' +
    '<div class="row"><label class="f" style="flex:1"><span class="sr">Zoek in je netwerk</span><input type="search" data-input="netsearch" placeholder="Zoek op naam…" value="' + esc(state.netq || '') + '"></label>' + ((state.netf || 'Boom') === 'Boom' ? '<button class="btn ghost small" data-act="org-net-all" data-o="1">Alles open</button><button class="btn ghost small" data-act="org-net-all" data-o="0">Dicht</button>' : '') + '</div>' +
    '<div id="netlist" class="net">' + orgNetListHtml() + '</div>';
}
function orgYlHtml(c, cid) {
  const y = c && c.yl; if (!y) return ''; const a = orgAvg(c), rows = [['Loyalty Rewards', y.au ? 'Ja, dag ' + y.au : 'Nee'], ['Laatst besteld', y.mwo != null ? orgAgo(y.mwo) : '-'], ['PV deze maand', orgFmt(y.pv || 0)], ['Gemiddelde PV', a ? orgFmt(a.avg) + ' (over ' + a.n + ' maand' + (a.n === 1 ? '' : 'en') + ')' : '-']];
  if (c.kind === 'Teamlid') { rows.push(['OGV', orgFmt(y.ogv || 0)], ['PGV', orgFmt(y.pgv || 0)]); if (y.i != null) rows.push(['Direct in je lijn', String(y.kids || 0)]); }
  if (y.pm) { const sp = Object.keys(state.docs).map(k => state.docs[k]).find(x => x && x.yl && String(x.yl.mid) === String(y.pm)); if (sp) rows.push(['Sponsor', sp.name]); } if (y.since) rows.push(['Lid sinds', fmtDate(String(y.since).slice(0, 10))]);
  const sig = []; if (y.mwo >= 4) sig.push(y.mwo + ' maanden zonder bestelling'); if (y.au && !y.aus && y.last && String(y.last).slice(0, 7) !== todayKey().slice(0, 7) && new Date().getDate() > Number(y.au) + 1) sig.push('Loyalty Rewards van deze maand is niet verzonden'); if (!y.au && y.last) sig.push('Bestelt los, zonder Loyalty Rewards'); if (y.au && y.aus) sig.push('Loyalty Rewards is deze maand verzonden'); if (y.pv >= 100) sig.push('Al ' + orgFmt(y.pv) + ' PV deze maand'); if (sig.length) rows.push(['Opvallend', sig.join('. ')]);
  if (y.lvl) rows.push(['Niveau', String(y.lvl)]); if (y.act) rows.push(['Actief sinds', fmtDate(y.act)]); if (y.phone) rows.push(['Telefoon', y.phone]); if (y.city) rows.push(['Plaats', y.city]);
  const mk = cid ? '<div class="row"><button class="btn ghost small" data-act="org-kind" data-id="' + cid + '" data-k="' + (c.kind === 'Teamlid' ? 'Klant' : 'Teamlid') + '">' + (c.kind === 'Teamlid' ? 'Terug naar klant' : 'Maak teamlid (actief business)') + '</button><button class="btn small" data-act="org-now" data-id="' + cid + '">Wat nu?</button></div>' : '';
  return '<details class="pinfo" open><summary>Cijfers uit je rapport</summary><dl>' + rows.map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>' + mk + '</details>';
}
function orgAct(a, d) {
  if (a === 'org-kind') { const c0 = state.docs[d.id]; if (!c0) return true; save(d.id, Object.assign({}, c0, { kind: d.k, kindSet: true, updatedAt: new Date().toISOString() })); render(); toast(d.k === 'Teamlid' ? (c0.name + ' is nu teamlid.') : (c0.name + ' staat weer bij de klanten.')); return true; }
  if (a === 'org-filter') { state.orgf = d.f; state.orgmore = false; render(); return true; }
  if (a === 'org-mg-open') { state.mgOpen = !state.mgOpen; try { localStorage.setItem('lumo-mgopen', state.mgOpen ? '1' : ''); } catch (e) {} render(); return true; }
  if (a === 'org-gopen') { state.gopen = Object.assign({}, state.gopen); state.gopen[d.k] = !gOpen(d.k, d.k === 'comm' || d.k === 'org' || d.k === 's:Deze maand in cijfers'); try { localStorage.setItem('lumo-gopen', JSON.stringify(state.gopen)); } catch (e) {} render(); return true; }
  if (a === 'org-ch-add') { state.chAdd = !state.chAdd; render(); return true; }
  if (a === 'org-ch-save') { const m = (document.getElementById('ch-m') || {}).value, v = parseFloat(String((document.getElementById('ch-v') || {}).value || '').replace(',', '.')); if (!m || !(v >= 0)) { toast('Vul een bedrag in.'); return true; } const h = Object.assign({}, state.docs.commhist || {}); h[m] = { total: v }; h.updatedAt = new Date().toISOString(); save('commhist', h); state.chAdd = false; render(); return true; }
  if (a === 'org-mg-edit') { state.mgEdit = true; render(); return true; }
  if (a === 'org-mg-cancel') { state.mgEdit = false; render(); return true; }
  if (a === 'org-mg-save') { const m = (document.getElementById('mg-m') || {}).value, v = parseInt((document.getElementById('mg-t') || {}).value, 10); if (!m || (!(v > 0) && m.indexOf('rank') !== 0)) { toast('Vul een doel in.'); return true; } save('mgoal', { metric: m, target: v > 0 ? v : RANKS[m.slice(4)].ogv, updatedAt: new Date().toISOString() }); state.mgEdit = false; render(); return true; }
  if (a === 'org-more') { state.orgmore = true; render(); return true; }
  if (a === 'org-net') { state.netOpen = Object.assign({}, state.netOpen || {}); if (state.netOpen[d.id]) delete state.netOpen[d.id]; else state.netOpen[d.id] = true; render(); return true; }
  if (a === 'org-netf') { state.netf = d.f; render(); return true; }
  if (a === 'org-now') {
    const c = state.docs[d.id]; if (!c) return true; state.view = 'coach'; state.dialog = null; render(); window.scrollTo(0, 0);
    let q;
    if (d.k === 'leg') q = legPrompt(Object.assign({ id: d.id }, c));
    else q = c.name + ': wat is nu het slimste om te doen voor deze persoon?' + (d.why ? ' Waarom ze nu opkomt: ' + d.why + '.' : '') + ' Wat ik weet: ' + deepFacts(c) + '. Geef maximaal twee concrete acties, elk met een reden die nieuwe info of waarde bevat (geen losse check-in), en één kort bericht dat ik kan sturen met iets nuttigs erin. Zeg erbij als je iets mist.';
    coachSend(q); return true;
  }
  if (a === 'org-net-all') { const o = {}; if (d.o === '1') orgNodes().kids.forEach((v, k) => { o[k] = true; }); state.netOpen = o; render(); return true; }
  return false;
}

/* live bestellingen uit het VO (komen binnen via de extensie en de vo-ingest functie) */
const voOrders = () => Object.keys(state.docs).filter(i => i.startsWith('vobest-')).map(i => Object.assign({ id: i }, state.docs[i])).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
function voWhen(at) { const d = (at || '').slice(0, 10), t = (at || '').slice(11, 16), td = todayKey(); return (d === td ? 'vandaag' : d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '') + (t ? ' ' + t : ''); }
const voLabel = e => ({ new: 'Nieuw lid', conv: 'Prospect werd lid', stop: 'Autoship gestopt', fail: 'Autoship niet verzonden', idle: 'Geen bestelling' })[e.t] || (e.first ? 'Eerste bestelling' : e.lr ? 'Loyalty Rewards' : 'Eenmalig');
function voNotifyNew(l) {
  window.__voSeenN = window.__voSeenN || new Set();
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  l.filter(e => !e.seen && !window.__voSeenN.has(e.id)).slice(0, 5).forEach(e => { window.__voSeenN.add(e.id); try { new Notification(e.name + ': ' + voLabel(e).toLowerCase(), { body: (e.t && e.t !== 'order' ? (e.text || '') : orgFmt(e.pv || 0) + ' PV'), tag: e.id }); } catch (x) {} });
}
function voFeedHtml() {
  const l = voOrders(); if (!l.length) return '';
  voNotifyNew(l);
  const un = l.filter(e => !e.seen).length, perm = typeof Notification !== 'undefined' && Notification.permission === 'default';
  return '<section class="card" aria-labelledby="h-vo"><h2 id="h-vo">Bestellingen in je team' + (un ? ' ' + pill(un + ' nieuw', 'due') : '') + '</h2>' +
    l.slice(0, 8).map(e => '<div class="row"><b>' + esc(e.name) + '</b>' + (!e.t || e.t === 'order' ? pill(orgFmt(e.pv || 0) + ' PV') : '') + pill(voLabel(e), e.first || (e.t && e.t !== 'order') ? 'due' : 'lr') + '<span class="spacer"></span><span class="small muted">' + esc(voWhen(e.at)) + '</span>' + (e.cid && state.docs[e.cid] ? '<button class="btn ghost small" data-act="contact-edit" data-id="' + esc(e.cid) + '">Open</button>' : '') + '</div>' + (e.text ? '<div class="small muted">' + esc(e.text) + '</div>' : '')).join('') +
    '<div class="row">' + (un ? '<button class="btn ghost small" data-act="vo-seen">Alles gelezen</button>' : '') + (perm ? '<button class="btn ghost small" data-act="vo-notify">Meldingen aanzetten</button>' : '') + '</div></section>';
}

/* diepe links uit meldingen: ?open=<contact-id>&e=<soort> opent de coach met die persoon, ?v=<tab> een tabblad */
const DEEP_ASK = {
  order: 'heeft net besteld. Wat kan ik nu voor deze persoon doen?',
  new: 'is nieuw in mijn team. Wat zijn de beste eerste stappen in de eerste dagen?',
  stop: 'heeft de Loyalty Rewards (autoship) gestopt. Wat kan ik doen?',
  fail: 'heeft een Loyalty Rewards-bestelling die niet verzonden is. Wat kan ik doen?',
  idle: 'heeft al vier maanden niet besteld. Wat kan ik doen?',
  conv: 'was een prospect en heeft nu een account in mijn organisatie. Wat is de beste eerste stap?'
};
function deepFacts(c) {
  const y = c.yl || {};
  return [c.kind || 'Prospect', y.lvl ? 'niveau ' + y.lvl : '', y.since ? 'lid sinds ' + fmtDate(String(y.since).slice(0, 10)) : '', y.au ? 'Loyalty Rewards op dag ' + y.au + ' (' + orgFmt(y.aupv || 0) + ' PV)' : 'geen Loyalty Rewards', y.last ? 'laatste bestelling ' + fmtDate(String(y.last).slice(0, 10)) + ' (' + orgFmt(y.lpv || 0) + ' PV)' : '', y.mwo ? y.mwo + ' maanden zonder bestelling' : '', 'PV deze maand ' + orgFmt(y.pv || 0), c.kind === 'Teamlid' ? 'OGV ' + orgFmt(y.ogv || 0) + ', ' + (y.kids || 0) + ' direct' : '', c.stage ? 'fase ' + c.stage : '', c.note ? 'notitie: ' + c.note : ''].filter(Boolean).join('; ');
}
window.__deep = (function () { try { const p = new URLSearchParams(location.search), o = p.get('open'), v = p.get('v'), e = p.get('e'); if (o || v) { history.replaceState(null, '', location.pathname); return { open: o, v: v, e: e }; } } catch (x) { /* geen URL-ondersteuning */ } return null; })();
function deepGo(t) {
  if (!t) return false;
  if (t.open) {
    const c = state.docs[t.open]; if (!c) return false;
    if (t.e && DEEP_ASK[t.e]) {
      state.view = 'coach'; state.dialog = null; render(); window.scrollTo(0, 0);
      coachSend('Melding uit mijn organisatie: ' + c.name + ' ' + DEEP_ASK[t.e] + ' Wat ik weet: ' + deepFacts(c) + '. Geef maximaal twee concrete acties, elk met een reden die nieuwe info of waarde bevat (geen losse check-in), en één kort bericht dat ik kan sturen met iets nuttigs erin. Zeg erbij als je iets mist om dit goed te doen.');
      return true;
    }
    state.view = 'mensen'; state.sub.mensen = 'Klanten'; state.dialog = { type: 'contact', id: t.open }; state.focusNext = false; render(); window.scrollTo(0, 0); return true;
  }
  if (t.v) { state.view = t.v; state.dialog = null; render(); window.scrollTo(0, 0); return true; }
  return false;
}
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { const m = e.data; if (m && m.lumoOpen) { try { const p = new URL(m.lumoOpen, location.href).searchParams, t = { open: p.get('open'), v: p.get('v'), e: p.get('e') }; if (!state.ready || !deepGo(t)) window.__deep = t; } catch (x) { /* ongeldige link */ } } });

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

/* ---------- coach, briefing, content, check ---------- */
function scrollChat() { const el = $('#chat'); if (el && el.lastElementChild) el.lastElementChild.scrollIntoView({ block: 'end' }); }
function captureInputs() {
  const ci = $('#coachInput'); if (ci) state.coach.draft = ci.value;
  const t = $('#ct-topic'); if (t) state.content.topic = t.value;
  const ty = $('#ct-type'); if (ty) state.content.type = ty.value;
  const c = $('#chk-text'); if (c) state.check.text = c.value;
}
function coachPull() {
  const c = state.coach, d = state.docs['coach-chat']; if (c.busy || !d) return;
  if (c.at !== d.updatedAt) { c.msgs = (d.msgs || []).map(m => ({ role: m.role, text: m.text })); c.at = d.updatedAt; }
}
function coachPush() {
  const c = state.coach, at = new Date().toISOString();
  const msgs = c.msgs.filter(m => m.text).slice(-40).map(m => ({ role: m.role, text: String(m.text).slice(0, 8000) }));
  c.at = at; save('coach-chat', { msgs, updatedAt: at });
}
async function coachSend(text) {
  const c = state.coach; text = (text || '').trim(); if (!text || c.busy) return;
  c.msgs.push({ role: 'user', text }); c.draft = ''; c.busy = true; { const ci = $('#coachInput'); if (ci) { ci.value = ''; ci.style.height = 'auto'; } }
  const reply = { role: 'assistant', text: '' }; c.msgs.push(reply); render(); scrollChat();
  try {
    c.ctrl = new AbortController();
    const full = await aiStream(null, c.msgs.slice(0, -1), t => { reply.text = t; const els = document.querySelectorAll('#chat .msg.assistant'), el = els[els.length - 1]; if (el) { el.innerHTML = md(t); scrollChat(); } }, c.ctrl.signal);
    if (full) reply.text = full;
  } catch (e) { reply.text = reply.text || (e && e.code === 'none' ? 'De coach is in deze weergave niet beschikbaar. Open Lumo via claude.ai.' : aiErr(e)); }
  c.busy = false; c.ctrl = null; coachPush(); render(); scrollChat();
}
async function briefRun() {
  state.brief = { text: '', busy: true }; render();
  try {
    const full = await aiStream('Maak mijn ochtendbriefing in vier korte blokken met een vette kop: Vandaag (maximaal drie acties), Opvolgen (alleen wie een concrete reden heeft: nieuwe info of een nieuwe afspraak om aan te bieden; geen check-ins; staat er niemand, zeg dat dan), Binnenkort (wat eraan komt) en Eén zin om mee te starten. Gebruik mijn gegevens en verzin niets.', null, t => { state.brief.text = t; const el = $('#brief'); if (el) el.innerHTML = md(t); });
    if (full) state.brief.text = full;
  } catch (e) { state.brief.text = state.brief.text || (e && e.code === 'none' ? 'De coach is in deze weergave niet beschikbaar. Open Lumo via claude.ai.' : aiErr(e)); }
  state.brief.busy = false; render();
}
async function contentWrite() {
  const c = state.content; captureInputs(); if (!c.topic.trim()) { toast('Vul eerst een onderwerp in.'); return; }
  c.out = ''; c.busy = true; render();
  try {
    const full = await aiStream('Schrijf een ' + c.type + ' over: ' + c.topic + '. Schrijf in de stem van het lid (zie de schrijfstijl in het profiel als die er is). Geen inkomstenbeloften, geen gezondheidsclaims, geen druk. Geef één concept dat het lid zelf kan plaatsen, zonder uitleg eromheen.', null, t => { c.out = t; const el = $('#contentOut'); if (el) el.innerHTML = md(t); });
    if (full) c.out = full;
  } catch (e) { c.out = c.out || (e && e.code === 'none' ? 'De coach is in deze weergave niet beschikbaar.' : aiErr(e)); }
  c.busy = false; render();
}
async function contentWeek() {
  toast('De coach plant je week…');
  try {
    const t = todayKey(), list = await aiJSON('Plan voor de komende 7 dagen (vanaf ' + t + ') precies 5 contentideeën voor mijn socials, passend bij mijn doelen en stem, zonder claims. Antwoord alleen met een JSON-array van objecten met de velden "date" (YYYY-MM-DD), "platform" (Instagram-post, Verhaal, Reel-script of WhatsApp-status) en "idea" (één zin).');
    if (!Array.isArray(list) || !list.length) throw new Error('leeg');
    list.slice(0, 7).forEach(x => save(uid('content'), { date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : t, platform: x.platform || 'Idee', idea: String(x.idea || '').slice(0, 300), status: 'Idee', text: '' }));
    render(); toast('Week gepland.');
  } catch (e) { toast(e && e.code ? aiErr(e) : 'De coach kon geen planning maken. Probeer het opnieuw.'); }
}
async function checkRun() {
  const k = state.check; captureInputs(); if (!k.text.trim()) { toast('Plak eerst een tekst.'); return; }
  k.local = flagText(k.text); k.ai = null; k.busy = true; render();
  try {
    const r = await aiJSON('Beoordeel deze tekst op inkomensbeloften, uitspraken over verdienen, en gezondheidsclaims (genezen, behandelen, voorkomen, diagnose, medisch advies), en op druk of misleiding. Tekst:\n"""\n' + k.text.slice(0, 4000) + '\n"""\nAntwoord alleen met JSON: {"verdict":"ok" of "let op" of "niet doen","issues":[{"quote":"letterlijk citaat","why":"waarom een probleem","fix":"veiliger formulering"}],"rewrite":"een complete veilige versie van de tekst"}. Is de tekst in orde, laat issues dan leeg.');
    k.ai = { verdict: r.verdict || 'let op', issues: Array.isArray(r.issues) ? r.issues : [], rewrite: r.rewrite || '' };
  } catch (e) { toast(e && e.code ? aiErr(e) : 'De beoordeling is mislukt. Probeer het opnieuw.'); }
  k.busy = false; render();
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Gekopieerd.'); } catch (e) { toast('Kopiëren lukt hier niet. Selecteer de tekst en kopieer die zelf.'); } }

/* ---------- acties ---------- */
function markLibSeen() { if (state.view === 'team' && state.sub.team === 'Bibliotheek' && newLibCount()) setPrefs({ lastSeenLib: new Date().toISOString() }); }
function bumpGoal(id, delta) {
  const key = todayKey(), cur = clone(dayDoc(key)); cur.counts = cur.counts || {}; cur.date = key;
  cur.counts[id] = Math.max(0, (cur.counts[id] || 0) + delta); save('day-' + key, cur); render();
}
const val = id => { const e = $('#' + id); return e ? e.value : ''; };
function shuffleIdx(n) { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
async function closeAnd(fn) { state.dialog = null; if (fn) await fn(); render(); }

async function onAct(a, el, ev) {
  const d = el.dataset;
  if ((String(a).indexOf('camp-') === 0 || String(a).indexOf('org-') === 0) && await campAct(a, d, el)) return;
  if (String(a).indexOf('web-') === 0 && typeof webAct === 'function' && await webAct(a, d, el)) return;
  if (a === 'veil') { if (el === ev.target) { state.dialog = null; render(); } return; }
  if (a === 'nav') { markLibSeen(); state.view = d.view; state.dialog = null; state.editGoals = null; render(); window.scrollTo(0, 0); return; }
  if (a === 'sub') { markLibSeen(); state.sub[d.view] = d.sub; render(); return; }
  if (a === 'goto') { markLibSeen(); state.view = d.view; if (d.sub) state.sub[d.view] = d.sub; render(); window.scrollTo(0, 0); return; }
  if (a === 'inc') return bumpGoal(d.id, 1);
  if (a === 'dec') return bumpGoal(d.id, -1);
  if (a === 'overlay-close') { state.dialog = null; state.quiz = null; render(); return; }
  if (a === 'coach-more') { state.coach.more = !state.coach.more; render(); return; }
  if (a === 'mock-open') { state.dialog = { type: 'mock', kind: d.kind }; render(); return; }
  if (a === 'mock-noop') { toast('Voorbeeld: deze functie werkt nog niet.'); return; }
  if (a === 'demo-load') { await loadDemo(); return; }
  /* wizard */
  if (a === 'wiz-next') {
    readWizard(); const w = state.wiz;
    if (w.step === 0 && !w.consent) { toast('Vink eerst de toestemming aan om verder te gaan.'); return; }
    if (w.step === 1 && !w.name) { toast('Vul je naam in.'); return; }
    if (w.step === 2) { w.goals = w.goals.filter(g => g.label.trim()); if (!w.goals.length) { toast('Kies minstens één dagdoel.'); return; } state.editGoals = null; }
    w.step++; state.focusNext = true; render(); window.scrollTo(0, 0); return;
  }
  if (a === 'wiz-back') { readWizard(); state.wiz.step--; state.editGoals = null; render(); return; }
  if (a === 'wiz-finish') {
    readWizard(); const w = state.wiz;
    save('profile', { name: w.name, goal: w.goal, why: w.why, tone: w.tone, lang: 'nl', goals: w.goals.map(g => ({ id: g.id || uid('g'), label: g.label.trim(), target: g.target })), consentAt: new Date().toISOString(), createdAt: new Date().toISOString() });
    state.view = 'vandaag'; state.editGoals = null; render(); return;
  }
  if (a === 'goal-add') {
    const inW = needsWizard(); if (inW) readWizard();
    const list = readGoalsKeepEmpty(); list.push({ id: uid('g'), label: '', target: 1 }); if (inW) state.wiz.goals = list; state.editGoals = list;
    render(); const rows = document.querySelectorAll('#goaled .goalrow input[data-g=label]'); if (rows.length) rows[rows.length - 1].focus(); return;
  }
  if (a === 'goal-del') { const inW = needsWizard(), list = readGoalsKeepEmpty(); list.splice(parseInt(d.i, 10), 1); if (inW) state.wiz.goals = list; state.editGoals = list; render(); return; }
  /* contacten */
  if (a === 'contact-new') { state.dialog = { type: 'contact', id: 'new' }; state.focusNext = true; render(); return; }
  if (a === 'contact-edit') { state.dialog = { type: 'contact', id: d.id }; state.focusNext = true; render(); return; }
  if (a === 'contact-save') {
    const name = val('c-name').trim(); if (!name) { toast('Vul een naam in.'); return; }
    const id = d.id === 'new' ? uid('contact') : d.id;
    return closeAnd(() => save(id, { name, kind: val('c-kind'), stage: val('c-stage'), next: val('c-next'), birthday: val('c-birth'), lastOrder: val('c-last'), cycle: val('c-cycle'), startDate: val('c-start'), note: val('c-note').trim(), info: (state.docs[id] || {}).info, org: (state.docs[id] || {}).org, yl: (state.docs[id] || {}).yl, hist: (state.docs[id] || {}).hist, kindSet: (state.docs[id] || {}).kindSet || ((state.docs[id] || {}).org && val('c-kind') !== (state.docs[id] || {}).kind) || undefined, updatedAt: new Date().toISOString() }));
  }
  if (a === 'contact-del') { remove(d.id); state.dialog = null; render(); toast('Contact verwijderd.'); return; }
  /* workshops */
  if (a === 'event-new') { state.dialog = { type: 'event', id: 'new' }; state.focusNext = true; render(); return; }
  if (a === 'event-edit') { state.dialog = { type: 'event', id: d.id }; state.focusNext = true; render(); return; }
  if (a === 'event-save') {
    const title = val('e-title').trim(); if (!title) { toast('Geef de workshop een titel.'); return; }
    const id = d.id === 'new' ? uid('event') : d.id, old = (state.docs[id] || {}).attendees || [];
    const att = val('e-att').split('\n').map(x => x.trim()).filter(Boolean).map(n => ({ name: n, status: (old.find(o => o.name === n) || {}).status || 'Uitgenodigd' }));
    return closeAnd(() => save(id, { title, date: val('e-date'), place: val('e-place').trim(), note: val('e-note').trim(), attendees: att }));
  }
  if (a === 'event-del') { remove(d.id); state.dialog = null; render(); return; }
  if (a === 'att-contact') {
    const w = state.docs[d.id], at = w.attendees[parseInt(d.i, 10)];
    save(uid('contact'), { name: at.name, kind: 'Prospect', stage: 'Nieuw', next: addDays(todayKey(), 2), note: 'Gast van workshop "' + w.title + '".', updatedAt: new Date().toISOString() }); render(); toast(at.name + ' staat nu in je pipeline.'); return;
  }
  /* coach */
  if (a === 'coach-chip') { markLibSeen(); state.view = 'coach'; render(); coachSend(d.prompt); return; }
  if (a === 'coach-send') { coachSend($('#coachInput').value); return; }
  if (a === 'coach-stop') { if (state.coach.ctrl) state.coach.ctrl.abort(); return; }
  if (a === 'coach-reset') { state.coach.msgs = []; coachPush(); render(); return; }
  if (a === 'copy') { copyText(state.coach.msgs[parseInt(d.i, 10)].text); return; }
  if (a === 'to-check') { state.check.text = state.coach.msgs[parseInt(d.i, 10)].text; state.check.local = null; state.check.ai = null; state.view = 'coach'; state.coach.more = true; render(); window.scrollTo(0, 0); return; }
  if (a === 'brief-run') { briefRun(); return; }
  /* content en controle */
  if (a === 'content-write') { contentWrite(); return; }
  if (a === 'content-copy') { copyText(state.content.out); return; }
  if (a === 'content-check') { state.check.text = state.content.out; state.check.local = null; state.check.ai = null; state.view = 'coach'; state.coach.more = true; render(); window.scrollTo(0, 0); return; }
  if (a === 'content-plan') { save(uid('content'), { date: addDays(todayKey(), 1), platform: state.content.type, idea: state.content.topic || 'Idee', status: 'Klaar', text: state.content.out }); render(); toast('Ingepland voor morgen.'); return; }
  if (a === 'content-new') { state.dialog = { type: 'content', id: 'new' }; state.focusNext = true; render(); return; }
  if (a === 'content-save') { const idea = val('k-idea').trim(); if (!idea) { toast('Vul een idee in.'); return; } return closeAnd(() => save(uid('content'), { date: val('k-date') || todayKey(), platform: val('k-type'), idea, status: 'Idee', text: '' })); }
  if (a === 'content-week') { contentWeek(); return; }
  if (a === 'content-del') { remove(d.id); render(); return; }
  if (a === 'check-run') { checkRun(); return; }
  if (a === 'check-copy') { copyText(state.check.ai.rewrite); return; }
  /* cijfers */
  if (a === 'fig-clear') { remove('figures'); render(); toast('Cijfers verwijderd.'); return; }
  if (a === 'rank-save') { setPrefs({ rank: { name: val('rk-name'), col: parseInt(val('rk-col'), 10) || 0, target: val('rk-target'), deadline: val('rk-dead'), newTarget: val('rk-new') } }); render(); toast('Opgeslagen.'); return; }
  /* bibliotheek en training */
  if (a === 'lib-cat') { state.libCat = d.cat; render(); return; }
  if (a === 'lib-camp') { const it = libAll().find(x => x.id === d.id); if (!it) return; state.view = 'team'; state.sub.team = 'Campagnes'; state.dialog = { type: 'campedit', id: 'new', draft: { status: 'draft', steps: [], threshold: null, libId: it.id, title: it.title } }; state.focusNext = false; render(); return; }
  if (a === 'lib-new') { state.dialog = { type: 'lib', id: 'new' }; state.focusNext = true; render(); return; }
  if (a === 'lib-edit') { state.dialog = { type: 'lib', id: d.id }; state.focusNext = true; render(); return; }
  if (a === 'lib-save') {
    const title = val('l-title').trim(), text = val('l-text').trim(); if (!title || !text) { toast('Vul een titel en tekst in.'); return; }
    const old = libAll().find(x => x.id === d.id) || {}, central = d.id === 'new' ? val('l-scope') === 'central' : !!old.central, id = d.id === 'new' ? uid(central ? 'clib' : 'lib') : d.id;
    const item = { title, category: val('l-cat'), text, note: val('l-note').trim(), prevText: old.text && old.text !== text ? old.text : (old.prevText || ''), updatedAt: new Date().toISOString() };
    if (await putShared(central ? 'glibrary' : 'library', id, item)) { if (store.mode === 'local') { /* lokale watcher werkt bij */ } state.dialog = null; render(); } return;
  }
  if (a === 'lib-del') { const dl = libAll().find(x => x.id === d.id); if (await dropShared(dl && dl.central ? 'glibrary' : 'library', d.id)) { state.dialog = null; render(); } return; }
  if (a === 'train-new') { state.dialog = { type: 'train', id: 'new' }; state.focusNext = true; render(); return; }
  if (a === 'train-edit') { state.dialog = { type: 'train', id: d.id }; state.focusNext = true; render(); return; }
  if (a === 'train-save') {
    const title = val('t-title').trim(); if (!title) { toast('Geef de les een titel.'); return; }
    const quiz = val('t-quiz').split('\n').map(l => l.split('|').map(x => x.trim()).filter(Boolean)).filter(p => p.length >= 3).map(p => ({ q: p[0], a: p.slice(1), c: 0 }));
    if (await putShared('training', d.id === 'new' ? uid('tr') : d.id, { title, category: val('t-cat').trim(), desc: val('t-desc').trim(), url: val('t-url').trim(), quiz })) { state.dialog = null; render(); } return;
  }
  if (a === 'train-del') { if (await dropShared('training', d.id)) { state.dialog = null; render(); } return; }
  if (a === 'quiz-start') { const tr = sh('training').find(x => x.id === d.id); state.quiz = { id: d.id, i: 0, score: 0, picked: null, order: tr.quiz.map(q => shuffleIdx(q.a.length)) }; state.dialog = { type: 'quiz' }; render(); return; }
  if (a === 'quiz-ans') { const qz = state.quiz, tr = sh('training').find(x => x.id === qz.id), o = parseInt(d.o, 10); qz.picked = o; if (o === tr.quiz[qz.i].c) qz.score++; render(); return; }
  if (a === 'quiz-next') {
    const qz = state.quiz, tr = sh('training').find(x => x.id === qz.id); qz.i++; qz.picked = null;
    if (qz.i >= tr.quiz.length) { const q = Object.assign({}, prefs().quiz || {}), prev = q[qz.id]; q[qz.id] = { best: Math.max(prev ? prev.best : 0, qz.score), of: tr.quiz.length, at: new Date().toISOString() }; setPrefs({ quiz: q }); }
    render(); return;
  }
  /* draaiboek, agenda, uitdaging */
  if (a === 'play-new') { state.dialog = { type: 'play', id: 'new' }; state.focusNext = true; render(); return; }
  if (a === 'play-edit') { state.dialog = { type: 'play', id: d.id }; state.focusNext = true; render(); return; }
  if (a === 'play-save') { const title = val('p-title').trim(); if (!title) { toast('Geef de stap een titel.'); return; } if (await putShared('playbook', d.id === 'new' ? uid('pb') : d.id, { day: parseInt(val('p-day'), 10) || 1, title, text: val('p-text').trim() })) { state.dialog = null; render(); } return; }
  if (a === 'play-del') { if (await dropShared('playbook', d.id)) { state.dialog = null; render(); } return; }
  if (a === 'agenda-new') { state.dialog = { type: 'agenda', id: 'new' }; state.focusNext = true; render(); return; }
  if (a === 'agenda-edit') { state.dialog = { type: 'agenda', id: d.id }; state.focusNext = true; render(); return; }
  if (a === 'agenda-save') { const title = val('a-title').trim(), date = val('a-date'); if (!title || !date) { toast('Vul een titel en datum in.'); return; } if (await putShared('agenda', d.id === 'new' ? uid('ag') : d.id, { title, date, time: val('a-time').trim(), place: val('a-place').trim(), note: val('a-note').trim() })) { state.dialog = null; render(); } return; }
  if (a === 'agenda-del') { if (await dropShared('agenda', d.id)) { state.dialog = null; render(); } return; }
  if (a === 'chal-edit') { state.dialog = { type: 'chal' }; state.focusNext = true; render(); return; }
  if (a === 'chal-save') { const title = val('ch-title').trim(); if (!title) { toast('Geef de uitdaging een titel.'); return; } if (await putShared('challenge', 'current', { title, desc: val('ch-desc').trim(), start: val('ch-start'), end: val('ch-end') })) { state.dialog = null; render(); } return; }
  if (a === 'chal-del') { if (await dropShared('challenge', 'current')) { state.dialog = null; render(); } return; }
  if (a === 'chal-today') {
    const ch = sh('challenge')[0], t = todayKey(), cur = prefs().challenge || {}, days = Object.assign({}, cur.id === ch.id ? cur.days : {});
    if (days[t]) delete days[t]; else days[t] = true; setPrefs({ challenge: { id: ch.id, days } }); render(); return;
  }
  /* mentor, erkenning, hulp */
  if (a === 'mentor-save') {
    const role = val('m-role');
    if (role === 'geen') { await dropShared('mentors', meId()); toast('Je staat niet meer in de lijst.'); }
    else if (await putShared('mentors', meId(), { name: profile().name, role, text: val('m-text').trim(), contact: val('m-contact').trim() })) toast('Opgeslagen.');
    render(); return;
  }
  if (a === 'kudos-give') {
    const sel = $('#k-to'); if (!sel.value) { toast('Kies eerst een lid.'); return; }
    if (await putShared('kudos', uid('kd'), { to: sel.value, toName: sel.options[sel.selectedIndex].text, badge: val('k-badge'), note: val('k-note').trim(), at: new Date().toISOString() })) { toast('Erkenning verstuurd.'); render(); } return;
  }
  if (a === 'help-send') { const text = val('h-text').trim(); if (!text) { toast('Schrijf kort waar je hulp bij nodig hebt.'); return; } if (await putShared('help', meId(), { name: profile().name, text, at: new Date().toISOString() })) { setPrefs({ helpOpen: true, helpText: text }); render(); } return; }
  if (a === 'help-clear') { await dropShared('help', meId()); setPrefs({ helpOpen: false, helpText: '' }); render(); return; }
  /* instellingen */
  if (a === 'set-save') {
    const goals = readGoals(); if (!goals.length) { toast('Houd minstens één dagdoel over.'); return; }
    const name = val('s-name').trim(); if (!name) { toast('Vul een naam in.'); return; }
    save('profile', Object.assign({}, profile(), { name, goal: val('s-goal').trim(), why: val('s-why').trim(), lang: val('s-lang'), voice: val('s-voice').trim(), tone: (document.querySelector('input[name=s-tone]:checked') || {}).value || profile().tone, goals }));
    state.editGoals = null; render(); toast('Opgeslagen.'); return;
  }
  if (a === 'share-save') {
    const on = $('#sh-on').checked, sections = { score: $('#sh-score').checked, streak: $('#sh-streak').checked, active: $('#sh-active').checked, pipeline: $('#sh-pipe').checked, playbook: $('#sh-play').checked };
    setPrefs({ share: { on, sections } }); state.sig.shares = '';
    if (!on) { await dropShared('shares', meId()); toast('Je deelt niets meer met je upline.'); } else { await syncNow(); toast('Opgeslagen. Je upline ziet alleen wat je hebt aangevinkt.'); }
    render(); return;
  }
  if (a === 'data-download') { const out = { exportedAt: new Date().toISOString(), data: state.docs }; try { await store.dl.save({ filename: 'lumo-mijn-gegevens.json', data: JSON.stringify(out, null, 2) }); } catch (e) { toast('Downloaden is geannuleerd of mislukt.'); } return; }
  if (a === 'data-wipe') { state.dialog = { type: 'wipe' }; state.focusNext = true; render(); return; }
  if (a === 'data-wipe-confirm') { await wipeAll(); return; }
}

async function wipeAll() {
  try { await Promise.all(Object.keys(state.docs).map(id => store.delMine(id))); } catch (e) { toast('Niet alles kon worden gewist. Probeer het opnieuw.'); return; }
  const me = meId();
  for (const n of ['shares', 'board', 'mentors', 'help', 'campshares']) { try { await store.delShared(n, me); } catch (e) { /* bestond niet */ } }
  if (store.isAdmin) {
    for (const n of SHARED) for (const it of sh(n).filter(x => String(x.id).startsWith('demo-') || (n === 'challenge' && x.demo))) { try { await store.delShared(n, it.id); } catch (e) { /* laat staan */ } }
    SHARED.forEach(n => { state.shared[n] = sh(n).filter(x => !String(x.id).startsWith('demo-') && !(n === 'challenge' && x.demo)); });
  }
  state.docs = {}; state.dialog = null; state.sig = {}; state.brief = null; state.coach = { msgs: [], busy: false, ctrl: null, draft: '' };
  state.content = { type: 'Instagram-post', topic: '', out: '', busy: false }; state.check = { text: '', local: null, ai: null, busy: false };
  state.wiz = { step: 0, consent: false, name: '', goal: '', why: '', tone: 'warm', goals: clone(SUGGEST) }; state.editGoals = null; state.view = 'vandaag';
  render(); toast('Alles is gewist.');
}
async function loadDemo() {
  const docs = demoDocs();
  try {
    state.docs = docs; await Promise.all(Object.keys(docs).map(id => store.setMine(id, docs[id])));
    if (store.isAdmin) { const ds = demoShared(); for (const n of Object.keys(ds)) for (const it of ds[n]) { const c = Object.assign({}, it); delete c.id; await putShared(n, it.id, c); } }
  } catch (e) { toast('Voorbeeldgegevens laden is mislukt.'); }
  state.view = 'vandaag'; render();
}

/* ---------- events ---------- */
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; onAct(el.dataset.act, el, e); });
document.addEventListener('change', async e => {
  const el = e.target, k = el.dataset && el.dataset.change; if (!k) return;
  if (k === 'stage') { const c = state.docs[el.dataset.id]; if (c) { save(el.dataset.id, Object.assign({}, c, { stage: el.value, updatedAt: new Date().toISOString() })); render(); } }
  if (k === 'att-status') { const w = clone(state.docs[el.dataset.id]); w.attendees[parseInt(el.dataset.i, 10)].status = el.value; save(el.dataset.id, w); render(); }
  if (k === 'content-status') { const c = state.docs[el.dataset.id]; if (c) { save(el.dataset.id, Object.assign({}, c, { status: el.value })); render(); } }
  if (k === 'play-done') { const dn = Object.assign({}, prefs().done || {}); dn[el.dataset.id] = el.checked; setPrefs({ done: dn }); render(); }
  if (k === 'board-toggle') { setPrefs({ board: el.checked }); if (!el.checked) { state.sig.board = ''; await dropShared('board', meId()); } render(); }
  if (k === 'role') { const r = window.__roles[parseInt(el.value, 10)]; if (r) { state.view = 'coach'; render(); coachSend('Speel een rollenspel met me. Jij bent ' + r[1] + '. Ik ben een wellness-ondernemer die een gesprek voert. Blijf in je rol en reageer kort, zoals een echt mens. Begin met een openingszin. Als ik "stop" typ, geef je feedback: wat ging goed, wat kan beter en één tip.'); } }
  if (k === 'script') { const s = window.__scripts[parseInt(el.value, 10)]; if (s) { state.view = 'coach'; render(); coachSend('Schrijf ' + s[1] + '. Geef twee varianten (kort en iets uitgebreider), zonder druk en zonder claims.'); } }
  if (k === 'follow') { const c = state.docs[el.value]; if (c) { state.view = 'coach'; render(); coachSend('Schrijf een kort bericht voor ' + c.name + ' (' + (c.kind || 'Prospect') + ', fase ' + c.stage + (c.note ? ', notitie: ' + c.note : '') + '). Geef één concept dat ik zelf kan versturen.'); } }
  if (k === 'web-push-hour') { try { await window.__lumoWeb.push.setHour(parseInt(el.value, 10)); webPushSt = null; webPushLoad(true); toast('Tijd opgeslagen.'); } catch (e) { toast('Dat lukte niet.'); } return; }
  if (k === 'camp-kind') { const dlg = state.dialog; if (dlg && dlg.type === 'campedit') { dlg.draft = campReadDraft(dlg); dlg.draft.kind = el.value; render(); } return; }
  if (k === 'camp-task') { const id = state.camp.id, doc = clone(campDoc(id)); doc.tasks = doc.tasks || {}; if (el.checked) doc.tasks[el.dataset.id] = new Date().toISOString(); else delete doc.tasks[el.dataset.id]; saveCamp(id, doc); render(); return; }
  if (k === 'camp-share') { const id = el.dataset.id, doc = clone(campDoc(id)); doc.share = el.value; save('camp-' + id, doc); render(); toast(el.value === 'off' ? 'Je deelt niets meer voor deze campagne.' : 'Gedeeld met je upline.'); return; }
  if (k === 'org-sort') { state.orgsort = el.value; render(); return; }
  if (k === 'org-file') { const f = el.files && el.files[0]; if (!f) return; if (f.size > 1500000) { toast('Dit bestand is te groot.'); return; } f.arrayBuffer().then(buf => { let t = new TextDecoder('utf-8').decode(buf); if (t.includes('\uFFFD')) t = new TextDecoder('windows-1252').decode(buf); const ta = $('#org-paste'); if (ta) { ta.value = t.replace(/^\uFEFF/, ''); toast('Bestand geladen. Kies Controleren.'); } }, () => toast('Het bestand kon niet worden gelezen.')); return; }
  if (k === 'camp-file') { const f = el.files && el.files[0]; if (!f) return; if (f.size > 500000) { toast('Dit bestand is te groot.'); return; } const r = new FileReader(); r.onload = () => { const ta = $('#cp-paste'); if (ta) ta.value = String(r.result || '').slice(0, 60000); }; r.onerror = () => toast('Het bestand kon niet worden gelezen.'); r.readAsText(f); return; }
  if (k === 'fig-file' || k === 'lib-file') {
    const f = el.files && el.files[0]; if (!f) return;
    if (f.size > 1500000) { toast('Dit bestand is te groot. Kies een bestand kleiner dan 1,5 MB.'); return; }
    const r = new FileReader();
    r.onload = () => {
      const text = String(r.result || '');
      if (k === 'lib-file') { const ta = $('#l-text'); if (ta) ta.value = text.slice(0, 60000); const t = $('#l-title'); if (t && !t.value) t.value = f.name.replace(/\.[^.]+$/, ''); return; }
      const rows = parseCSV(text); if (rows.length < 2) { toast('Geen tabel gevonden. Controleer of het een CSV-bestand is.'); return; }
      const headers = rows[0].slice(0, 12).map(h => h.trim().slice(0, 60));
      save('figures', { name: f.name, headers, rows: rows.slice(1, 301).map(r => headers.map((_, i) => String(r[i] || '').trim().slice(0, 80))), importedAt: new Date().toISOString() }); render(); toast('Cijfers geladen.');
    };
    r.onerror = () => toast('Het bestand kon niet worden gelezen.'); r.readAsText(f);
  }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && el.dataset.input === 'orgsearch') { state.orgq = el.value; const box = $('#orglist'); if (box) box.innerHTML = orgListHtml(); return; }
  if (el.dataset && el.dataset.input === 'netsearch') { state.netq = el.value; const box = $('#netlist'); if (box) box.innerHTML = orgNetListHtml(); return; }
  if (el.dataset && el.dataset.input === 'campsearch') { state.camp.q = el.value; state.camp.limit = 30; const c = campById(state.camp.id), box = $('#camplist'); if (c && box) box.innerHTML = campBody(c); return; }
  if (el.dataset && el.dataset.input === 'libsearch') {
    state.libSearch = el.value; const q = state.libSearch.toLowerCase(), cat = state.libCat;
    $('#liblist').innerHTML = libList(libAll().filter(i => (cat === 'Alles' || i.category === cat) && (!q || (i.title + ' ' + i.text).toLowerCase().includes(q))));
  }
  if (el.id === 'coachInput') { el.style.height = 'auto'; el.style.height = Math.min(140, el.scrollHeight) + 'px'; }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.dialog) { state.dialog = null; state.quiz = null; render(); }
  if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'coachInput') { e.preventDefault(); coachSend(e.target.value); }
});
document.addEventListener('focusout', () => { setTimeout(() => { if (state.pending) softRender(); }, 150); });

/* ---------- start ---------- */
(async function start() {
  render();
  await store.init();
  let first = true;
  store.watchMine((list, fellBack) => {
    const docs = {}; list.forEach(d => { const id = d.id, c = Object.assign({}, d); delete c.id; docs[id] = c; });
    state.docs = pendApply(docs); state.ready = true;
    if (first) { first = false; render(); if (fellBack) toast('Opslag niet bereikbaar: lokale modus.'); } else softRender();
    if (window.__deep && deepGo(window.__deep)) window.__deep = null;
  });
  SHARED.forEach(n => store.watchShared(n, list => {
    state.shared[n] = list.map(d => Object.assign({}, d));
    if (state.ready && !state.dialog) softRender();
  }));
})();

