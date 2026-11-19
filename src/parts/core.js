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
