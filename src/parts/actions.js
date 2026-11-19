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
