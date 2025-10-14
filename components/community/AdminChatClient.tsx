"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import GlowPanel from "@/components/GlowPanel";

type ThreadMeta = {
  id: string;
  userId: string;
  status: string;
  startedAt: string;
  lastMessageAt: string | null;
  wallpaperUrl: string | null;
  avatarUrl: string | null;
  description: string | null;
};

type Message = {
  id: string;
  threadId: string;
  authorId: string | null;
  kind: string;
  text: string | null;
  editedAt: string | null;
  createdAt: string;
};

type ChatUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  isDmAdmin?: boolean;
};

type MessagesResponse = {
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
};

type AdminChatClientProps = {
  initialThread: ThreadMeta | null;
  user: ChatUser;
};

const formatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "numeric",
});

function formatTime(value: string) {
  try {
    return formatter.format(new Date(value));
  } catch {
    return value;
  }
}

function isSameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getUTCDate() === db.getUTCDate() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCFullYear() === db.getUTCFullYear()
  );
}

export default function AdminChatClient({
  initialThread,
  user,
}: AdminChatClientProps) {
  const [thread, setThread] = useState<ThreadMeta | null>(initialThread);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabaseBrowser.channel> | null>(null);

  const isDmAdmin = !!user.isDmAdmin;

  const loadMessages = useCallback(
    async (cursor?: string) => {
      if (!thread) return;
      setLoadingMessages(true);
      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(
          `/api/community/adminchat/messages${params.toString() ? `?${params}` : ""}`,
          { method: "GET", cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error("Failed to load messages");
        }
        const data: MessagesResponse = await res.json();
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
        setMessages((prev) =>
          cursor ? [...data.messages, ...prev] : data.messages,
        );
      } catch (err: any) {
        console.error(err);
        setError("Could not load messages.");
      } finally {
        setLoadingMessages(false);
      }
    },
    [thread],
  );

  const refreshThread = useCallback(async () => {
    try {
      const res = await fetch("/api/community/adminchat/thread", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.thread) setThread(data.thread);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = bottomRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (thread) {
      loadMessages();
      scrollToBottom();
    }
  }, [thread, loadMessages, scrollToBottom]);

  useEffect(() => {
    if (!thread) return;
    const channel = supabaseBrowser.channel(`dm_thread_${thread.id}`);
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
          filter: `thread_id=eq.${thread.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            const next = [...prev, mapMessageRow(row)];
            return next.sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            );
          });
          if (row.author_id !== user.id) {
            sendReceipt(false, thread.id);
          }
          scrollToBottom(true);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dm_messages",
          filter: `thread_id=eq.${thread.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          setMessages((prev) =>
            prev.map((msg) => (msg.id === row.id ? mapMessageRow(row) : msg)),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_message_visibility",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const hidden = payload.new as any;
          if (!hidden.hidden) return;
          setMessages((prev) => prev.filter((msg) => msg.id !== hidden.message_id));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // subscribed
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [thread, user.id, scrollToBottom, sendReceipt]);

  useEffect(() => {
    if (!thread) return;
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last && last.authorId !== user.id) {
      sendReceipt(false, thread.id);
    }
  }, [messages, thread, user.id, sendReceipt]);

  const sendReceipt = useCallback(
    async (typing: boolean, threadId?: string) => {
      const currentThreadId = threadId ?? thread?.id;
      if (!currentThreadId) return;
      try {
        await fetch("/api/community/adminchat/receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: isDmAdmin ? currentThreadId : undefined,
            typing,
            lastReadAt: !typing ? new Date().toISOString() : undefined,
          }),
        });
      } catch (err) {
        console.error(err);
      }
    },
    [isDmAdmin, thread?.id],
  );

  const handleStart = useCallback(async () => {
    try {
      const res = await fetch("/api/community/adminchat/start", { method: "POST" });
      if (!res.ok) {
        throw new Error("Failed to start chat");
      }
      const data = await res.json();
      setThread(data.thread);
      refreshThread();
    } catch (err) {
      console.error(err);
      setError("Unable to start chat right now.");
    }
  }, [refreshThread]);

  const handleSend = useCallback(async () => {
    if (!thread || sending) return;
    const trimmed = composer.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      const res = await fetch("/api/community/adminchat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          threadId: isDmAdmin ? thread.id : undefined,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to send");
      }
      const data = await res.json();
      setMessages((prev) => {
        const next = [...prev, data.message as Message];
        return next.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
      setComposer("");
      sendReceipt(false, thread.id);
      scrollToBottom(true);
    } catch (err) {
      console.error(err);
      setError("Message failed to send.");
    } finally {
      setSending(false);
    }
  }, [composer, isDmAdmin, sendReceipt, sending, thread, scrollToBottom]);

  const handleEditSubmit = useCallback(async () => {
    if (!thread || !editingId) return;
    const trimmed = editingText.trim();
    if (!trimmed) {
      setEditingId(null);
      setEditingText("");
      return;
    }
    try {
      const res = await fetch(`/api/community/adminchat/message/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMessages((prev) =>
        prev.map((msg) => (msg.id === data.message.id ? (data.message as Message) : msg)),
      );
      setEditingId(null);
      setEditingText("");
    } catch (err) {
      console.error(err);
      setError("Unable to edit message.");
    }
  }, [editingId, editingText, thread]);

  const handleHide = useCallback(async (messageId: string) => {
    try {
      const res = await fetch(
        `/api/community/adminchat/message/${messageId}/hide`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed");
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (err) {
      console.error(err);
      setError("Failed to delete message.");
    }
  }, []);

  const handleComposerKey = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  useEffect(() => {
    if (!thread) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (composer.trim().length > 0) {
      sendReceipt(true, thread.id);
      typingTimeout.current = setTimeout(() => {
        sendReceipt(false, thread.id);
      }, 1500);
    } else {
      sendReceipt(false, thread.id);
    }
  }, [composer, sendReceipt, thread]);

  const groupedMessages = useMemo(() => {
    if (messages.length === 0) return [];
    const groups: Array<{ date: string; items: Message[] }> = [];
    messages.forEach((message) => {
      const date = message.createdAt.split("T")[0];
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && isSameDay(lastGroup.date, message.createdAt)) {
        lastGroup.items.push(message);
      } else {
        groups.push({ date: message.createdAt, items: [message] });
      }
    });
    return groups;
  }, [messages]);

  return (
    <div className="flex flex-col gap-6">
      <header className="sticky top-0 z-20 -mx-4 flex flex-col gap-4 border-b border-white/10 bg-[#07070b]/95 px-4 py-4 backdrop-blur md:mx-0 md:rounded-3xl md:border md:px-6 md:py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/10">
              {thread?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thread.avatarUrl}
                  alt="Thread avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-xl">💬</div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Admin Chat
              </h1>
              <div className="flex items-center gap-2 text-xs text-white/45">
                <span className="pill border-white/10 text-white/60">
                  {thread?.status?.toUpperCase() ?? "OPEN"}
                </span>
                {thread?.description && (
                  <span className="line-clamp-1 text-white/60">{thread.description}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/60 transition hover:border-white/30 hover:text-white"
              disabled
            >
              🔔
            </button>
            <button
              type="button"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/60 transition hover:border-white/30 hover:text-white"
              disabled
            >
              Search
            </button>
          </div>
        </div>
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}
      </header>

      {!thread && (
        <GlowPanel subtle className="flex flex-col items-center gap-6 p-10 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Start a chat with the admin team
            </h2>
            <p className="text-sm text-white/65">
              Ask questions, share progress, or get feedback. Your conversation stays private with the
              Focus Squad admins.
            </p>
          </div>
          <button type="button" className="btn-primary px-10" onClick={handleStart}>
            Start chat
          </button>
        </GlowPanel>
      )}

      {thread && (
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-[#0d0d16]/80 shadow-[0_25px_80px_-28px_rgba(119,88,247,0.55)] md:min-h-[65vh]">
          <div
            ref={listRef}
            className="flex max-h-[60vh] flex-col gap-6 overflow-y-auto px-4 pt-6 md:px-6 md:pt-8"
          >
            {hasMore && (
              <button
                type="button"
                className="mx-auto mb-2 rounded-full border border-white/10 px-4 py-1 text-xs text-white/65 transition hover:border-white/25 hover:text-white"
                onClick={() => loadMessages(nextCursor ?? undefined)}
                disabled={loadingMessages}
              >
                {loadingMessages ? "Loading…" : "Load previous"}
              </button>
            )}

            {groupedMessages.map((group) => (
              <div key={group.date} className="space-y-4">
                <div className="text-center text-xs uppercase tracking-[0.35em] text-white/30">
                  {new Date(group.date).toLocaleDateString()}
                </div>
                {group.items.map((message) => {
                  const mine = message.authorId === user.id;
                  const editing = editingId === message.id;
                  return (
                    <div
                      key={message.id}
                      className={`group flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`relative max-w-[75%] rounded-3xl border px-4 py-3 text-sm leading-relaxed shadow-[0_15px_45px_rgba(9,9,20,0.4)] ${
                          mine
                            ? "border-transparent bg-gradient-to-r from-[var(--swf-glow-start)] to-[var(--swf-glow-end)] text-white"
                            : "border-white/10 bg-white/5 text-white/85"
                        }`}
                      >
                        {editing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              rows={3}
                              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 transition hover:border-white/40"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingText("");
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn-primary h-9 px-4 text-xs"
                                onClick={handleEditSubmit}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="whitespace-pre-wrap break-words">
                              {message.text}
                            </div>
                            <div className="mt-3 flex items-center gap-3 text-[11px] text-white/60">
                              <span>{formatTime(message.createdAt)}</span>
                              {message.editedAt && <span>edited</span>}
                            </div>
                          </>
                        )}

                        {!editing && (
                          <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              className="rounded-full bg-black/30 px-2 py-1 text-xs text-white/70 transition hover:bg-black/50"
                              onClick={() =>
                                setMenuOpenId((prev) => (prev === message.id ? null : message.id))
                              }
                            >
                              •••
                            </button>
                            {menuOpenId === message.id && (
                              <div className="absolute right-0 top-7 flex min-w-[140px] flex-col gap-1 rounded-2xl border border-white/10 bg-[#10101c] p-2 text-xs text-white/70 shadow-lg">
                                {mine && (
                                  <button
                                    type="button"
                                    className="rounded-xl px-3 py-2 text-left transition hover:bg-white/10 hover:text-white"
                                    onClick={() => {
                                      setEditingId(message.id);
                                      setEditingText(message.text ?? "");
                                      setMenuOpenId(null);
                                    }}
                                  >
                                    Edit
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="rounded-xl px-3 py-2 text-left transition hover:bg-white/10 hover:text-white"
                                  onClick={() => {
                                    handleHide(message.id);
                                    setMenuOpenId(null);
                                  }}
                                >
                                  Delete for me
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {!loadingMessages && messages.length === 0 && (
              <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-6 text-center text-sm text-white/50">
                No messages yet. Say hello to get things rolling.
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="sticky bottom-0 rounded-3xl border-t border-white/10 bg-[#0d0d16]/95 p-4 md:border md:px-6 md:pb-6 md:pt-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[inset_0_0_40px_rgba(139,92,246,0.15)]">
              <textarea
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={handleComposerKey}
                disabled={sending}
                placeholder="Write a message..."
                className="min-h-[72px] resize-none rounded-2xl border border-transparent bg-transparent text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-white/40">
                  Press Enter to send · Shift + Enter for newline
                </div>
                <button
                  type="button"
                  className="btn-primary h-10 px-8"
                  onClick={handleSend}
                  disabled={sending || !composer.trim()}
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function mapMessageRow(row: any): Message {
  return {
    id: row.id,
    threadId: row.thread_id,
    authorId: row.author_id,
    kind: row.kind,
    text: row.text,
    editedAt: row.edited_at,
    createdAt: row.created_at,
  };
}


