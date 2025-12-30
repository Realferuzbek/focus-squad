import { NextRequest, NextResponse } from "next/server";
import { getPublicAiChatEnabled, isAiChatEnabled } from "@/lib/featureFlags";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const publicEnabled = await getPublicAiChatEnabled();
    const fallbackEnabled = await isAiChatEnabled(false, { cache: false });
    const enabled =
      typeof publicEnabled === "boolean" ? publicEnabled : fallbackEnabled;
    const wantsDebug = req.nextUrl.searchParams.get("debug") === "1";
    let debugInfo: Record<string, unknown> | null = null;
    if (wantsDebug) {
      const serviceUrl =
        process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
      const publicUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;
      let serviceRow: { enabled?: boolean; updated_at?: string } | null = null;
      let serviceError: string | null = null;
      try {
        const sb = supabaseAdmin();
        const { data, error } = await sb
          .from("feature_flags")
          .select("enabled, updated_at")
          .eq("key", "ai_chat_enabled")
          .maybeSingle();
        if (error) {
          serviceError = error.message;
        } else if (data) {
          serviceRow = data;
        }
      } catch (error) {
        serviceError = error instanceof Error ? error.message : String(error);
      }
      debugInfo = {
        source: typeof publicEnabled === "boolean" ? "public" : "service",
        publicEnabled,
        serviceEnabled: fallbackEnabled,
        serviceRow,
        serviceError,
        serviceRef: extractProjectRef(serviceUrl),
        publicRef: extractProjectRef(publicUrl),
        serviceKeyPresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        anonKeyPresent: Boolean(
          process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        ),
      };
    }
    return NextResponse.json(
      {
        enabled,
        status: enabled ? "online" : "disabled",
        ...(debugInfo ?? {}),
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

function extractProjectRef(value: string | null) {
  if (!value) return null;
  const match = value.match(/^https?:\\/\\/(.+?)\\.supabase\\.co/);
  return match?.[1] ?? value;
}
