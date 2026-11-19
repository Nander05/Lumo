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
