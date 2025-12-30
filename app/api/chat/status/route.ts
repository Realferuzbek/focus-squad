import { NextRequest, NextResponse } from "next/server";
import { getPublicAiChatEnabled, isAiChatEnabled } from "@/lib/featureFlags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const publicEnabled = await getPublicAiChatEnabled();
    const fallbackEnabled = await isAiChatEnabled(false, { cache: false });
    const enabled =
      typeof publicEnabled === "boolean" ? publicEnabled : fallbackEnabled;
    const wantsDebug = req.nextUrl.searchParams.get("debug") === "1";
    return NextResponse.json(
      {
        enabled,
        status: enabled ? "online" : "disabled",
        ...(wantsDebug
          ? {
              source:
                typeof publicEnabled === "boolean" ? "public" : "service",
              publicEnabled,
              serviceEnabled: fallbackEnabled,
            }
          : {}),
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
