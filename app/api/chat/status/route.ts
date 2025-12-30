import { NextResponse } from "next/server";
import { isAiChatEnabled } from "@/lib/featureFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const enabled = await isAiChatEnabled(false, { cache: false });
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
