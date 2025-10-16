"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LiveState = {
  is_live: boolean;
  members_count: number;
};

export default function LiveStreamCard() {
  const [state, setState] = useState<LiveState | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/community/live/state", {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("state fetch failed");
        }
        const json = await res.json();
        const normalized: LiveState = {
          is_live: !!json.isLive,
          members_count:
            typeof json.memberCount === "number" ? json.memberCount : 0,
        };
        if (alive) {
          setState(normalized);
        }
      } catch {
        if (alive) {
          setState((prev) => prev ?? null);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const isLive = !!state?.is_live;
  const members =
    state && typeof state.members_count === "number"
      ? state.members_count
      : undefined;

  const membersLabel =
    members !== undefined ? `${members} ${members === 1 ? "member" : "members"}` : "—";

  const badgeClasses = isLive
    ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/40"
    : "bg-white/[0.04] text-white/80 border-white/15";

  return (
    <Link
      href="/community/live"
      prefetch
      aria-label="Open Live Stream Chat"
      data-testid="live-open-link"
      className="group relative block rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
    >
      <div className="relative overflow-hidden rounded-3xl">
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/8 via-white/0 to-white/0" />
        <div className="pointer-events-none absolute inset-0 rounded-3xl shadow-[0_35px_120px_-60px_rgba(139,92,246,0.65)]" />

        <div className="relative z-10 flex h-full flex-col gap-6 p-6 sm:p-7 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.35em] text-violet-300/70">
                Live Energy
              </p>
              <h3 className="text-2xl font-semibold text-white">
                Live Stream Chat
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span
                data-testid="live-card-badge"
                className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition ${badgeClasses}`}
                aria-live="polite"
              >
                {isLive ? "Live" : "Closed"}
              </span>
              <span
                data-testid="live-card-members"
                className="inline-flex h-7 items-center rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-white/70"
              >
                {membersLabel}
              </span>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-4 text-sm text-white/70">
            <p className="max-w-xs">
              Drop into focused sessions with the squad and stay accountable.
            </p>
            <span
              aria-hidden="true"
              className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-sm text-white/90 ring-1 ring-inset ring-white/10 transition group-hover:bg-white/8 group-active:scale-[0.99]"
            >
              Open
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
