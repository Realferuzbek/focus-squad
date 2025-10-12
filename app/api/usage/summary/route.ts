export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

type UsageRow = {
  user_id: string;
  started_at: string;
  last_seen_at: string;
};

export async function GET() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.is_admin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("usage_sessions")
    .select("user_id,started_at,last_seen_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totals = new Map<string, number>();

  const rows = (data ?? []) as UsageRow[];

  rows.forEach((row) => {
    const startTs = new Date(row.started_at).getTime();
    const endTs = new Date(row.last_seen_at).getTime();
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) return;
    const hours = (endTs - startTs) / (1000 * 60 * 60);
    totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + hours);
  });

  const summary = Array.from(totals.entries())
    .map(([userId, hours]) => ({
      user_id: userId,
      hours: Number(hours.toFixed(2)),
    }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 100);

  return NextResponse.json({ totals: summary });
}
