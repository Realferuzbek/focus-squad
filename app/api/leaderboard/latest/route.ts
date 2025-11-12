export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { loadLatestLeaderboards } from "@/lib/leaderboard/loadLatest";

export async function GET() {
  try {
    const latest = await loadLatestLeaderboards();
    return NextResponse.json({ data: latest });
  } catch (error) {
    console.error("leaderboard latest: failed to load snapshots", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
