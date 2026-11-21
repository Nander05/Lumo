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
/* Regels van het Europese compensatieplan op één plek.
   Bron: YL "Comp Plan" trainingen 1 tot 3 (EU, 19 nov 2026) en controle tegen YL Insights (unilevel EUR 328 en persoonlijke generatie EUR 124
   kwamen uit op EUR 329 en EUR 125; Fast Start EUR 21 tegen EUR 18).
   Niet gemodelleerd: leiderschapsbonus (gedeelde pot), generaties 2 tot 4, rangbonus, starterkitbonus (EUR 22), eigen 100 PV, afhoudingen.
   Let op: Fast Start gaat naar de enroller en niet naar de sponsor; de extensie kent alleen de sponsor. */
const PLAN = {
  ranks: { Silver: { ogv: 10000, legs: 2, leg: 4000, pgv: 1000 }, Gold: { ogv: 35000, legs: 3, leg: 6000, pgv: 1000 } },
  unilevel: [0.08, 0.05, 0.04, 0.04, 0.04], depthByOgv: [[4000, 5], [2000, 4], [500, 3], [0, 2]], qualPv: 100,
  fastStart: { l1: 0.25, l2: 0.10, minPv: 50, months: 3, otherPayoutShare: 0.3, capPvPerMonth: 1000 },
  personalGeneration: 0.025, generation2plus: 0.03, eurPerPv: 0.88,
  rankBonus: { 'Senior Star': 88, Executive: 132, Silver: 176, months: 3 }, starterKitBonus: 22
};
const RANKS = PLAN.ranks;
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
  voOrders().filter(e => (e.t === 'new' || e.t === 'conv' || e.t === 'stop' || e.t === 'pend') && String(e.at || '').slice(0, 10) >= lim && state.docs[e.cid]).forEach(e => add(Object.assign({ id: e.cid }, state.docs[e.cid]), voLabel(e), 1));
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
const COMM_RATES = PLAN.unilevel, COMM_EUR = PLAN.eurPerPv;
function commEst(scen) {
  const N = orgNodes(), d = new Date(), td = d.getDate(), x = new Date(d.getFullYear(), d.getMonth() - (PLAN.fastStart.months - 1), 1), lim = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-01';
  const base = c => scen === 'now' ? (c.yl.pv || 0) : (c.yl.pv || 0) + (c.yl.au && !c.yl.aus && Number(c.yl.au) >= td ? (c.yl.aupv || 0) : 0);
  const isFs = c => String(c.yl.since || '').slice(0, 10) >= lim && base(c) >= PLAN.fastStart.minPv, vol = c => isFs(c) ? base(c) * PLAN.fastStart.otherPayoutShare : base(c), fsPv = c => Math.min(base(c), PLAN.fastStart.capPvPerMonth);
  const per = [0, 0, 0, 0, 0]; let fs = 0, all = 0;
  const walk = (n, level, carry) => {
    const kids = N.kids.get(n.id) || [], v = vol(n); all += vol(n);
    if (isFs(n)) { if (Number(n.yl.lvl) === 1) fs += fsPv(n) * PLAN.fastStart.l1; else if (Number(n.yl.lvl) === 2) fs += fsPv(n) * PLAN.fastStart.l2; }
    if (base(n) >= PLAN.qualPv) { if (level <= 5) per[level - 1] += v + carry; kids.forEach(k => walk(k, level + 1, 0)); }
    else {
      const best = kids.slice().sort((a, b) => base(b) - base(a))[0];
      if (!kids.length) { if (level <= 5) per[level - 1] += v + carry; }
      kids.forEach(k => walk(k, level, k === best ? v + carry : 0));
    }
  };
  N.roots.forEach(r => walk(r, 1, 0));
  const og = Math.round(all), depth = PLAN.depthByOgv.find(x => og >= x[0])[1];
  const uni = per.reduce((a, v, i) => a + (i < depth ? v * COMM_RATES[i] : 0), 0) * COMM_EUR;
  return { per, uni: Math.round(uni * 100) / 100, fs: Math.round(fs * COMM_EUR * 100) / 100, gen: Math.round(all * PLAN.personalGeneration * COMM_EUR * 100) / 100, depth };
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
    '<p class="small muted">Gebaseerd op het Europese plan: 8, 5 en 4% op vijf niveaus met compressie onder 100 PV, Fast Start 25% en 10% op de eerste drie maanden, en 1 PV als \u20ac0,88 (de omrekenkoers van YL zelf). Het is een schatting en geen belofte van inkomen. De leiderschapsbonus, rangbonussen en afhoudingen zitten er niet in.</p>';
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
const voLabel = e => ({ new: 'Nieuw lid', conv: 'Prospect werd lid', stop: 'Autoship gestopt', fail: 'Autoship niet verzonden', idle: 'Geen bestelling', pend: 'Bestelling niet bevestigd', lrchg: 'LR gewijzigd' })[e.t] || (e.first ? 'Eerste bestelling' : e.lr ? 'Loyalty Rewards' : 'Eenmalig');
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
  pend: 'heeft een bestelling waarvan de PV nog niet is bijgeschreven (mogelijk een betaalprobleem). Wat kan ik doen?',
  lrchg: 'heeft het geplande Loyalty Rewards-bedrag gewijzigd. Wat kan ik doen?',
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
