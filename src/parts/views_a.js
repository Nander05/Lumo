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
