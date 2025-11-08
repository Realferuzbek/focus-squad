// app/api/admin/schedule/override/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { supabaseAdmin } from "@/lib/supabaseServer";

type Block = { start: string; end: string; label?: string };

export async function GET(req: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    const message = guard.message === "unauthorized" ? "Unauthorized" : "Admin only";
    return NextResponse.json({ error: message }, { status: guard.status });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("schedule_overrides")
    .select("*")
    .eq("for_date", date)
    .maybeSingle();

  return NextResponse.json(data ?? null);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    const message = guard.message === "unauthorized" ? "Unauthorized" : "Admin only";
    return NextResponse.json({ error: message }, { status: guard.status });
  }

  const sb = supabaseAdmin();
  const { data: me } = await sb
    .from("users")
    .select("is_admin")
    .eq("email", guard.user.email)
    .single();

  if (!me?.is_admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json();
  const date: string = body?.date;
  const blocks: Block[] = body?.blocks ?? [];
  if (!date || !Array.isArray(blocks)) {
    return NextResponse.json({ error: "date and blocks required" }, { status: 400 });
  }

  const { error } = await sb
    .from("schedule_overrides")
    .upsert({ for_date: date, blocks }, { onConflict: "for_date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    const message = guard.message === "unauthorized" ? "Unauthorized" : "Admin only";
    return NextResponse.json({ error: message }, { status: guard.status });
  }

  const sb = supabaseAdmin();
  const { data: me } = await sb
    .from("users")
    .select("is_admin")
    .eq("email", guard.user.email)
    .single();

  if (!me?.is_admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const { error } = await sb.from("schedule_overrides").delete().eq("for_date", date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
