import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  ensureParticipant,
  fetchThreadByUserId,
  mapThread,
} from "@/lib/adminchat/server";

export async function POST() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id as string;

  try {
    const sb = supabaseAdmin();

    const existing = await fetchThreadByUserId(userId);
    if (existing) {
      await ensureParticipant(existing.id, userId, "member");
      return NextResponse.json({
        ok: true,
        thread: mapThread(existing),
      });
    }

    const { data, error } = await sb
      .from("dm_threads")
      .insert({ user_id: userId, status: "open" })
      .select(
        "id,user_id,status,started_at,last_message_at,wallpaper_url,avatar_url,description",
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to create thread" },
        { status: 500 },
      );
    }

    await ensureParticipant(data.id, userId, "member");
    await sb
      .from("dm_receipts")
      .upsert({ thread_id: data.id, user_id: userId, typing: false });

    return NextResponse.json({
      ok: true,
      thread: mapThread(data),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}

