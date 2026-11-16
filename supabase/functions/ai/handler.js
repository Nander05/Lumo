// Lumo AI-functie: controleert de gebruiker, telt het gebruik en praat met de Claude API.
// De API-sleutel staat alleen hier op de server en komt nooit in de browser.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const J = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const JSON_RULE = 'Antwoord uitsluitend met geldige JSON, zonder uitleg en zonder codeblok.';

export function extractJSON(text) {
  const m = String(text || '').match(/[\[{][\s\S]*[\]}]/);
  if (!m) throw new Error('geen JSON');
  return JSON.parse(m[0]);
}

export async function handle(req, deps) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return J({ error: 'method' }, 405);
  const env = deps.env;
  const user = await deps.getUser(req);
  if (!user) return J({ error: 'auth', message: 'Log opnieuw in.', detail: (deps.authError && deps.authError()) || '' }, 401);
  if (!(await deps.isMember(req))) return J({ error: 'team', message: 'Je zit nog in geen team.' }, 403);

  let body;
  try { body = await req.json(); } catch (e) { return J({ error: 'bad', message: 'Ongeldig verzoek.' }, 400); }
  const msgs = Array.isArray(body.messages) ? body.messages : null;
  if (!msgs || !msgs.length || msgs.length > 60 || msgs.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) return J({ error: 'bad', message: 'Ongeldig verzoek.' }, 400);
  const chars = msgs.reduce((n, m) => n + m.content.length, 0);
  const maxChars = Number(env.AI_MAX_CHARS || 150000);
  if (chars > maxChars) return J({ error: 'size', message: 'Het verzoek is te groot.' }, 413);

  const limit = Number(env.AI_MONTHLY_LIMIT || 400);
  if (!(await deps.aiUse(user.id, limit))) return J({ error: 'limit', message: 'Je AI-tegoed voor deze maand is op. Het wordt volgende maand weer aangevuld.' }, 429);

  const wantJson = !!body.json, stream = !!body.stream && !wantJson;
  const payload = { model: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: wantJson ? 4000 : 2000, messages: msgs, stream };
  if (wantJson) payload.system = JSON_RULE;
  let up;
  try {
    up = await deps.fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  } catch (e) { return J({ error: 'upstream', message: 'De AI is nu niet bereikbaar.' }, 502); }
  if (!up.ok) return J({ error: 'upstream', message: 'De AI gaf een fout. Probeer het zo opnieuw.' }, 502);

  if (!stream) {
    const out = await up.json();
    const text = (out.content || []).map(c => c.text || '').join('');
    if (wantJson) { try { return J({ json: extractJSON(text) }); } catch (e) { return J({ error: 'json', message: 'Het antwoord was geen geldige JSON.' }, 502); } }
    return J({ text });
  }
  const enc = new TextEncoder(), dec = new TextDecoder();
  let buf = '';
  const ts = new TransformStream({
    transform(chunk, ctl) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        try {
          const ev = JSON.parse(line.slice(5).trim());
          if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') ctl.enqueue(enc.encode('data: ' + JSON.stringify({ t: ev.delta.text }) + '\n\n'));
          if (ev.type === 'message_stop') ctl.enqueue(enc.encode('data: [DONE]\n\n'));
          if (ev.type === 'error') ctl.enqueue(enc.encode('data: ' + JSON.stringify({ error: 'upstream' }) + '\n\n'));
        } catch (e) { /* regel overslaan */ }
      }
    },
  });
  return new Response(up.body.pipeThrough(ts), { headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}
