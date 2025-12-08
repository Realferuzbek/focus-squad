"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminInbox from "@/components/community/AdminInbox";
import AdminChatClient, {
  type ChatUser,
  type ThreadMeta,
  type ThreadDisplayMeta,
} from "@/components/community/AdminChatClient";
import type { AdminInboxThread } from "@/lib/community/admin/server";
import { supabaseBrowser } from "@/lib/supabaseClient";
import GlowPanel from "@/components/GlowPanel";
import { MessageCircle } from "lucide-react";

type AdminChatAdminViewProps = {
  user: ChatUser;
  inboxThreads: AdminInboxThread[];
  initialThread: ThreadMeta | null;
  activeThreadId: string | null;
  displayMeta: ThreadDisplayMeta | null;
};

export default function AdminChatAdminView({
  user,
  inboxThreads,
  initialThread,
  activeThreadId,
  displayMeta,
}: AdminChatAdminViewProps) {
  const [mobileInboxOpen, setMobileInboxOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [threads, setThreads] = useState(inboxThreads);
  const [activeThreadIdState, setActiveThreadIdState] = useState<string | null>(
    activeThreadId ?? null,
  );
  const refreshingInboxRef = useRef(false);

  useEffect(() => {
    setThreads(inboxThreads);
  }, [inboxThreads]);

  useEffect(() => {
    setActiveThreadIdState(activeThreadId ?? null);
  }, [activeThreadId]);

  useEffect(() => {
    if (activeThreadIdState) {
      setCollapsed(false);
    }
  }, [activeThreadIdState]);

  const refreshInbox = useCallback(async () => {
    if (refreshingInboxRef.current) return;
    refreshingInboxRef.current = true;
    try {
      const res = await fetch("/api/community/adminchat/admin/inbox", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.threads)) {
        setThreads(data.threads as AdminInboxThread[]);
      }
    } catch (err) {
      console.error("admin inbox refresh failed", err);
    } finally {
      refreshingInboxRef.current = false;
    }
  }, []);

  const buildPreview = useCallback((row: any) => {
    const kind = row?.kind as string | null;
    const text = typeof row?.text === "string" ? (row.text as string) : null;
    if (kind === "text" && text) {
      const trimmed = text.replace(/\s+/g, " ").trim();
      if (trimmed) {
        return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
      }
    }
    if (kind === "audio") return "Voice message";
    if (kind === "video") return "Video";
    if (kind === "image") return "Photo";
    if (kind === "file") {
      const mime = typeof row?.file_mime === "string" ? row.file_mime : "";
      if (mime.startsWith("application/pdf")) return "PDF";
      if (mime.startsWith("application/zip")) return "Archive";
      return "File";
    }
    if (kind === "system") return "System message";
    return "New message";
  }, []);

  const subscriptionDescriptor = useMemo(() => {
    const ids = new Set<string>();
    threads.forEach((thread) => {
      if (thread.id) ids.add(thread.id);
    });
    if (activeThreadIdState) ids.add(activeThreadIdState);
    if (ids.size === 0) return null;
    const sorted = Array.from(ids).sort();
    return {
      key: sorted.join("_"),
      filter: `thread_id=in.(${sorted.map((id) => `"${id}"`).join(",")})`,
    };
  }, [threads, activeThreadIdState]);

  useEffect(() => {
    if (!subscriptionDescriptor) return;
    const channel = supabaseBrowser.channel(
      `admin_inbox_${subscriptionDescriptor.key}`,
    );
    const handleInsert = (payload: { new: any }) => {
      const row = payload?.new;
      if (!row?.thread_id) return;
      const threadId = row.thread_id as string;
      const preview = buildPreview(row);
      const createdAt = row.created_at as string | undefined;
      const authorId = (row.author_id as string | null) ?? null;
      let matched = false;
      setThreads((prev) => {
        const index = prev.findIndex((thread) => thread.id === threadId);
        if (index === -1) {
          return prev;
        }
        matched = true;
        const updated: AdminInboxThread = {
          ...prev[index],
          lastMessageAt: createdAt ?? prev[index].lastMessageAt,
          lastMessagePreview: preview,
          unread:
            threadId === activeThreadIdState
              ? false
              : authorId
                ? authorId !== user.id
                : prev[index].unread,
        };
        const next = [...prev];
        next.splice(index, 1);
        return [updated, ...next];
      });
      if (!matched) {
        refreshInbox();
      }
    };
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "dm_messages",
        filter: subscriptionDescriptor.filter,
      },
      handleInsert,
    );
    channel.subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [
    activeThreadIdState,
    buildPreview,
    refreshInbox,
    subscriptionDescriptor,
    user.id,
  ]);

  const handleCollapse = useCallback(() => {
    setCollapsed(true);
    setMobileInboxOpen(false);
  }, []);

  const handleThreadSelect = useCallback((threadId: string) => {
    setActiveThreadIdState(threadId);
  }, []);

  const handleThreadOpen = useCallback(() => {
    setCollapsed(false);
  }, []);

  const showThreadPane = !!activeThreadIdState && !collapsed;
  const hasActiveThread = !!activeThreadIdState;

  return (
    <div className="min-h-[100dvh] bg-[#07070b] px-4 py-8 text-white md:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 md:grid md:grid-cols-[320px,minmax(0,1fr)] md:gap-6 lg:gap-8">
        <div
          className={`md:sticky md:top-12 md:h-[calc(100vh-7rem)] md:min-h-[320px] md:flex md:flex-shrink-0 ${
            showThreadPane ? "md:w-80" : "md:w-full"
          }`}
        >
          <div className="h-full overflow-hidden rounded-3xl border border-white/10 bg-[#080813]/80 shadow-[0_25px_80px_-32px_rgba(119,88,247,0.55)]">
            <AdminInbox
              threads={threads}
              activeThreadId={activeThreadIdState}
              currentAdminId={user.id}
              isMobileOpen={mobileInboxOpen}
              onCloseMobile={() => setMobileInboxOpen(false)}
              onThreadOpen={handleThreadOpen}
              onSelectThread={handleThreadSelect}
            />
          </div>
        </div>
        <div
          className={`${
            showThreadPane ? "flex" : "hidden"
          } flex-1 md:flex md:min-h-[calc(100vh-7rem)]`}
        >
          {hasActiveThread ? (
            <AdminChatClient
              user={user}
              initialThread={initialThread}
              forcedThreadId={activeThreadIdState ?? undefined}
              threadDisplayMeta={displayMeta}
              inboxOpen={mobileInboxOpen}
              onToggleInbox={() => setMobileInboxOpen((prev) => !prev)}
              onCloseInbox={() => setMobileInboxOpen(false)}
              onCollapseToInbox={handleCollapse}
            />
          ) : (
            <GlowPanel
              subtle
              className="flex h-[calc(100vh-7rem)] min-h-[480px] flex-1 flex-col items-center justify-center gap-4 rounded-3xl text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-3xl text-white/80 shadow-[0_20px_80px_rgba(124,58,237,0.35)]">
                <MessageCircle className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-white">
                  Open a conversation
                </h2>
                <p className="max-w-md text-sm text-white/70">
                  Select a member from the inbox to view and reply to their
                  messages.
                </p>
              </div>
            </GlowPanel>
          )}
        </div>
      </div>
    </div>
  );
}
