export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

const TEN_MINUTES = 10 * 60 * 1000;

export async function POST() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: recent, error: fetchError } = await sb
    .from("usage_sessions")
    .select("id,last_seen_at")
    .eq("user_id", user.id)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  if (recent && recent.last_seen_at) {
    const lastSeen = new Date(recent.last_seen_at);
    if (now.getTime() - lastSeen.getTime() < TEN_MINUTES) {
      const { error: updateError } = await sb
        .from("usage_sessions")
        .update({ last_seen_at: nowIso })
        .eq("id", recent.id);
      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: true });
    }
  }

  const { error: insertError } = await sb.from("usage_sessions").insert({
    user_id: user.id,
    started_at: nowIso,
    last_seen_at: nowIso,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, created: true });
}
