import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  fetchThreadById,
  fetchThreadByUserId,
  isDmAdmin,
  mapMessage,
} from "@/lib/adminchat/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

const querySchema = z.object({
  threadId: z.string().uuid().optional(),
  cursor: z.string().datetime().optional(),
  q: z.string().min(1).max(200).optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((val) => parseInt(val, 10))
    .optional(),
});

const PAGE_SIZE = 40;

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id as string;
  const admin = isDmAdmin(user);

  let parsed;
  try {
    parsed = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  } catch (err) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    let threadId: string | null = null;
    if (admin && parsed.threadId) {
      const thread = await fetchThreadById(parsed.threadId);
      if (!thread) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      }
      threadId = thread.id;
    } else {
      const thread = await fetchThreadByUserId(userId);
      if (!thread) {
        return NextResponse.json({ messages: [], hasMore: false });
      }
      if (!admin && thread.user_id !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      threadId = thread.id;
    }

    const limit = Math.min(parsed.limit ?? PAGE_SIZE, 100);
    const sb = supabaseAdmin();

    const selecting =
      "id,thread_id,author_id,kind,text,file_url,file_mime,file_bytes,edited_at,created_at,visibility:dm_message_visibility!left(user_id,hidden)";

    const usingSearch = !!parsed.q;

    let query = sb
      .from("dm_messages")
      .select(selecting)
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false });

    if (usingSearch) {
      query = query.ilike("text", `%${parsed.q}%`).limit(100);
    } else {
      query = query.limit(limit + 5);
      if (parsed.cursor) {
        query = query.lt("created_at", parsed.cursor);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Failed to load messages" },
        { status: 500 },
      );
    }

    const rows = (data ?? []).filter((row: any) => {
      const visibility = (row.visibility ?? []) as Array<{ user_id: string; hidden: boolean }>;
      const hidden = visibility.find(
        (entry) => entry.user_id === userId && entry.hidden,
      );
      return !hidden;
    });

    if (usingSearch) {
      const mapped = rows.map((row: any) => {
        const message = mapMessage(row);
        const highlight = buildHighlight(message.text ?? "", parsed.q!);
        return { ...message, highlight };
      });
      return NextResponse.json({
        messages: mapped.reverse(),
        hasMore: false,
        nextCursor: null,
      });
    } else {
      const paged = rows.slice(0, limit);
      const hasMore = rows.length > limit;
      const nextCursor =
        hasMore && paged.length > 0 ? paged[paged.length - 1].created_at : null;

      return NextResponse.json({
        messages: paged.reverse().map(mapMessage),
        hasMore,
        nextCursor,
      });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHighlight(text: string, query: string) {
  if (!text) return null;
  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const snippet = text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
  return snippet.replace(regex, "<mark>$1</mark>");
}
