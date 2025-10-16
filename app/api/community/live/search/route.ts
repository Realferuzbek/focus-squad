import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { isLiveMember, mapLiveMessage } from "@/lib/live/server";

const querySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => parseInt(value, 10))
    .optional(),
});

const SELECT_FIELDS =
  "id,author_id,kind,text,file_path,file_mime,file_bytes,created_at,author:users!live_messages_author_id_fkey(display_name,avatar_url)";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof querySchema>;
  try {
    parsed = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  } catch {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  let joined: boolean;
  try {
    joined = await isLiveMember(sb, user.id as string);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to verify membership" },
      { status: 500 },
    );
  }

  if (!joined) {
    return NextResponse.json({ error: "Join required" }, { status: 403 });
  }

  const limit = Math.max(
    1,
    Math.min(parsed.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
  );

  const { data, error } = await sb
    .from("live_messages")
    .select(SELECT_FIELDS)
    .not("text", "is", null)
    .ilike("text", `%${parsed.q}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to search messages" },
      { status: 500 },
    );
  }

  const messages = (data ?? []).map((row: any) => {
    const message = mapLiveMessage(row);
    message.highlight = buildHighlight(message.text, parsed.q);
    return message;
  });

  return NextResponse.json({
    messages,
  });
}

function buildHighlight(text: string | null, query: string) {
  if (!text) return null;
  const condensed = text.replace(/\s+/g, " ").trim();
  if (!condensed) return null;
  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const snippet = condensed.slice(0, 200);
  return snippet.replace(regex, "<mark>$1</mark>");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
