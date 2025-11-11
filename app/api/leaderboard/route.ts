export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminGuard';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { todayTashkent } from '@/lib/tz';

export async function GET(req: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    const message = guard.message === "unauthorized" ? "Unauthorized" : "Admin only";
    return NextResponse.json({ error: message }, { status: guard.status });
  }
  const meEmail = guard.user.email;
  const url = new URL(req.url);
  const period = url.searchParams.get('period') ?? 'today';

  const sb = supabaseAdmin();
  const { data: users } = await sb.from('users').select('id, email, display_name, avatar_url, is_admin');

  const today = todayTashkent();
  const { data: todayTasks } = await sb.from('tasks').select('id, user_id, content').eq('for_date', today);
  const { data: reviews } = await sb.from('task_reviews').select('task_id, status');
  const statusByTask = new Map((reviews ?? []).map(r => [r.task_id, r.status]));

  const perUser = new Map<string, { completed: number; total: number }>();
  (todayTasks ?? []).forEach(t => {
    const s = statusByTask.get(t.id);
    const u = perUser.get(t.user_id) ?? { completed: 0, total: 0 };
    u.total += 1;
    if (s === 'completed') u.completed += 1;
    perUser.set(t.user_id, u);
  });

  const { data: streaks } = await sb.from('streaks').select('user_id, current_streak, longest_streak');
  const streakIndex = new Map((streaks ?? []).map(s => [s.user_id, s]));

  const rows = (users ?? []).map(u => {
    const agg = perUser.get(u.id) ?? { completed: 0, total: 0 };
    const st = streakIndex.get(u.id) ?? { current_streak: 0, longest_streak: 0 };
    const completionRate = agg.total ? agg.completed / agg.total : 0;
    return {
      email: u.email,
      display_name: u.display_name,
      streak: st.current_streak,
      longest: st.longest_streak,
      completionRate,
      todayTasks: (todayTasks ?? []).filter(t => t.user_id === u.id).map(t => ({ id: t.id, content: t.content })),
      isMe: u.email === meEmail,
    };
  });

  rows.sort((a, b) => {
    if (b.streak !== a.streak) return b.streak - a.streak;
    if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
    return b.longest - a.longest;
  });

  // (period param reserved for later; same result for now)
  return NextResponse.json(rows);
}
