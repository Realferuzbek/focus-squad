import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: me } = await sb.from('users').select('is_admin').eq('email', session.user.email).single();
  if (!me?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { data: users } = await sb
    .from('users')
    .select('email, display_name, is_admin, is_blocked')
    .order('email');

  const { data: allow } = await sb.from('admin_allowlist').select('email').order('email');
  return NextResponse.json({ users: users ?? [], allowlist: allow ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: me } = await sb.from('users').select('is_admin').eq('email', session.user.email).single();
  if (!me?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { action, email, blocked } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  if (action === 'allowlist:add') {
    const { error } = await sb.from('admin_allowlist').upsert({ email });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'allowlist:remove') {
    const { error } = await sb.from('admin_allowlist').delete().eq('email', email);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'admin:promote') {
    const { error } = await sb.from('users').update({ is_admin: true }).eq('email', email);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'admin:demote') {
    const { error } = await sb.from('users').update({ is_admin: false }).eq('email', email);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'user:block') {
    const { error } = await sb.from('users').update({ is_blocked: !!blocked }).eq('email', email);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
