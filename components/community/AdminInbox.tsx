"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Inbox, X } from "lucide-react";
import { useReducedMotion, motion, AnimatePresence } from "framer-motion";
import type { AdminInboxThread } from "@/lib/community/admin/server";

type AdminInboxProps = {
  threads: AdminInboxThread[];
  activeThreadId: string | null;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
};

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

function formatTimestamp(value: string | null) {
  if (!value) return "No messages";
  const date = new Date(value);
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffMinutes) < 60) {
    return relativeFormatter.format(diffMinutes, "minute");
  }
  if (Math.abs(diffHours) < 24) {
    return relativeFormatter.format(diffHours, "hour");
  }
  if (Math.abs(diffDays) < 7) {
    return relativeFormatter.format(diffDays, "day");
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function AdminInbox({
  threads,
  activeThreadId,
  isMobileOpen,
  onCloseMobile,
}: AdminInboxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [threads]);

  const handleSelect = useCallback(
    (threadId: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("thread", threadId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      if (onCloseMobile) onCloseMobile();
    },
    [pathname, router, searchParams, onCloseMobile],
  );

  const panel = (
    <div
      className="flex h-full w-full flex-col gap-4 overflow-hidden border-r border-white/10 bg-[#080813]/95 p-4 text-white"
      role="navigation"
      aria-label="Admin chat inbox"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
          <Inbox className="h-4 w-4 text-white/60" aria-hidden="true" />
          Inbox
        </div>
        <button
          type="button"
          className="rounded-full border border-white/10 p-2 text-white/60 transition hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:hidden"
          onClick={onCloseMobile}
          aria-label="Close inbox"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto pr-1">
        {sortedThreads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const avatar = thread.avatarUrl ?? thread.targetUser?.avatarUrl ?? null;
          const label =
            thread.targetUser?.name ??
            thread.targetUser?.email ??
            "Conversation";

          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => handleSelect(thread.id)}
              className={`group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                isActive
                  ? "bg-white/10"
                  : "hover:border-white/15 hover:bg-white/5"
              }`}
              aria-current={isActive ? "true" : "false"}
            >
              <div className="relative h-11 w-11 overflow-hidden rounded-2xl border border-white/10 bg-white/10 text-lg">
                {avatar ? (
                  <Image
                    src={avatar}
                    alt=""
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-base">
                    💬
                  </div>
                )}
                {thread.unread && (
                  <span className="absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#080813] bg-[var(--swf-glow-end,#8b5cf6)] text-[10px] text-white shadow-[0_0_0_2px_rgba(8,8,19,0.95)]">
                    •
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm font-semibold ${isActive ? "text-white" : "text-white/90"}`}>
                    {label}
                  </span>
                  <span className="shrink-0 text-[11px] uppercase tracking-wide text-white/40">
                    {formatTimestamp(thread.lastMessageAt)}
                  </span>
                </div>
                {thread.targetUser?.email && (
                  <div className="truncate text-xs text-white/50">
                    {thread.targetUser.email}
                  </div>
                )}
                {!thread.targetUser?.email && (
                  <div className="text-xs text-white/35">
                    {thread.status?.toUpperCase() ?? "OPEN"}
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {!sortedThreads.length && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/60">
            No conversations yet.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            key="inbox-overlay"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
            onClick={onCloseMobile}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {isMobileOpen && (
          <motion.aside
            key="inbox-panel"
            className="fixed inset-y-0 left-0 z-50 h-full w-[min(90vw,320px)] md:hidden"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36 }}
          >
            {panel}
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="hidden h-full w-80 md:block">
        {panel}
      </div>
    </>
  );
}
