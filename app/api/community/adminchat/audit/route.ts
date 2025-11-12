import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { fetchThreadById, isDmAdmin } from "@/lib/adminchat/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

const querySchema = z.object({
  threadId: z.string().uuid(),
  cursor: z.string().datetime().optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => parseInt(value, 10))
    .optional(),
});

type AuditRow = {
  id: number;
  thread_id: string;
  actor_id: string | null;
  action:
    | "message_create"
    | "message_edit"
    | "message_delete_soft"
    | "message_delete_hard"
    | "role_promote"
    | "role_demote"
    | "thread_meta"
    | "subscribe_push"
    | "unsubscribe_push";
  target_id: string | null;
  meta: Record<string, any> | null;
  created_at: string;
};

function describeAction(row: AuditRow, actorName: string) {
  const meta = row.meta ?? {};
  const actor = actorName || "Someone";
  const preview = typeof meta.preview === "string" ? meta.preview : null;
  const targetName =
    typeof meta.targetName === "string" ? meta.targetName : null;

  switch (row.action) {
    case "message_create":
      return preview ? `${actor} sent: ${preview}` : `${actor} sent a message`;
    case "message_edit":
      return preview
        ? `${actor} edited a message: ${preview}`
        : `${actor} edited a message`;
    case "message_delete_soft":
      return `${actor} hid a message${meta.scope === "self" ? " for themselves" : ""}`;
    case "message_delete_hard":
      return `${actor} hard deleted a message`;
    case "role_promote":
      return `${actor} promoted ${targetName ?? "a participant"}`;
    case "role_demote":
      return `${actor} demoted ${targetName ?? "a participant"}`;
    case "thread_meta":
      return `${actor} updated thread settings`;
    case "subscribe_push":
      return `${actor} subscribed to push notifications`;
    case "unsubscribe_push":
      return `${actor} unsubscribed from push notifications`;
    default:
      return `${actor} performed ${row.action}`;
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id as string;
  if (!isDmAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let parsed: z.infer<typeof querySchema>;
  try {
    parsed = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  } catch {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const thread = await fetchThreadById(parsed.threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const limit = Math.min(parsed.limit ?? 25, 100);
    const sb = supabaseAdmin();

    let query = sb
      .from("dm_audit")
      .select("id,thread_id,actor_id,action,target_id,meta,created_at")
      .eq("thread_id", parsed.threadId)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (parsed.cursor) {
      query = query.lt("created_at", parsed.cursor);
    }

    const { data, error } = await query;
    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Failed to load audit entries" },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as AuditRow[];
    const hasMore = rows.length > limit;
    const sliced = rows.slice(0, limit);
    const nextCursor =
      hasMore && sliced.length > 0
        ? sliced[sliced.length - 1].created_at
        : null;

    const actorIds = Array.from(
      new Set(
        sliced
          .map((row) => row.actor_id)
          .filter((value): value is string => typeof value === "string"),
      ),
    );

    const actorNames = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: actors, error: actorError } = await sb
        .from("users")
        .select("id,display_name,name,email")
        .in("id", actorIds);
      if (actorError) {
        console.error(actorError);
      } else {
        const typedActors = (actors ?? []) as Array<{
          id: string;
          display_name: string | null;
          name: string | null;
          email: string | null;
        }>;
        typedActors.forEach((actor) => {
          const name =
            actor.display_name ?? actor.name ?? actor.email ?? "Unknown user";
          actorNames.set(actor.id, name);
        });
      }
    }

    const entries = sliced.map((row) => {
      const actorName =
        row.actor_id === null
          ? "System"
          : (actorNames.get(row.actor_id) ?? "Unknown user");
      return {
        id: row.id,
        threadId: row.thread_id,
        actorId: row.actor_id,
        action: row.action,
        targetId: row.target_id,
        meta: row.meta,
        createdAt: row.created_at,
        text: describeAction(row, actorName),
      };
    });

    return NextResponse.json({
      entries,
      hasMore,
      nextCursor,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
