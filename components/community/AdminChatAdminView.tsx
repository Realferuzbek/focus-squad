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
    const channel = supabaseBrowser.channel(`admin_inbox_${subscriptionDescriptor.key}`);
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
              : authorId ? authorId !== user.id : prev[index].unread,
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
  }, [activeThreadIdState, buildPreview, refreshInbox, subscriptionDescriptor, user.id]);

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

  return (
    <div className="min-h-[100dvh] bg-[#07070b] px-4 py-8 text-white md:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 md:flex-row md:gap-8">
        <div
          className={`md:sticky md:top-10 md:h-[calc(100vh-5rem)] md:flex md:flex-shrink-0 ${
            showThreadPane ? "md:w-80" : "md:w-full"
          }`}
        >
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
        <div
          className={`${
            showThreadPane ? "flex" : "hidden"
          } flex-1 md:flex md:min-h-[calc(100vh-5rem)]`}
        >
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
        </div>
      </div>
    </div>
  );
}
