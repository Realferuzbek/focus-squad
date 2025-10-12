export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("app_state")
      .select("session_version, require_tg_relink")
      .eq("id", 1)
      .maybeSingle();

    return NextResponse.json({
      session_version: (data?.session_version ?? 1) as number,
      require_tg_relink: !!data?.require_tg_relink,
    });
  } catch (err) {
    return NextResponse.json({ session_version: 1, require_tg_relink: false });
  }
}
