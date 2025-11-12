export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrInternal } from "@/lib/adminGuard";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  const guard = await requireAdminOrInternal({ request });
  if (!guard.ok) {
    const message =
      guard.message === "unauthorized" ? "Unauthorized" : "Admin only";
    return NextResponse.json({ error: message }, { status: guard.status });
  }

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
