export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { env } from "@/lib/rag/env";
import { reindexSite } from "@/lib/rag/crawl";
import { supabaseAdmin } from "@/lib/supabaseServer";

const REINDEX_STATE_TABLE = "rag_reindex_state";
const REINDEX_STATE_KEY = "deploy";
const REINDEX_LOCK_TTL_MS = 45 * 60 * 1000;
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
  const lockExpiresAt = new Date(
    now.getTime() + REINDEX_LOCK_TTL_MS,
  ).toISOString();
  const deployId = resolveDeployId();

  const sb = supabaseAdmin();
  const { data: row, error } = await sb
    .from(REINDEX_STATE_TABLE)
    .select("deploy_id, in_progress, lock_expires_at")
    .eq("key", REINDEX_STATE_KEY)
    .maybeSingle();
  if (error) {
    console.warn("[reindex] failed to load deploy state", error);
    return NextResponse.json(
      { error: "Reindex lock unavailable" },
      { status: 503 },
    );
  }

  const lockExpired = row?.lock_expires_at
    ? Date.parse(row.lock_expires_at) <= now.getTime()
    : true;
  if (row?.in_progress && !lockExpired) {
    return NextResponse.json({ ok: false, status: "in_progress" }, { status: 202 });
  }

  let locked = false;
  if (row) {
    const { data: updated, error: updateError } = await sb
      .from(REINDEX_STATE_TABLE)
      .update({
        in_progress: true,
        lock_expires_at: lockExpiresAt,
        started_at: nowIso,
        updated_at: nowIso,
      })
      .eq("key", REINDEX_STATE_KEY)
      .or(
        `in_progress.is.null,in_progress.eq.false,lock_expires_at.is.null,lock_expires_at.lt.${nowIso}`,
      )
      .select("key");
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
        key: REINDEX_STATE_KEY,
        deploy_id: null,
        last_indexed_at: null,
        in_progress: true,
        lock_expires_at: lockExpiresAt,
        started_at: nowIso,
        updated_at: nowIso,
      })
      .select("key");
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
        deploy_id: deployId,
        last_indexed_at: finishedAt,
        in_progress: false,
        lock_expires_at: null,
        updated_at: finishedAt,
      })
      .eq("key", REINDEX_STATE_KEY);
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    console.error("[reindex] failed", error);
    const failedAt = new Date().toISOString();
    await sb
      .from(REINDEX_STATE_TABLE)
      .update({
        in_progress: false,
        lock_expires_at: null,
        updated_at: failedAt,
      })
      .eq("key", REINDEX_STATE_KEY);
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
