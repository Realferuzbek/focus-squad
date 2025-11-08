export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from "@/lib/adminGuard"; 
import { supabaseAdmin } from "@/lib/supabaseServer";
import { broadcast } from '@/lib/broadcast';

export async function POST(req: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    const message = guard.message === "unauthorized" ? "Unauthorized" : "Admin only";
    return NextResponse.json({ error: message }, { status: guard.status });
  }

  const sb = supabaseAdmin();

  const { data: admin } = await sb
    .from('users')
    .select('id, is_admin')
    .eq('email', guard.user.email)
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
