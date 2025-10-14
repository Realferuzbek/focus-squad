import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  fetchThreadById,
  fetchThreadByUserId,
  isDmAdmin,
} from "@/lib/adminchat/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

const bodySchema = z.object({
  threadId: z.string().uuid().optional(),
  typing: z.boolean().optional(),
  lastReadAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    payload = bodySchema.parse(json);
  } catch (err) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const userId = user.id as string;
  const admin = isDmAdmin(user);

  try {
    let threadId: string | null = null;
    if (admin && payload.threadId) {
      const thread = await fetchThreadById(payload.threadId);
      if (!thread) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      }
      threadId = thread.id;
    } else {
      const thread = await fetchThreadByUserId(userId);
      if (!thread) {
        return NextResponse.json({ error: "Thread not started" }, { status: 400 });
      }
      if (!admin && thread.user_id !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      threadId = thread.id;
    }

    const sb = supabaseAdmin();
    const { error } = await sb
      .from("dm_receipts")
      .upsert(
        {
          thread_id: threadId,
          user_id: userId,
          typing: payload.typing ?? false,
          last_read_at: payload.lastReadAt ?? new Date().toISOString(),
        },
        { onConflict: "thread_id,user_id" },
      );

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Failed to update receipt" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}

