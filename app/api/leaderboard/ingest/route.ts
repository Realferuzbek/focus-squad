export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  normalizeTrackerPayload,
  payloadSchema,
  SECRET_HEADER,
  storeLeaderboardFailure,
  storeDebugIngestMeta,
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
    await storeDebugIngestMeta(
      "read-body-failed",
      error instanceof Error ? error.message : error,
    );
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
    await storeDebugIngestMeta("json-parse-failed", {
      reason,
      length: rawBodyText.length,
    });
    await storeLeaderboardFailure("tracker-parse", rawBodyText, issues);
    return NextResponse.json({
      status: "stored-for-review",
      stage: "tracker-parse",
      issues,
    });
  }

  console.log("INGEST v2: received body length", rawBodyText.length);
  await storeDebugIngestMeta("received", { length: rawBodyText.length });

  const trackerParseResult = trackerPayloadSchema.safeParse(rawBody);
  console.log("INGEST v2: tracker parse success?", trackerParseResult.success);
  if (!trackerParseResult.success) {
    await storeDebugIngestMeta(
      "tracker-parse-failed",
      trackerParseResult.error.issues,
    );
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
  console.log(
    "INGEST v2: normalized payload boards",
    normalized.boards.map((b) => b.scope),
  );
  await storeDebugIngestMeta("normalized", {
    scopes: normalized.boards.map((b) => b.scope),
  });
  const normalizedParseResult = payloadSchema.safeParse(normalized);
  if (!normalizedParseResult.success) {
    await storeDebugIngestMeta(
      "normalized-parse-failed",
      normalizedParseResult.error.issues,
    );
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
    console.log("INGEST v2: success", result);
    await storeDebugIngestMeta("ok", result);
    return NextResponse.json({
      status: "ok",
      inserted: result.inserted,
      updated: result.updated,
    });
  } catch (error) {
    console.error("leaderboard ingest: failed to upsert snapshot", error);
    await storeLeaderboardFailure("db-upsert", rawBody, error);
    await storeDebugIngestMeta(
      "db-upsert-error",
      error instanceof Error ? error.message : error,
    );
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
