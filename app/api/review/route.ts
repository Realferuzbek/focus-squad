import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { broadcast } from '@/lib/broadcast';

export async function POST(req: NextRequest) {
  const session = await auth ();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();

  const { data: admin } = await sb
    .from('users')
    .select('id, is_admin')
    .eq('email', session.user.email)
    .single();

  if (!admin?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { taskId, status, note } = await req.json();
  if (!taskId || !['completed', 'not_done'].includes(status)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { error } = await sb.from('task_reviews').upsert({
    task_id: taskId,
    reviewer_id: admin.id,
    status,
    note: note?.slice(0, 40) ?? null
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await broadcast('task_reviewed', { taskId, status });
  return NextResponse.json({ ok: true });
}
