// Lumo AI-functie als één bestand, om in het Supabase-dashboard te plakken.
// Secrets: ANTHROPIC_API_KEY (verplicht), ANTHROPIC_MODEL en AI_MONTHLY_LIMIT (optioneel).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Lumo AI-functie: controleert de gebruiker, telt het gebruik en praat met de Claude API.
// De API-sleutel staat alleen hier op de server en komt nooit in de browser.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const J = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const JSON_RULE = 'Antwoord uitsluitend met geldige JSON, zonder uitleg en zonder codeblok.';

function extractJSON(text: unknown) {
  const m = String(text || '').match(/[\[{][\s\S]*[\]}]/);
  if (!m) throw new Error('geen JSON');
  return JSON.parse(m[0]);
}

async function handle(req: Request, deps: any) {
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
  const payload: any = { model: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: wantJson ? 4000 : 2000, messages: msgs, stream };
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

// Supabase Edge Function "ai". Zet deze bij: supabase functions deploy ai
// Secrets: ANTHROPIC_API_KEY (verplicht), ANTHROPIC_MODEL en AI_MONTHLY_LIMIT (optioneel).

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const asUser = (req: Request) => createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
const admin = createClient(url, service);
let lastAuthErr = '';

Deno.serve((req: Request) => handle(req, {
  env: { ANTHROPIC_API_KEY: Deno.env.get('ANTHROPIC_API_KEY'), ANTHROPIC_MODEL: Deno.env.get('ANTHROPIC_MODEL'), AI_MONTHLY_LIMIT: Deno.env.get('AI_MONTHLY_LIMIT'), AI_MAX_CHARS: Deno.env.get('AI_MAX_CHARS') },
  fetch: (u: string, o: RequestInit) => fetch(u, o),
  authError: () => lastAuthErr,
  getUser: async (r: Request) => {
    lastAuthErr = 'v3';
    const t = (r.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!t) { lastAuthErr = 'v3 geen token'; return null; }
    try { const { data, error } = await admin.auth.getUser(t); if (error) { lastAuthErr = 'v3 ' + error.message; return null; } return data && data.user ? data.user : null; }
    catch (e) { lastAuthErr = 'v3 ' + String(e && (e as Error).message || e); return null; }
  },
  isMember: async (r: Request) => { const { data } = await asUser(r).rpc('team_info'); return !!data; },
  aiUse: async (uid: string, limit: number) => { const { data, error } = await admin.rpc('ai_use', { p_user: uid, p_limit: limit }); return !error && data === true; },
}));
