import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  ensureParticipant,
  fetchThreadById,
  fetchThreadByUserId,
  isDmAdmin,
  mapMessage,
} from "@/lib/adminchat/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { notifyThreadNewMessage } from "@/lib/push";

const baseSchema = z.object({
  threadId: z.string().uuid().optional(),
});

const textSchema = baseSchema.extend({
  text: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(4000, "Message too long"),
});

const fileSchema = baseSchema.extend({
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

type TextPayload = z.infer<typeof textSchema>;
type FilePayload = z.infer<typeof fileSchema>;

const bodySchema = z.union([textSchema, fileSchema]);

type RateBucket = {
  timestamps: number[];
  timeout?: NodeJS.Timeout;
};

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_HITS = 5;
const RATE_LIMIT_COOLDOWN_MS = 30_000;
const RATE_LIMIT_ERROR =
  "You’re sending messages too quickly. Please wait a few seconds before trying again.";

const messageRateBuckets = new Map<string, RateBucket>();

function isFilePayload(payload: TextPayload | FilePayload): payload is FilePayload {
  return "kind" in payload;
}

function buildMessagePreview(kind: string, text: string | null) {
  const trimmed = text?.trim();
  if (trimmed) {
    return trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed;
  }
  switch (kind) {
    case "image":
      return "[image]";
    case "video":
      return "[video]";
    case "audio":
      return "[audio]";
    case "file":
      return "[file]";
    default:
      return "New message";
  }
}

function allowMessageAttempt(key: string) {
  const now = Date.now();
  const bucket = messageRateBuckets.get(key) ?? { timestamps: [] };
  const recent = bucket.timestamps.filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recent.length >= RATE_LIMIT_MAX_HITS) {
    bucket.timestamps = recent;
    if (!bucket.timeout) {
      bucket.timeout = setTimeout(() => {
        const entry = messageRateBuckets.get(key);
        if (entry?.timeout) {
          clearTimeout(entry.timeout);
        }
        messageRateBuckets.delete(key);
      }, RATE_LIMIT_COOLDOWN_MS);
    }
    messageRateBuckets.set(key, bucket);
    return false;
  }

  recent.push(now);
  bucket.timestamps = recent;
  if (bucket.timeout) {
    clearTimeout(bucket.timeout);
  }
  bucket.timeout = setTimeout(() => {
    const entry = messageRateBuckets.get(key);
    if (entry?.timeout) {
      clearTimeout(entry.timeout);
    }
    messageRateBuckets.delete(key);
  }, RATE_LIMIT_COOLDOWN_MS);
  messageRateBuckets.set(key, bucket);
  return true;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    const json = await req.json();
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
        return NextResponse.json(
          { error: "Thread not started" },
          { status: 400 },
        );
      }
      if (!admin && thread.user_id !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      threadId = thread.id;
    }

    const sb = supabaseAdmin();

    const rateKey = `${threadId}:${userId}`;
    if (!allowMessageAttempt(rateKey)) {
      return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    await ensureParticipant(threadId, userId, admin ? "dm_admin" : "member");

    let insertPayload: Record<string, any>;

    if (isFilePayload(payload)) {
      if (!payload.filePath.startsWith(`dm-uploads/${threadId}/`)) {
        return NextResponse.json(
          { error: "File path mismatch" },
          { status: 400 },
        );
      }
      insertPayload = {
        thread_id: threadId,
        author_id: userId,
        kind: payload.kind,
        text: payload.text?.trim()?.substring(0, 4000) ?? null,
        file_url: payload.filePath,
        file_mime: payload.fileMime,
        file_bytes: payload.fileBytes,
      };
    } else {
      insertPayload = {
        thread_id: threadId,
        author_id: userId,
        kind: "text",
        text: payload.text.trim(),
      };
    }

    const { data, error } = await sb
      .from("dm_messages")
      .insert(insertPayload)
      .select(
        "id,thread_id,author_id,kind,text,file_url,file_mime,file_bytes,edited_at,created_at",
      )
      .single();

    if (error || !data) {
      console.error(error);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 },
      );
    }

    const nowIso = new Date().toISOString();
    await sb
      .from("dm_threads")
      .update({ last_message_at: nowIso })
      .eq("id", threadId);

    await sb
      .from("dm_receipts")
      .upsert({ thread_id: threadId, user_id: userId, last_read_at: nowIso, typing: false });

    const preview = buildMessagePreview(data.kind, data.text);
    const { error: auditError } = await sb.from("dm_audit").insert({
      thread_id: threadId,
      actor_id: userId,
      action: "message_create",
      target_id: data.id,
      meta: { kind: data.kind, preview },
    });
    if (auditError) {
      console.error(auditError);
    }

    if (data.kind !== "system") {
      try {
        await notifyThreadNewMessage(threadId, userId, preview);
      } catch (notifyError) {
        console.error(notifyError);
      }
    }

    return NextResponse.json({ message: mapMessage(data) });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}
