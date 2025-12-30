import { NextRequest, NextResponse } from "next/server";
import { getPublicAiChatEnabled, isAiChatEnabled } from "@/lib/featureFlags";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { reindexSite } from "@/lib/rag/crawl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REINDEX_STATE_TABLE = "rag_reindex_state";
const REINDEX_STATE_KEY = "deploy";
const REINDEX_LOCK_TTL_MS = 45 * 60 * 1000;
const FALLBACK_DEPLOY_ID =
  process.env.DEPLOY_ID_FALLBACK ?? new Date().toISOString();

type AfterFn = (callback: () => void) => void;
let cachedAfter: AfterFn | null | undefined;

export async function GET(_req: NextRequest) {
  try {
    const publicEnabled = await getPublicAiChatEnabled();
    const fallbackEnabled = await isAiChatEnabled(false, { cache: false });
    const enabled =
      typeof publicEnabled === "boolean" ? publicEnabled : fallbackEnabled;
    scheduleDeployReindex();
    return NextResponse.json(
      {
        enabled,
        status: enabled ? "online" : "disabled",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/chat/status] failed to load availability", error);
    return NextResponse.json(
      {
        enabled: false,
        status: "error",
        error: "Unable to determine assistant status.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

function scheduleDeployReindex() {
  const runner = () =>
    triggerDeployReindex().catch((error) =>
      console.error("[reindex] deploy trigger failed", error),
    );
  void resolveAfter().then((afterFn) => {
    if (afterFn) {
      afterFn(() => {
        void runner();
      });
      return;
    }
    if (typeof queueMicrotask === "function") {
      queueMicrotask(() => {
        void runner();
      });
      return;
    }
    setTimeout(() => {
      void runner();
    }, 0);
  });
}

async function triggerDeployReindex() {
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)
  ) {
    return;
  }

  const deployId = resolveDeployId();
  const now = new Date();
  const nowIso = now.toISOString();
  const lockExpiresAt = new Date(
    now.getTime() + REINDEX_LOCK_TTL_MS,
  ).toISOString();

  const sb = supabaseAdmin();
  const { data: row, error } = await sb
    .from(REINDEX_STATE_TABLE)
    .select("deploy_id, in_progress, lock_expires_at")
    .eq("key", REINDEX_STATE_KEY)
    .maybeSingle();
  if (error) {
    console.warn("[reindex] failed to load deploy state", error);
    return;
  }

  const lockExpired = row?.lock_expires_at
    ? Date.parse(row.lock_expires_at) <= now.getTime()
    : true;

  if (row?.deploy_id === deployId && !row?.in_progress) {
    return;
  }

  if (row?.in_progress && !lockExpired) {
    return;
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
      return;
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
      return;
    }
    locked = Boolean(inserted?.length);
  }

  if (!locked) {
    return;
  }

  console.info(`[reindex] triggered on deploy ${deployId}`);
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
    console.info(`[reindex] completed on deploy ${deployId}`, stats);
  } catch (error) {
    console.error(`[reindex] failed on deploy ${deployId}`, error);
    const failedAt = new Date().toISOString();
    await sb
      .from(REINDEX_STATE_TABLE)
      .update({
        in_progress: false,
        lock_expires_at: null,
        updated_at: failedAt,
      })
      .eq("key", REINDEX_STATE_KEY);
  }
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

async function resolveAfter(): Promise<AfterFn | null> {
  if (cachedAfter !== undefined) return cachedAfter;
  try {
    const mod = (await import("next/server")) as { after?: AfterFn };
    cachedAfter = typeof mod.after === "function" ? mod.after : null;
  } catch {
    cachedAfter = null;
  }
  return cachedAfter;
}
