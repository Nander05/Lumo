// Supabase Edge Function "inbox": ontvangt een CSV-rapport van het Gmail-scriptje van een lid.
// Zet "Verify JWT" UIT. De functie controleert zelf de geheime sleutel van het lid.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const sha = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))).map((b) => b.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return J({ error: 'method' }, 405);
  let b: any; try { b = await req.json(); } catch { return J({ error: 'json' }, 400); }
  const key = String(b.key || ''), csv = String(b.csv || '');
  if (!/^lk_[0-9a-f]{48}$/.test(key)) return J({ error: 'key' }, 401);
  if (!csv.trim() || csv.length > 1400000) return J({ error: 'size' }, 413);
  const { data: k } = await admin.from('inbox_keys').select('user_id').eq('key_hash', await sha(key)).maybeSingle();
  if (!k) return J({ error: 'key' }, 401);
  const filename = String(b.filename || '').slice(0, 200), subject = String(b.subject || '').slice(0, 300);
  const { error } = await admin.from('report_inbox').insert({ user_id: k.user_id, filename, subject, body: csv, content_hash: await sha(csv) });
  if (error) { if (String(error.code) === '23505') return J({ ok: true, duplicate: true }); return J({ error: 'opslaan' }, 500); }
  const { data: old } = await admin.from('report_inbox').select('id').eq('user_id', k.user_id).order('created_at', { ascending: false }).range(20, 200);
  if (old && old.length) await admin.from('report_inbox').delete().in('id', old.map((x: any) => x.id));
  return J({ ok: true });
});
