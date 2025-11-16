export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getMemoryPreference,
  updateMemoryPreference,
} from "@/lib/ai-chat/memory";
import { forgetUserAiData } from "@/lib/ai-chat/logging";
import { supabaseAdmin } from "@/lib/supabaseServer";

async function requireUser() {
  const session = await auth();
  const id = (session?.user as any)?.id;
  if (!id || typeof id !== "string") {
    return null;
  }
  return id;
}

export async function GET() {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json(
      { memoryEnabled: false, hasData: false, userId: null },
      { status: 401 },
    );
  }

  const [enabled, hasData] = await Promise.all([
    getMemoryPreference(userId).catch(() => true),
    resolveHasData(userId),
  ]);

  return NextResponse.json({
    userId,
    memoryEnabled: enabled,
    hasData,
  });
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const nextValue = Boolean(body?.memoryEnabled ?? body?.enabled);
  await updateMemoryPreference(userId, nextValue);
  return NextResponse.json({ memoryEnabled: nextValue });
}

export async function DELETE() {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await forgetUserAiData(userId);
  return NextResponse.json({ ok: true });
}

async function resolveHasData(userId: string) {
  try {
    const sb = supabaseAdmin();
    const [{ count: logCount }, { count: memoryCount }] = await Promise.all([
      sb
        .from("ai_chat_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      sb
        .from("ai_chat_memories")
        .select("memory_key", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);
    return (logCount ?? 0) > 0 || (memoryCount ?? 0) > 0;
  } catch {
    return false;
  }
}
