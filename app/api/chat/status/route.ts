import { NextRequest, NextResponse } from "next/server";
import { getPublicAiChatEnabled, isAiChatEnabled } from "@/lib/featureFlags";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { reindexSite } from "@/lib/rag/crawl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REINDEX_STATE_TABLE = "rag_reindex_state";
const REINDEX_ROW_ID = 1;
const REINDEX_LOCK_TTL_MS = 15 * 60 * 1000;
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
  const lockUntil = new Date(now.getTime() + REINDEX_LOCK_TTL_MS).toISOString();

  const sb = supabaseAdmin();
  const { data: row, error } = await sb
    .from(REINDEX_STATE_TABLE)
    .select("id, last_deploy_id, in_progress, lock_until")
    .eq("id", REINDEX_ROW_ID)
    .limit(1);
  if (error) {
    console.warn("[reindex] failed to load deploy state", error);
    return;
  }

  const current = Array.isArray(row) ? row[0] : row;
  const lockExpired = current?.lock_until
    ? Date.parse(current.lock_until) <= now.getTime()
    : true;

  if (current?.last_deploy_id === deployId && !current?.in_progress) {
    return;
  }

  if (current?.in_progress && !lockExpired) {
    return;
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
      return;
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
      return;
    }
    locked = Boolean(inserted?.length);
  }

  if (!locked) {
    return;
  }

  console.info(`[reindex] triggered on deploy ${deployId}`);
  void runDeployReindex({ sb, deployId });
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

async function runDeployReindex(params: {
  sb: ReturnType<typeof supabaseAdmin>;
  deployId: string;
}) {
  try {
    const stats = await reindexSite();
    const finishedAt = stats.finishedAt ?? new Date().toISOString();
    await params.sb
      .from(REINDEX_STATE_TABLE)
      .update({
        last_deploy_id: params.deployId,
        last_reindexed_at: finishedAt,
        in_progress: false,
        lock_until: null,
        last_error: null,
        updated_at: finishedAt,
      })
      .eq("id", REINDEX_ROW_ID);
    console.info(`[reindex] completed on deploy ${params.deployId}`, stats);
  } catch (error) {
    console.error(`[reindex] failed on deploy ${params.deployId}`, error);
    const failedAt = new Date().toISOString();
    await params.sb
      .from(REINDEX_STATE_TABLE)
      .update({
        in_progress: false,
        lock_until: null,
        last_error: error instanceof Error ? error.message : String(error),
        updated_at: failedAt,
      })
      .eq("id", REINDEX_ROW_ID);
  }
}
