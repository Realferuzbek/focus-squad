import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { supabaseAdmin } from '@/lib/supabaseServer';
import { TASHKENT } from '@/lib/tz';
import { DateTime } from 'luxon';

type Block = { start: string; end: string; label?: string };

// Helper: compute blocks for a date from overrides or current template
async function getBlocksForDate(sb: ReturnType<typeof supabaseAdmin>, dateISO: string): Promise<Block[]> {
  const { data: o } = await sb
    .from('schedule_overrides')
    .select('blocks')
    .eq('for_date', dateISO)
    .maybeSingle();

  if (o?.blocks) return o.blocks as Block[];

  const { data: t } = await sb
    .from('schedule_templates')
    .select('blocks, active_from, active_to')
    .eq('is_active', true)
    .lte('active_from', dateISO)
    .or(`active_to.is.null,active_to.gte.${dateISO}`)
    .order('active_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (t?.blocks as Block[]) ?? [];
}

function slotStart(dateISO: string, hhmm: string) {
  return DateTime.fromISO(`${dateISO}T${hhmm}:00`, { zone: TASHKENT });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const date = url.searchParams.get('date') ?? DateTime.now().setZone(TASHKENT).toISODate()!;

  // Resolve the current user and guard null for TS + runtime
  const { data: userRow } = await sb
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .maybeSingle();

  if (!userRow?.id) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const userId: string = userRow.id;

  const blocks = await getBlocksForDate(sb, date);

  const { data: notes } = await sb
    .from('slot_plans')
    .select('slot_index, note')
    .eq('user_id', userId)
    .eq('for_date', date);

  const noteMap = new Map<number, string>((notes ?? []).map((n: any) => [n.slot_index as number, n.note as string]));
  const now = DateTime.now().setZone(TASHKENT);

  const rows = blocks.map((b, i) => {
    const start = slotStart(date, b.start);
    const locked = now >= start;
    return {
      index: i,
      start: b.start,
      end: b.end,
      label: b.label ?? null,
      note: noteMap.get(i) ?? '',
      locked,
    };
  });

  return NextResponse.json({ date, blocks: rows });
}

export async function POST(req: NextRequest) {
 const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { date, index, note } = await req.json();

  if (!date || typeof index !== 'number' || index < 0 || typeof note !== 'string') {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  }

  // Resolve user and guard null
  const { data: userRow } = await sb
    .from('users')
    .select('id, is_admin')
    .eq('email', session.user.email)
    .maybeSingle();

  if (!userRow?.id) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const userId: string = userRow.id;
  const isAdmin: boolean = Boolean((userRow as any).is_admin);

  const blocks = await getBlocksForDate(sb, date);
  if (!blocks[index]) {
    return NextResponse.json({ error: 'Unknown slot' }, { status: 400 });
  }

  // Lock at start time, except admins OR when running locally (dev convenience)
  const isDev = process.env.NODE_ENV === 'development';
  const hasStarted = DateTime.now().setZone(TASHKENT) >= slotStart(date, blocks[index].start);
  if (hasStarted && !isAdmin && !isDev) {
    return NextResponse.json({ error: 'Slot locked' }, { status: 403 });
  }

  const { error } = await sb
    .from('slot_plans')
    .upsert(
      { user_id: userId, for_date: date, slot_index: index, note: note.trim() },
      { onConflict: 'user_id,for_date,slot_index' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
