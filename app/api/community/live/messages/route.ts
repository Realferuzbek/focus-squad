import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  buildLivePreview,
  fetchLiveState,
  isLiveMember,
  mapLiveMessage,
} from "@/lib/live/server";
import { sendToTopic } from "@/lib/push";

const querySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => parseInt(value, 10))
    .optional(),
});

const textSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(4000, "Message too long"),
});

const fileSchema = z.object({
  kind: z.enum(["image", "video", "audio", "file"]),
  filePath: z.string().min(1),
  fileMime: z.string().min(1),
  fileBytes: z.number().int().positive(),
  text: z
    .string()
    .trim()
    .max(4000, "Message too long")
    .optional(),
});

const bodySchema = z.union([textSchema, fileSchema]);

const SELECT_FIELDS =
  "id,author_id,kind,text,file_path,file_mime,file_bytes,created_at,author:users!live_messages_author_id_fkey(display_name,avatar_url)";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const NON_MEMBER_LIMIT = 10;

const LIMITS = {
  image: 5 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  file: 20 * 1024 * 1024,
} as const;

const ALLOWED_MIME = {
  image: /^image\//,
  video: /^video\//,
  audio: /^audio\//,
  file: /.*/,
} as const;

function isFilePayload(
  payload: z.infer<typeof bodySchema>,
): payload is z.infer<typeof fileSchema> {
  return "kind" in payload;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsedQuery: z.infer<typeof querySchema>;
  try {
    parsedQuery = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  } catch {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const joined = await isLiveMember(sb, user.id as string).catch((err) => {
    console.error(err);
    return false;
  });

  if (!joined) {
    const { data, error } = await sb
      .from("live_messages")
      .select(SELECT_FIELDS)
      .order("created_at", { ascending: false })
      .limit(NON_MEMBER_LIMIT);

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Failed to load messages" },
        { status: 500 },
      );
    }

    const rows = (data ?? []).reverse();
    return NextResponse.json({
      messages: rows.map(mapLiveMessage),
      hasMore: false,
      nextCursor: null,
      joined: false,
    });
  }

  const limit = Math.max(
    1,
    Math.min(parsedQuery.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
  );

  let query = sb
    .from("live_messages")
    .select(SELECT_FIELDS)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (parsedQuery.cursor) {
    query = query.lt("created_at", parsedQuery.cursor);
  }

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 },
    );
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const ordered = slice.reverse().map(mapLiveMessage);
  const nextCursor = hasMore && ordered.length ? ordered[0].createdAt : null;

  return NextResponse.json({
    messages: ordered,
    hasMore,
    nextCursor,
    joined: true,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const userId = user.id as string;

  let joined: boolean;
  try {
    joined = await isLiveMember(sb, userId);
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

  let state;
  try {
    state = await fetchLiveState(sb);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to verify stream state" },
      { status: 500 },
    );
  }

  if (!state.isLive) {
    return NextResponse.json(
      { error: "Live stream is offline" },
      { status: 409 },
    );
  }

  if (isFilePayload(payload)) {
    const allowed = ALLOWED_MIME[payload.kind];
    if (!allowed.test(payload.fileMime)) {
      return NextResponse.json({ error: "Mime type not allowed" }, { status: 400 });
    }
    if (payload.fileBytes > LIMITS[payload.kind]) {
      return NextResponse.json(
        { error: `File too large for ${payload.kind}` },
        { status: 413 },
      );
    }
    if (payload.filePath.includes("..")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }
  }

  const insertPayload: Record<string, any> = {
    author_id: userId,
    kind: "text",
    text: null,
    file_path: null,
    file_mime: null,
    file_bytes: null,
  };

  if (isFilePayload(payload)) {
    insertPayload.kind = payload.kind;
    const trimmed = payload.text?.trim() ?? "";
    insertPayload.text = trimmed.length ? trimmed : null;
    insertPayload.file_path = payload.filePath;
    insertPayload.file_mime = payload.fileMime;
    insertPayload.file_bytes = payload.fileBytes;
  } else {
    insertPayload.kind = "text";
    insertPayload.text = payload.text.trim();
  }

  const { data, error } = await sb
    .from("live_messages")
    .insert(insertPayload)
    .select(SELECT_FIELDS)
    .single();

  if (error || !data) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }

  const message = mapLiveMessage(data);
  const preview = buildLivePreview(
    message.kind,
    message.text,
    message.fileMime,
    message.fileBytes ?? undefined,
  );

  try {
    await sendToTopic("live_stream_chat", {
      title: "Live stream chat",
      body: preview,
      url: "/community/live",
    });
  } catch (notifyError) {
    console.error(notifyError);
  }

  return NextResponse.json({ message });
}
