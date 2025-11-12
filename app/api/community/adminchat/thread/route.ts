import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  fetchThreadById,
  fetchThreadByUserId,
  isDmAdmin,
  mapThread,
} from "@/lib/adminchat/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id as string;
  const admin = isDmAdmin(user);
  const threadIdParam = req.nextUrl.searchParams.get("threadId");

  try {
    let thread = null;

    if (admin && threadIdParam) {
      thread = await fetchThreadById(threadIdParam);
      if (!thread) {
        return NextResponse.json(
          { error: "Thread not found" },
          { status: 404 },
        );
      }
    } else {
      thread = await fetchThreadByUserId(userId);
      if (!thread) {
        return NextResponse.json({ thread: null });
      }
    }

    if (!admin && thread.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ thread: mapThread(thread) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

const patchSchema = z.object({
  threadId: z.string().uuid(),
  avatarUrl: z.string().url().nullable().optional(),
  wallpaperUrl: z.string().url().nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDmAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: z.infer<typeof patchSchema>;
  try {
    const json = await req.json();
    payload = patchSchema.parse(json);
  } catch (err) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const thread = await fetchThreadById(payload.threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const updates: Record<string, any> = {};
    if ("avatarUrl" in payload) updates.avatar_url = payload.avatarUrl ?? null;
    if ("wallpaperUrl" in payload)
      updates.wallpaper_url = payload.wallpaperUrl ?? null;
    if ("description" in payload) {
      const description = payload.description ?? null;
      if (description) {
        const words = description.trim().split(/\s+/);
        if (words.length > 40) {
          return NextResponse.json(
            { error: "Description must be at most 40 words" },
            { status: 400 },
          );
        }
      }
      updates.description = description;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ thread: mapThread(thread) });
    }

    const { data, error } = await supabaseAdmin()
      .from("dm_threads")
      .update(updates)
      .eq("id", payload.threadId)
      .select(
        "id,user_id,status,started_at,last_message_at,wallpaper_url,avatar_url,description",
      )
      .single();

    if (error || !data) {
      console.error(error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ thread: mapThread(data) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
