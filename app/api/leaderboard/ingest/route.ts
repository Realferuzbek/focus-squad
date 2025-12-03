export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  normalizeTrackerPayload,
  payloadSchema,
  SECRET_HEADER,
  storeLeaderboardFailure,
  storeSuccessfulLeaderboardPayload,
  trackerPayloadSchema,
  upsertLeaderboardPayload,
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

  let rawBodyText = "";
  try {
    rawBodyText = await req.text();
  } catch (error) {
    console.error("leaderboard ingest: failed to read request body", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(rawBodyText);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid json";
    const issues = [{ message: reason }];
    await storeLeaderboardFailure("tracker-parse", rawBodyText, issues);
    return NextResponse.json({
      status: "stored-for-review",
      stage: "tracker-parse",
      issues,
    });
  }

  const trackerParseResult = trackerPayloadSchema.safeParse(rawBody);
  if (!trackerParseResult.success) {
    await storeLeaderboardFailure(
      "tracker-parse",
      rawBody,
      trackerParseResult.error.issues,
    );
    return NextResponse.json({
      status: "stored-for-review",
      stage: "tracker-parse",
      issues: trackerParseResult.error.issues,
    });
  }

  const normalized = normalizeTrackerPayload(trackerParseResult.data);
  const normalizedParseResult = payloadSchema.safeParse(normalized);
  if (!normalizedParseResult.success) {
    await storeLeaderboardFailure(
      "normalized-parse",
      rawBody,
      normalizedParseResult.error.issues,
    );
    return NextResponse.json({
      status: "stored-for-review",
      stage: "normalized-parse",
      issues: normalizedParseResult.error.issues,
    });
  }

  const client = supabaseAdmin();

  try {
    const result = await upsertLeaderboardPayload(client, normalized);
    await storeSuccessfulLeaderboardPayload(normalized, {
      inserted: result.inserted,
      updated: result.updated,
    });
    console.info("leaderboard ingest success", result);
    return NextResponse.json({
      status: "ok",
      inserted: result.inserted,
      updated: result.updated,
    });
  } catch (error) {
    console.error("leaderboard ingest: failed to upsert snapshot", error);
    await storeLeaderboardFailure("db-upsert", rawBody, error);
    return NextResponse.json(
      {
        status: "error",
        stage: "db-upsert",
        error: error instanceof Error ? error.message : "unknown supabase error",
      },
      { status: 500 },
    );
  }
}
