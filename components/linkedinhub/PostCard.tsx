"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import GlowPanel from "@/components/GlowPanel";

export type LinkedInPost = {
  id: string;
  title?: string | null;
  excerpt?: string | null;
  media_url?: string | null;
  post_url: string;
  created_at?: string | null;
  published_at?: string | null;
};

type PostCardProps = {
  post: LinkedInPost;
  name: string;
  avatarUrl?: string | null;
};

export default function PostCard({ post, name, avatarUrl }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);

  const displayExcerpt = useMemo(() => post.excerpt?.trim() ?? "", [post.excerpt]);
  const shouldTruncate = displayExcerpt.length > 200;
  const content = expanded || !shouldTruncate ? displayExcerpt : displayExcerpt.slice(0, 200) + "…";

  const timestamp = useMemo(() => {
    const iso = post.published_at ?? post.created_at;
    if (!iso) return "Just now";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Just now";
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }, [post.created_at, post.published_at]);

  function openLink() {
    window.open(post.post_url, "_blank", "noopener,noreferrer");
  }

  return (
    <GlowPanel subtle className="p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-[0_12px_30px_rgba(10,10,25,0.4)]">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={name} fill sizes="40px" className="object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-sm text-white/70">👤</div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
              <span>{name}</span>
              <span className="text-white/30">•</span>
              <span className="text-xs uppercase tracking-[0.28em] text-emerald-300/80">Admin</span>
            </div>
            <p className="mt-0.5 text-xs text-white/45">{timestamp}</p>
          </div>
        </div>

        <button
          type="button"
          aria-label="More options"
          className="rounded-full p-2 text-white/40 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-400/70 focus:ring-offset-2 focus:ring-offset-[var(--swf-card)]"
        >
          <span className="text-lg">⋮</span>
        </button>
      </header>

      <div className="mt-5 space-y-3 text-[14px] leading-relaxed text-white/70">
        {post.title && <h3 className="text-[17px] font-semibold tracking-tight text-white/90">{post.title}</h3>}
        {displayExcerpt && (
          <p>
            {content}
            {shouldTruncate && !expanded && (
              <button
                type="button"
                className="ml-1 inline-flex items-center text-[13px] font-semibold text-[var(--swf-glow-end)] underline-offset-4 hover:underline"
                onClick={() => setExpanded(true)}
              >
                See more
              </button>
            )}
          </p>
        )}
      </div>

      {post.media_url && (
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <Image
            src={post.media_url}
            alt={post.title || "LinkedIn media"}
            width={800}
            height={450}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <footer className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Like", icon: "👍" },
          { label: "Comment", icon: "💬" },
          { label: "Share", icon: "🔗" },
          { label: "Open", icon: "↗" },
        ].map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={openLink}
            className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/75 transition hover:border-[var(--swf-glow-end)]/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-400/70 focus:ring-offset-2 focus:ring-offset-[var(--swf-card)]"
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </footer>
    </GlowPanel>
  );
}
