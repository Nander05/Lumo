// Supabase Edge Function "inbox": ontvangt een CSV-rapport van het Gmail-scriptje van een lid.
// Zet "Verify JWT" UIT. De functie controleert zelf de geheime sleutel van het lid.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { unzipSync } from 'https://esm.sh/fflate@0.8.2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const sha = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))).map((b) => b.toString(16).padStart(2, '0')).join('');

// Haalt een rapport op via een downloadlink uit de mail (de link is voor Google's script te lang).
// Alleen links van youngliving.com als start (het trackingdomein heeft geen geldig https-certificaat, dus de eerste stap mag http zijn),
// daarna alleen https en geen interne adressen onderweg.
const okHost = (h: string) => !/^(\d{1,3}\.){3}\d{1,3}$/.test(h) && !h.includes(':') && h !== 'localhost' && !/\.(local|internal|localhost)$/.test(h) && h.includes('.');
async function fetchReport(link: string): Promise<{ text: string; name?: string } | { error: string; status?: number; type?: string }> {
  let u: URL; try { u = new URL(link); } catch { return { error: 'url' }; }
  if (link.length > 12000 || (u.protocol !== 'https:' && u.protocol !== 'http:') || !(u.hostname === 'youngliving.com' || u.hostname.endsWith('.youngliving.com'))) return { error: 'host' };
  let res: Response | null = null;
  for (let i = 0; i < 6; i++) {
    if (!okHost(u.hostname) || (u.protocol !== 'https:' && i > 0)) return { error: 'redirect' };
    try { res = await fetch(u.toString(), { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (Lumo)' } }); } catch (e) { return { error: 'fetch', status: 0, type: String(e).slice(0, 120) }; }
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) { try { u = new URL(loc, u); } catch { return { error: 'redirect' }; } continue; }
    break;
  }
  if (!res || res.status !== 200) return { error: 'link', status: res ? res.status : 0 };
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (type.includes('html')) return { error: 'html', status: 200, type };
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > 3000000) return { error: 'size' };
  let data = buf, name = (res.headers.get('content-disposition') || '').match(/filename="?([^";]+)"?/i)?.[1] || 'Downline Viewer CSV report.csv';
  if (type.includes('zip') || (buf[0] === 0x50 && buf[1] === 0x4b)) {
    try { const files = unzipSync(buf); const n = Object.keys(files).find((x) => /\.(csv|tsv|txt)$/i.test(x)); if (!n) return { error: 'zip' }; data = files[n]; name = n; } catch { return { error: 'zip' }; }
  }
  let text = new TextDecoder('utf-8').decode(data); if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(data);
  return { text: text.replace(/^\uFEFF/, ''), name };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return J({ error: 'method' }, 405);
  let b: any; try { b = await req.json(); } catch { return J({ error: 'json' }, 400); }
  const key = String(b.key || '');
  let csv = String(b.csv || '');
  if (!/^lk_[0-9a-f]{48}$/.test(key)) return J({ error: 'key' }, 401);
  const { data: k } = await admin.from('inbox_keys').select('user_id').eq('key_hash', await sha(key)).maybeSingle();
  if (!k) return J({ error: 'key' }, 401);
  let filename = String(b.filename || '').slice(0, 200);
  const subject = String(b.subject || '').slice(0, 300);
  if (!csv.trim() && b.url) {
    const got = await fetchReport(String(b.url));
    if ('error' in got) return J(got, 422);
    csv = got.text; if (got.name && !filename) filename = got.name.slice(0, 200);
  }
  if (!csv.trim() || csv.length > 1400000) return J({ error: 'size' }, 413);
  const { error } = await admin.from('report_inbox').insert({ user_id: k.user_id, filename, subject, body: csv, content_hash: await sha(csv) });
  if (error) { if (String(error.code) === '23505') return J({ ok: true, duplicate: true }); return J({ error: 'opslaan' }, 500); }
  const { data: old } = await admin.from('report_inbox').select('id').eq('user_id', k.user_id).order('created_at', { ascending: false }).range(20, 200);
  if (old && old.length) await admin.from('report_inbox').delete().in('id', old.map((x: any) => x.id));
  return J({ ok: true });
});
