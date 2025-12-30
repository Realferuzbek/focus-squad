export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { env } from "@/lib/rag/env";
import { reindexSite } from "@/lib/rag/crawl";
import { supabaseAdmin } from "@/lib/supabaseServer";

const REINDEX_STATE_TABLE = "rag_reindex_state";
const REINDEX_ROW_ID = 1;
const REINDEX_LOCK_TTL_MS = 15 * 60 * 1000;
const FALLBACK_DEPLOY_ID =
  process.env.DEPLOY_ID_FALLBACK ?? new Date().toISOString();

export async function POST(request: Request) {
  const token = resolveToken(request);
  if (token !== env.INDEXER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)
  ) {
    return NextResponse.json(
      { error: "Reindex lock unavailable" },
      { status: 503 },
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const lockUntil = new Date(now.getTime() + REINDEX_LOCK_TTL_MS).toISOString();
  const deployId = resolveDeployId();

  const sb = supabaseAdmin();
  const { data: row, error } = await sb
    .from(REINDEX_STATE_TABLE)
    .select("id, last_deploy_id, in_progress, lock_until")
    .eq("id", REINDEX_ROW_ID)
    .limit(1);
  if (error) {
    console.warn("[reindex] failed to load deploy state", error);
    return NextResponse.json(
      { error: "Reindex lock unavailable" },
      { status: 503 },
    );
  }

  const current = Array.isArray(row) ? row[0] : row;
  const lockExpired = current?.lock_until
    ? Date.parse(current.lock_until) <= now.getTime()
    : true;
  if (current?.in_progress && !lockExpired) {
    return NextResponse.json({ ok: false, status: "in_progress" }, { status: 202 });
  }

  let locked = false;
  if (current) {
    const { data: updated, error: updateError } = await sb
      .from(REINDEX_STATE_TABLE)
      .update({
        last_deploy_id: deployId,
        in_progress: true,
        lock_until: lockUntil,
        last_error: null,
        updated_at: nowIso,
      })
      .eq("id", REINDEX_ROW_ID)
      .or(
        `in_progress.is.null,in_progress.eq.false,lock_until.is.null,lock_until.lt.${nowIso}`,
      )
      .select("id");
    if (updateError) {
      console.warn("[reindex] failed to lock deploy state", updateError);
      return NextResponse.json(
        { error: "Reindex lock unavailable" },
        { status: 503 },
      );
    }
    locked = Boolean(updated?.length);
  } else {
    const { data: inserted, error: insertError } = await sb
      .from(REINDEX_STATE_TABLE)
      .insert({
        id: REINDEX_ROW_ID,
        last_deploy_id: deployId,
        last_reindexed_at: null,
        in_progress: true,
        lock_until: lockUntil,
        last_error: null,
        updated_at: nowIso,
      })
      .select("id");
    if (insertError) {
      console.warn("[reindex] failed to create deploy state", insertError);
      return NextResponse.json(
        { error: "Reindex lock unavailable" },
        { status: 503 },
      );
    }
    locked = Boolean(inserted?.length);
  }

  if (!locked) {
    return NextResponse.json({ ok: false, status: "in_progress" }, { status: 202 });
  }

  try {
    const stats = await reindexSite();
    const finishedAt = stats.finishedAt ?? new Date().toISOString();
    await sb
      .from(REINDEX_STATE_TABLE)
      .update({
        last_deploy_id: deployId,
        last_reindexed_at: finishedAt,
        in_progress: false,
        lock_until: null,
        last_error: null,
        updated_at: finishedAt,
      })
      .eq("id", REINDEX_ROW_ID);
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    console.error("[reindex] failed", error);
    const failedAt = new Date().toISOString();
    await sb
      .from(REINDEX_STATE_TABLE)
      .update({
        in_progress: false,
        lock_until: null,
        last_error: error instanceof Error ? error.message : String(error),
        updated_at: failedAt,
      })
      .eq("id", REINDEX_ROW_ID);
    return NextResponse.json(
      { error: "Reindex failed" },
      { status: 500 },
    );
  }
}

function resolveToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return request.headers.get("x-indexer-secret");
}

function resolveDeployId() {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.NEXT_BUILD_ID ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    FALLBACK_DEPLOY_ID
  );
}
