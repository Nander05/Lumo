// Supabase Edge Function "push": dagelijkse herinnering + testmelding.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), PUSH_CRON_SECRET.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, service);
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'https://nander05.github.io/Lumo/', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

function localParts(tz: string) {
  let p: Record<string, string> = {};
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; }); }
  catch { return localParts('Europe/Brussels'); }
  return { date: p.year + '-' + p.month + '-' + p.day, md: p.month + '-' + p.day, hour: parseInt(p.hour, 10) };
}

async function digest(uid: string, date: string, md: string) {
  const { data: mem } = await admin.from('members').select('display_name, team_id').eq('user_id', uid).limit(1);
  const name = (mem && mem[0] && mem[0].display_name) || '';
  const teamId = mem && mem[0] && mem[0].team_id;
  if (!teamId) return null;
  const { data: docs } = await admin.from('docs').select('id, data').eq('team_id', teamId).eq('path', 'data/users/' + uid).like('id', 'contact%');
  const due: string[] = [], birthdays: string[] = [];
  for (const d of docs || []) {
    const c: any = d.data || {};
    if (c.next && String(c.next) <= date) due.push(c.name || 'Iemand');
    if (c.birthday && String(c.birthday).slice(5, 10) === md) birthdays.push(c.name || 'Iemand');
  }
  if (!due.length && !birthdays.length) return null;
  const list = (a: string[]) => a.slice(0, 3).join(', ') + (a.length > 3 ? ' en ' + (a.length - 3) + ' anderen' : '');
  const parts: string[] = [];
  if (due.length) parts.push(due.length === 1 ? 'Opvolgen: ' + list(due) : due.length + ' mensen om op te volgen: ' + list(due));
  if (birthdays.length) parts.push('Jarig vandaag: ' + list(birthdays));
  return { title: 'Goedemorgen' + (name ? ', ' + name.split(' ')[0] : ''), body: parts.join('. ') + '.' };
}

async function send(sub: any, payload: unknown) {
  try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3600 }); return true; }
  catch (e: any) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await admin.from('push_subs').delete().eq('id', sub.id); return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return J({ error: 'method' }, 405);
  let body: any = {}; try { body = await req.json(); } catch { /* leeg */ }

  if (body.action === 'cron') {
    const secret = Deno.env.get('PUSH_CRON_SECRET');
    if (!secret || req.headers.get('x-cron-secret') !== secret) return J({ error: 'auth' }, 401);
    const { data: subs } = await admin.from('push_subs').select('*');
    const cache: Record<string, any> = {}; let sent = 0;
    for (const s of subs || []) {
      const t = localParts(s.tz || 'Europe/Brussels');
      if (t.hour !== s.hour || s.last_sent === t.date) continue;
      const key = s.user_id + t.date;
      if (!(key in cache)) cache[key] = await digest(s.user_id, t.date, t.md);
      await admin.from('push_subs').update({ last_sent: t.date }).eq('id', s.id);
      if (cache[key] && await send(s, { ...cache[key], url: './' })) sent++;
    }
    return J({ ok: true, sent });
  }

  const auth = req.headers.get('Authorization') || '';
  const { data } = await createClient(url, anon, { global: { headers: { Authorization: auth } } }).auth.getUser();
  if (!data || !data.user) return J({ error: 'auth' }, 401);
  if (body.action === 'test') {
    const { data: subs } = await admin.from('push_subs').select('*').eq('user_id', data.user.id);
    let sent = 0;
    for (const s of subs || []) if (await send(s, { title: 'Lumo', body: 'Dit is een testmelding. Het werkt!', url: './' })) sent++;
    return J({ ok: true, sent });
  }
  return J({ error: 'bad' }, 400);
});
