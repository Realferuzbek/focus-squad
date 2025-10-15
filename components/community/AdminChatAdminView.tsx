"use client";

import { useCallback, useEffect, useState } from "react";
import AdminInbox from "@/components/community/AdminInbox";
import AdminChatClient, {
  type ChatUser,
  type ThreadMeta,
  type ThreadDisplayMeta,
} from "@/components/community/AdminChatClient";
import type { AdminInboxThread } from "@/lib/community/admin/server";

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

  useEffect(() => {
    if (activeThreadId) {
      setCollapsed(false);
    }
  }, [activeThreadId]);

  const handleCollapse = useCallback(() => {
    setCollapsed(true);
    setMobileInboxOpen(false);
  }, []);

  const handleThreadOpen = useCallback(() => {
    setCollapsed(false);
  }, []);

  const showThreadPane = !!activeThreadId && !collapsed;

  return (
    <div className="min-h-[100dvh] bg-[#07070b] px-4 py-8 text-white md:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 md:flex-row md:gap-8">
        <div
          className={`md:sticky md:top-10 md:h-[calc(100vh-5rem)] md:flex md:flex-shrink-0 ${
            showThreadPane ? "md:w-80" : "md:w-full"
          }`}
        >
          <AdminInbox
            threads={inboxThreads}
            activeThreadId={activeThreadId}
            currentAdminId={user.id}
            isMobileOpen={mobileInboxOpen}
            onCloseMobile={() => setMobileInboxOpen(false)}
            onThreadOpen={handleThreadOpen}
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
            forcedThreadId={activeThreadId ?? undefined}
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
