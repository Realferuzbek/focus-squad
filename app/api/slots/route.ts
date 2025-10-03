import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { TASHKENT } from '@/lib/tz';
import { DateTime } from 'luxon';

// Helper: compute blocks for a date from overrides or current template
async function getBlocksForDate(sb: ReturnType<typeof supabaseAdmin>, dateISO: string) {
  const { data: o } = await sb.from('schedule_overrides').select('blocks').eq('for_date', dateISO).maybeSingle();
  if (o?.blocks) return o.blocks as Array<{ start: string; end: string; label?: string }>;

  const { data: t } = await sb
    .from('schedule_templates')
    .select('blocks, active_from, active_to')
    .eq('is_active', true)
    .lte('active_from', dateISO)
    .or(`active_to.is.null,active_to.gte.${dateISO}`)
    .order('active_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (t?.blocks as Array<{ start: string; end: string; label?: string }>) ?? [];
}

function slotStart(dateISO: string, hhmm: string) {
  return DateTime.fromISO(`${dateISO}T${hhmm}:00`, { zone: TASHKENT });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const date = url.searchParams.get('date') ?? DateTime.now().setZone(TASHKENT).toISODate()!;

  // user id
  const { data: user } = await sb.from('users').select('id').eq('email', session.user.email).single();

  const blocks = await getBlocksForDate(sb, date);

  const { data: notes } = await sb
    .from('slot_plans')
    .select('slot_index, note')
    .eq('user_id', user.id)
    .eq('for_date', date);

  const noteMap = new Map((notes ?? []).map((n) => [n.slot_index, n.note]));
  const now = DateTime.now().setZone(TASHKENT);

  const rows = blocks.map((b, i) => {
    const start = slotStart(date, b.start);
    const locked = now >= start;
    return { index: i, start: b.start, end: b.end, label: b.label ?? null, note: noteMap.get(i) ?? '', locked };
  });

  return NextResponse.json({ date, blocks: rows });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();
  const { date, index, note } = await req.json();

  if (!date || typeof index !== 'number' || index < 0 || typeof note !== 'string') {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  }

  // who am I
  const { data: user } = await sb.from('users').select('id, is_admin').eq('email', session.user.email).single();

  const blocks = await getBlocksForDate(sb, date);
  if (!blocks[index]) return NextResponse.json({ error: 'Unknown slot' }, { status: 400 });

  // lock at start time, except admins OR when running locally (dev convenience)
  const isDev = process.env.NODE_ENV === 'development';
  const hasStarted = DateTime.now().setZone(TASHKENT) >= slotStart(date, blocks[index].start);
  if (hasStarted && !user.is_admin && !isDev) {
    return NextResponse.json({ error: 'Slot locked' }, { status: 403 });
  }

  const { error } = await sb
    .from('slot_plans')
    .upsert({ user_id: user.id, for_date: date, slot_index: index, note: note.trim() }, { onConflict: 'user_id,for_date,slot_index' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
