export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { REQUIRED_SCOPES } from "@/lib/leaderboard/ingest";
import { supabaseAdmin } from "@/lib/supabaseServer";

const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
  const client = supabaseAdmin();

  try {
    const now = Date.now();
    const windowStart = now - FRESH_WINDOW_MS;

    const scopeEntries = await Promise.all(
      REQUIRED_SCOPES.map(async (scope) => {
        const { data, error } = await client
          .from("leaderboards")
          .select("scope, posted_at")
          .eq("scope", scope)
          .order("posted_at", { ascending: false })
          .limit(1);

        if (error) {
          throw error;
        }

        const latest = data?.[0]?.posted_at ?? null;
        const latestTimestamp = latest ? Date.parse(latest) : NaN;
        const withinWindow =
          Number.isFinite(latestTimestamp) && latestTimestamp >= windowStart;

        return [scope, { postedAt: latest, withinWindow }] as const;
      }),
    );

    type ScopeSummary = { postedAt: string | null; withinWindow: boolean };
    const scopes = Object.fromEntries(scopeEntries) as Record<
      (typeof REQUIRED_SCOPES)[number],
      ScopeSummary
    >;

    let latestPostedAt: string | null = null;
    let ok = true;

    Object.values(scopes).forEach((summary) => {
      if (
        summary.postedAt &&
        (!latestPostedAt || summary.postedAt > latestPostedAt)
      ) {
        latestPostedAt = summary.postedAt;
      }

      if (!summary.withinWindow) {
        ok = false;
      }
    });

    if (!ok) {
      console.error(
        "leaderboard health: stale or missing snapshots detected",
        scopes,
      );
    } else {
      console.info("leaderboard health: all scopes fresh");
    }

    return NextResponse.json({ ok, latestPostedAt, scopes });
  } catch (error) {
    console.error("leaderboard health: failed to check snapshots", error);
    return NextResponse.json(
      { ok: false, error: "Database error" },
      { status: 500 },
    );
  }
}
