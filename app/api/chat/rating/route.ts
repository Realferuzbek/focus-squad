export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { updateChatRating } from "@/lib/ai-chat/logging";

type RatingBody = {
  chatId?: unknown;
  sessionId?: unknown;
  rating?: unknown;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RatingBody;
  const chatId =
    typeof body.chatId === "string" ? body.chatId.trim() : undefined;
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId.trim() : undefined;
  const ratingValue = Number(body.rating);

  if (!chatId || !sessionId || !isUuid(chatId) || !isUuid(sessionId)) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: noCache() },
    );
  }

  if (![1, -1, 0].includes(ratingValue)) {
    return NextResponse.json(
      { error: "Unsupported rating" },
      { status: 400, headers: noCache() },
    );
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("ai_chat_logs")
    .select("id")
    .eq("id", chatId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Lookup failed" },
      { status: 500, headers: noCache() },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: noCache() },
    );
  }

  await updateChatRating(chatId, ratingValue);
  return NextResponse.json({ ok: true }, { headers: noCache() });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function noCache() {
  return { "Cache-Control": "no-store" };
}
