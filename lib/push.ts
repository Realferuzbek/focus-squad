"use server";

import webPush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseServer";

type PushPayload = {
  title: string;
  body: string;
  url: string;
};

type SubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type SupabaseClient = ReturnType<typeof supabaseAdmin>;

let configured = false;

type SubscriptionOptions = {
  topic?: string;
};

type SubscriptionRow = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function initPush() {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    console.warn("[push] Missing VAPID keys; push notifications disabled.");
    return false;
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

function normalizeMeta(meta: any) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return { topics: {} as Record<string, boolean> };
  }

  const cloned: Record<string, any> = { ...meta };
  const topics = cloned.topics;
  const normalizedTopics: Record<string, boolean> = {};
  if (topics && typeof topics === "object" && !Array.isArray(topics)) {
    for (const [key, value] of Object.entries(topics)) {
      if (value) {
        normalizedTopics[key] = true;
      }
    }
  }
  cloned.topics = normalizedTopics;
  return cloned;
}

async function collectThreadIds(client: SupabaseClient, userId: string) {
  const threadIds = new Set<string>();

  const [owned, participant] = await Promise.all([
    client.from("dm_threads").select("id").eq("user_id", userId),
    client.from("dm_participants").select("thread_id").eq("user_id", userId),
  ]);

  if (owned.error) {
    console.error("[push] failed to load user threads", owned.error);
  } else {
    owned.data?.forEach((row: any) => {
      if (row?.id) threadIds.add(row.id);
    });
  }

  if (participant.error) {
    console.error("[push] failed to load participant threads", participant.error);
  } else {
    participant.data?.forEach((row: any) => {
      if (row?.thread_id) threadIds.add(row.thread_id);
    });
  }

  return Array.from(threadIds);
}

async function deliverPayload(
  client: SupabaseClient,
  rows: SubscriptionRow[],
  payload: PushPayload,
) {
  if (!rows.length) return;

  await Promise.all(
    rows.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload),
        );
      } catch (err: any) {
        const status = err?.statusCode ?? err?.code;
        if (status === 404 || status === 410) {
          await client.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("[push] send error", err);
        }
      }
    }),
  );
}

async function logAudit(
  client: SupabaseClient,
  entries: Array<{
    threadId: string;
    actorId: string | null;
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
    targetId?: string | null;
    meta?: Record<string, unknown> | null;
  }>,
) {
  if (!entries.length) return;
  const payload = entries.map((entry) => ({
    thread_id: entry.threadId,
    actor_id: entry.actorId,
    action: entry.action,
    target_id: entry.targetId ?? null,
    meta: entry.meta ?? null,
  }));

  const { error } = await client.from("dm_audit").insert(payload);
  if (error) {
    console.error("[push] failed to log audit event", error);
  }
}

export async function saveSubscription(
  userId: string,
  subscription: SubscriptionInput,
  options?: SubscriptionOptions,
) {
  const client = supabaseAdmin();
  const { endpoint, p256dh, auth } = subscription;
  const topic = options?.topic;

  const { data: existing, error: fetchError } = await client
    .from("push_subscriptions")
    .select("id,meta")
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("[push] failed to load subscription meta", fetchError);
    throw fetchError;
  }

  const meta = normalizeMeta(existing?.meta);
  if (topic) {
    meta.topics[topic] = true;
  }

  let error;
  if (existing?.id) {
    ({ error } = await client
      .from("push_subscriptions")
      .update({
        user_id: userId,
        p256dh,
        auth,
        meta,
      })
      .eq("id", existing.id));
  } else {
    ({ error } = await client.from("push_subscriptions").insert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      meta,
    }));
  }

  if (error) {
    console.error("[push] failed to save subscription", error);
    throw error;
  }

  if (!topic) {
    const threadIds = await collectThreadIds(client, userId);
    await logAudit(
      client,
      threadIds.map((threadId) => ({
        threadId,
        actorId: userId,
        action: "subscribe_push",
        meta: { endpoint },
      })),
    );
  }
}

export async function removeSubscription(userId: string, endpoint: string) {
  const client = supabaseAdmin();
  const { error } = await client
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) {
    console.error("[push] failed to remove subscription", error);
    throw error;
  }

  const threadIds = await collectThreadIds(client, userId);
  await logAudit(
    client,
    threadIds.map((threadId) => ({
      threadId,
      actorId: userId,
      action: "unsubscribe_push",
      meta: { endpoint },
    })),
  );
}

export async function removeSubscriptionTopic(
  userId: string,
  endpoint: string,
  topic: string,
) {
  const client = supabaseAdmin();
  const { data: existing, error: fetchError } = await client
    .from("push_subscriptions")
    .select("id,meta")
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("[push] failed to load subscription topic", fetchError);
    throw fetchError;
  }

  if (!existing) return;

  const meta = normalizeMeta(existing.meta);
  if (!meta.topics[topic]) return;

  delete meta.topics[topic];

  const { error } = await client
    .from("push_subscriptions")
    .update({ meta })
    .eq("id", existing.id);

  if (error) {
    console.error("[push] failed to remove subscription topic", error);
    throw error;
  }
}

export async function saveSubscriptionTopic(
  userId: string,
  subscription: SubscriptionInput,
  topic: string,
) {
  await saveSubscription(userId, subscription, { topic });
}

export async function sendToUser(
  userId: string,
  payload: PushPayload,
  clientOverride?: SupabaseClient,
) {
  if (!initPush()) return;

  const client = clientOverride ?? supabaseAdmin();
  const { data, error } = await client
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId);

  if (error) {
    console.error("[push] failed to load subscriptions", error);
    return;
  }

  if (!data?.length) return;

  await deliverPayload(client, data as SubscriptionRow[], payload);
}

export async function notifyThreadNewMessage(
  threadId: string,
  authorId: string | null,
  previewText: string,
) {
  if (!initPush()) return;

  const client = supabaseAdmin();
  const recipients = new Set<string>();

  const [participants, threadOwner] = await Promise.all([
    client.from("dm_participants").select("user_id").eq("thread_id", threadId),
    client.from("dm_threads").select("user_id").eq("id", threadId).maybeSingle(),
  ]);

  if (participants.error) {
    console.error("[push] failed to load participants", participants.error);
  } else {
    participants.data?.forEach((row: any) => {
      if (row?.user_id) recipients.add(row.user_id);
    });
  }

  if (threadOwner.error) {
    console.error("[push] failed to load thread owner", threadOwner.error);
  } else if (threadOwner.data?.user_id) {
    recipients.add(threadOwner.data.user_id);
  }

  if (authorId) {
    recipients.delete(authorId);
  }

  if (!recipients.size) return;

  const payload: PushPayload = {
    title: "New message",
    body: previewText,
    url: "/community/admin",
  };

  await Promise.all(
    Array.from(recipients).map(async (userId) => {
      await sendToUser(userId, payload, client);
    }),
  );
}

export async function sendToTopic(
  topic: string,
  payload: PushPayload,
  clientOverride?: SupabaseClient,
) {
  if (!initPush()) return;

  const client = clientOverride ?? supabaseAdmin();
  const { data, error } = await client
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .contains("meta", { topics: { [topic]: true } });

  if (error) {
    console.error("[push] failed to load topic subscriptions", error);
    return;
  }

  if (!data?.length) return;

  await deliverPayload(client, data as SubscriptionRow[], payload);
}
