import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { DateTime } from 'luxon';
import { TASHKENT } from '@/lib/tz';

type Block = { start: string; end: string; label?: string };

export async function GET() {
  const sb = supabaseAdmin();
  const today = DateTime.now().setZone(TASHKENT).toISODate()!;
  const { data } = await sb
    .from('schedule_templates')
    .select('id, is_active, active_from, active_to, blocks')
    .eq('is_active', true)
    .lte('active_from', today)
    .or(`active_to.is.null,active_to.gte.${today}`)
    .order('active_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json(data ?? null);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: me } = await sb.from('users').select('is_admin').eq('email', session.user.email).single();
  if (!me?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json();
  const blocks: Block[] = body?.blocks ?? [];
  const active_from: string =
    body?.active_from ?? DateTime.now().setZone(TASHKENT).toISODate()!;
  const active_to: string | null = body?.active_to ?? null;

  if (!Array.isArray(blocks) || blocks.length === 0)
    return NextResponse.json({ error: 'blocks required' }, { status: 400 });

  // Deactivate other templates if this one is active
  await sb.from('schedule_templates').update({ is_active: false }).eq('is_active', true);
  const { error } = await sb.from('schedule_templates').insert({
    is_active: true, active_from, active_to, blocks
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
