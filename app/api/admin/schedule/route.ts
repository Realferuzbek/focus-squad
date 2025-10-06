import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: me } = await sb.from('users').select('is_admin').eq('email', session.user.email).single();
  if (!me?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { data: tpl, error } = await sb
    .from('schedule_templates')
    .select('id, active_from, active_to, is_active, blocks')
    .eq('is_active', true)
    .order('active_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: tpl ?? null });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: me } = await sb.from('users').select('is_admin').eq('email', session.user.email).single();
  if (!me?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { activeFrom, blocks } = await req.json();
  if (!activeFrom || !Array.isArray(blocks) || blocks.length === 0) {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  }

  // close previous active template if needed
  const { data: prev } = await sb
    .from('schedule_templates')
    .select('id, active_from')
    .eq('is_active', true)
    .order('active_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prev) {
    await sb
      .from('schedule_templates')
      .update({ active_to: activeFrom, is_active: false })
      .eq('id', prev.id);
  }

  const { error } = await sb.from('schedule_templates').insert({
    active_from: activeFrom,
    is_active: true,
    blocks,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
