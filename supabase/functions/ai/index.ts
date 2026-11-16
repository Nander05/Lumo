// Supabase Edge Function "ai". Zet deze bij: supabase functions deploy ai
// Secrets: ANTHROPIC_API_KEY (verplicht), ANTHROPIC_MODEL en AI_MONTHLY_LIMIT (optioneel).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handle } from './handler.js';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const asUser = (req: Request) => createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
const admin = createClient(url, service);

Deno.serve((req: Request) => handle(req, {
  env: { ANTHROPIC_API_KEY: Deno.env.get('ANTHROPIC_API_KEY'), ANTHROPIC_MODEL: Deno.env.get('ANTHROPIC_MODEL'), AI_MONTHLY_LIMIT: Deno.env.get('AI_MONTHLY_LIMIT'), AI_MAX_CHARS: Deno.env.get('AI_MAX_CHARS') },
  fetch: (u: string, o: RequestInit) => fetch(u, o),
  getUser: async (r: Request) => { const { data } = await asUser(r).auth.getUser(); return data && data.user ? data.user : null; },
  isMember: async (r: Request) => { const { data } = await asUser(r).rpc('team_info'); return !!data; },
  aiUse: async (uid: string, limit: number) => { const { data, error } = await admin.rpc('ai_use', { p_user: uid, p_limit: limit }); return !error && data === true; },
}));
