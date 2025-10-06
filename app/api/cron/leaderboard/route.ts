// app/api/cron/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { DateTime } from 'luxon';
import { tgSendText } from '@/lib/telegram';

function authOK(req: NextRequest) {
  const hdr = req.headers.get('authorization') || '';
  return hdr === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!authOK(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = supabaseAdmin();
  const today = DateTime.now().setZone('Asia/Tashkent').toISODate()!;

  const [{ data: users }, { data: tasks }, { data: reviews }, { data: streaks }] = await Promise.all([
    sb.from('users').select('id, display_name, email'),
    sb.from('tasks').select('id, user_id, content').eq('for_date', today),
    sb.from('task_reviews').select('task_id, status'),
    sb.from('streaks').select('user_id, current_streak, longest_streak'),
  ]);

  const statusByTask = new Map((reviews ?? []).map(r => [r.task_id, r.status]));
  const per = new Map<string, { total: number; done: number }>();
  (tasks ?? []).forEach(t => {
    const cur = per.get(t.user_id) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (statusByTask.get(t.id) === 'completed') cur.done += 1;
    per.set(t.user_id, cur);
  });

  const streakIndex = new Map((streaks ?? []).map(s => [s.user_id, s]));
  const rows = (users ?? []).map(u => {
    const p = per.get(u.id) ?? { total: 0, done: 0 };
    const st = streakIndex.get(u.id) ?? { current_streak: 0, longest_streak: 0 };
    const rate = p.total ? Math.round((p.done / p.total) * 100) : 0;
    return { name: u.display_name || u.email.split('@')[0], rate, streak: st.current_streak, longest: st.longest_streak };
  });

  rows.sort((a, b) => (b.streak - a.streak) || (b.rate - a.rate) || (b.longest - a.longest));
  const top = rows.slice(0, 10);

  const lines = ['<b>🏆 Focus Squad — Top 10 (today)</b>', ''];
  top.forEach((r, i) => lines.push(`${i + 1}. ${r.name} — ${r.rate}% · 🔥${r.streak}`));
  const text = lines.join('\n');

  await tgSendText(process.env.TELEGRAM_GROUP_ID!, text);
  return NextResponse.json({ ok: true, posted: top.length });
}
