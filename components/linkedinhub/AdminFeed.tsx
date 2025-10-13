"use client";

import { useEffect, useMemo, useState } from "react";
import PostCard from "./PostCard";
import Notice from "./Notice";

type AdminFeedProps = {
  ownerName: string;
  avatarUrl?: string | null;
};

/** Matches rows from `linkedin_admin_posts` */
type LinkedInPost = {
  id: string;
  title?: string | null;
  excerpt?: string | null;
  media_url?: string | null;
  post_url: string;
  created_at: string;
  published_at?: string | null;
};

/** API response shapes */
type ApiSuccess = { ok: true; data: LinkedInPost[] };
type ApiFailure = {
  ok: false;
  error?: string;
  /** Some handlers returned this flag */
  missingTable?: boolean;
  /** Optional reason enum for future-proofing */
  reason?: "missing_table" | "not_admin" | "forbidden";
};
type ApiResponse = ApiSuccess | ApiFailure;

export default function AdminFeed({ ownerName, avatarUrl }: AdminFeedProps) {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/linkedinhub/admin/posts", { cache: "no-store" });
        const data: ApiResponse = await res.json();
        if (!mounted) return;

        // Narrow first: any non-OK payload is a failure shape
        if (!data.ok) {
          // Support either `missingTable: true` or `reason: 'missing_table'`
          if (data.missingTable || data.reason === "missing_table") {
            setMissing(true);
          } else {
            setError(data.error ?? "Failed to load LinkedIn posts.");
          }
          setPosts([]);
          return;
        }

        // Success
        setMissing(false);
        setError(null);
        setPosts(Array.isArray(data.data) ? data.data : []);
      } catch {
        if (!mounted) return;
        setError("Network error while loading posts.");
        setPosts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 5 * 60 * 1000); // refresh every 5 minutes
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refreshKey]);

  const skeletons = useMemo(() => new Array(3).fill(null), []);

  if (missing) {
    return (
      <Notice
        title="LinkedIn Hub"
        message="LinkedIn Hub is not set up yet. Admin needs to create the linkedin_admin_posts table."
      />
    );
  }

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {skeletons.map((_, idx) => (
          <div
            key={idx}
            className="h-64 rounded-3xl border border-white/10 bg-[#0d0d16]/70 p-6"
          >
            <div className="flex animate-pulse items-start gap-3">
              <div className="h-12 w-12 rounded-2xl bg-zinc-700/40" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-1/3 rounded bg-zinc-700/40" />
                <div className="h-3 w-1/5 rounded bg-zinc-700/30" />
              </div>
            </div>
            <div className="mt-6 space-y-3 animate-pulse">
              <div className="h-3 w-full rounded bg-zinc-700/40" />
              <div className="h-3 w-3/4 rounded bg-zinc-700/40" />
              <div className="h-3 w-2/5 rounded bg-zinc-700/30" />
            </div>
            <div className="mt-6 h-32 rounded-2xl bg-zinc-700/20" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Notice
        title="Something went wrong"
        message={error}
        action={
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-1 text-sm font-semibold text-white hover:bg-white/20"
            onClick={() => {
              setMissing(false);
              setError(null);
              setRefreshKey((key) => key + 1);
            }}
          >
            Try again
          </button>
        }
      />
    );
  }

  if (posts.length === 0) {
    return (
      <Notice
        title="No posts yet"
        message="Once the admin publishes LinkedIn posts here, they will appear with full context. Check back soon!"
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} name={ownerName} avatarUrl={avatarUrl} />
      ))}
    </div>
  );
}
