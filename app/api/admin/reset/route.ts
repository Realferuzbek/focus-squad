export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    const message = guard.message === "unauthorized" ? "Unauthorized" : "Admin only";
    return NextResponse.json({ error: message }, { status: guard.status });
  }

  let relink = false;
  try {
    const body = await req.json();
    relink = !!body?.relink;
  } catch {
    relink = false;
  }

  const sb = supabaseAdmin();
  const { data: existing } = await sb
    .from("app_state")
    .select("session_version")
    .eq("id", 1)
    .maybeSingle();

  const nextVersion = (existing?.session_version ?? 1) + 1;

  const { error: stateError } = await sb.from("app_state").upsert({
    id: 1,
    session_version: nextVersion,
    require_tg_relink: relink,
    updated_at: new Date().toISOString(),
  });

  if (stateError) {
    return NextResponse.json({ error: stateError.message }, { status: 500 });
  }

  if (relink) {
    const { error: resetError } = await sb
      .from("users")
      .update({ telegram_user_id: null, telegram_username: null });
    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, session_version: nextVersion, relink });
}
