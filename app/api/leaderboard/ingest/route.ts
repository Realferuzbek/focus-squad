export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  SECRET_HEADER,
  storeFailedLeaderboardPayload,
  upsertLeaderboardPayload,
  validateLeaderboardPayload,
} from "@/lib/leaderboard/ingest";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.LEADERBOARD_INGEST_SECRET;
  if (!expectedSecret) {
    console.warn("leaderboard ingest disabled: secret not configured");
    return NextResponse.json(
      { error: "Ingest not configured" },
      { status: 503 },
    );
  }

  const providedSecret = req.headers.get(SECRET_HEADER);
  if (providedSecret !== expectedSecret) {
    console.warn("leaderboard ingest forbidden: secret mismatch");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch (error) {
    console.error("leaderboard ingest: failed to read request body", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const client = supabaseAdmin();

  const recordFailure = async (payload: unknown, issues: unknown) => {
    const stored = await storeFailedLeaderboardPayload(client, payload, issues);
    if (!stored) {
      return NextResponse.json(
        { error: "Failed to persist invalid payload" },
        { status: 500 },
      );
    }
    console.warn("leaderboard ingest: payload stored for review");
    return NextResponse.json({ status: "stored-for-review" });
  };

  if (!rawBody) {
    return recordFailure(rawBody, { reason: "empty_body" });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid json";
    return recordFailure(rawBody, { reason: "invalid_json", message: reason });
  }

  const validation = validateLeaderboardPayload(parsed);
  if (!validation.success) {
    return recordFailure(parsed, validation.error.issues);
  }

  try {
    const result = await upsertLeaderboardPayload(client, validation.data);
    console.info("leaderboard ingest success", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("leaderboard ingest: failed to upsert snapshot", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
