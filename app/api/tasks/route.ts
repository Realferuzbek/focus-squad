import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { supabaseAdmin } from '@/lib/supabaseServer';
import { todayTashkent, isAfterTen } from '@/lib/tz';
import { rateLimit } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  const session = await auth (authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get('date') ?? todayTashkent();

  const sb = supabaseAdmin();

  // Find current user
  const { data: user, error: userErr } = await sb
    .from('users')
    .select('*')
    .eq('email', session.user.email)
    .single();
  if (userErr || !user) return NextResponse.json([], { status: 200 });

  // Tasks + reviews joined in code
  const { data: tasks } = await sb
    .from('tasks')
    .select('id, content, created_at, for_date')
    .eq('user_id', user.id)
    .eq('for_date', date);

  const { data: reviews } = await sb
    .from('task_reviews')
    .select('task_id, status, note')
    .in('task_id', (tasks ?? []).map(t => t.id));

  const statusMap = new Map((reviews ?? []).map(r => [r.task_id, r]));
  const rows = (tasks ?? []).map(t => ({
    ...t,
    status: statusMap.get(t.id)?.status ?? null,
    note: statusMap.get(t.id)?.note ?? null
  }));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  // very light IP-based limiter
  const key = req.headers.get('x-forwarded-for') ?? 'anon';
  if (!rateLimit(`tasks:${key}`, 60, 60_000).ok) {
    return NextResponse.json({ error: 'Slow down' }, { status: 429 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Enforce 10:00 Tashkent lock in production; allow in local dev for testing
  if (process.env.NODE_ENV !== 'development' && isAfterTen()) {
    return NextResponse.json({ error: 'Task entry closed' }, { status: 403 });
  }

  const body = await req.json();
  const content: unknown = body?.content;

  if (typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
  }

  const lines = content
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return NextResponse.json({ error: 'No tasks' }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const { data: user } = await sb
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .single();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 400 });

  const toInsert = lines.map(s => ({
    user_id: user.id,
    content: s,
    for_date: todayTashkent()
  }));

  const { error } = await sb.from('tasks').insert(toInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
