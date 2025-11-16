export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminGuard";
import { listChatLogs } from "@/lib/ai-chat/logging";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.message },
      { status: guard.status },
    );
  }

  const { searchParams } = req.nextUrl;
  const limit = clamp(Number(searchParams.get("limit")) || 25, 1, 100);
  const userId = searchParams.get("userId") || undefined;
  const cursor = searchParams.get("cursor") || undefined;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const usedRagParam = searchParams.get("usedRag");
  const usedRag =
    usedRagParam === "true"
      ? true
      : usedRagParam === "false"
        ? false
        : undefined;

  const logs = await listChatLogs({
    limit,
    userId,
    cursor,
    from,
    to,
    usedRag,
  });

  const profiles = await loadProfiles(logs.items);

  return NextResponse.json(
    { ...logs, profiles },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function loadProfiles(items: Array<{ user_id: string | null }>) {
  const ids = Array.from(
    new Set(items.map((item) => item.user_id).filter(Boolean) as string[]),
  );
  if (!ids.length) return {};
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("users")
    .select("id,email,display_name,name")
    .in("id", ids);
  const map: Record<
    string,
    { email: string | null; display_name: string | null; name: string | null }
  > = {};
  (data ?? []).forEach((row) => {
    map[row.id] = {
      email: row.email ?? null,
      display_name: row.display_name ?? null,
      name: row.name ?? null,
    };
  });
  return map;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
