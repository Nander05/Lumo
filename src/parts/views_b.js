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
  const app = $('#app'), ci = $('#coachInput'); if (ci) state.coach.draft = ci.value; state.pending = false;
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
