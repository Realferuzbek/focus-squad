import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

function isAuthorized(req: Request) {
  const bearer = req.headers.get("authorization") || "";
  const tokenFromAuth = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  const tokenFromHeader = req.headers.get("x-cron-secret") || "";
  const key = tokenFromAuth || tokenFromHeader;
  return key && key === process.env.CRON_SECRET;
}

// GET: simple reachability
export async function GET() {
  return NextResponse.json({ ok: true });
}

// POST: nightly job
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sb = supabaseAdmin();

  // Example housekeeping: delete expired link tokens
  await sb
    .from("link_tokens")
    .delete()
    .lt("expires_at", new Date().toISOString());

  // (Optionally compute & store daily leaderboard here if you have a table for it)

  return NextResponse.json({ ok: true });
}
