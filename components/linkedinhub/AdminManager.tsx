"use client";

import { FormEvent, useMemo, useState } from "react";
import Notice from "./Notice";
import type { LinkedInPost } from "./PostCard";

type AdminManagerProps = {
  initialPosts: LinkedInPost[];
  missingTable?: boolean;
};

type Draft = {
  id?: string | null;
  postUrl: string;
  title: string;
  excerpt: string;
  mediaUrl: string;
  publishedAt: string;
};

const EMPTY_DRAFT: Draft = {
  id: null,
  postUrl: "",
  title: "",
  excerpt: "",
  mediaUrl: "",
  publishedAt: "",
};

function toInputValue(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const tzOffset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - tzOffset);
  return local.toISOString().slice(0, 16);
}

export default function AdminManager({ initialPosts, missingTable }: AdminManagerProps) {
  const [posts, setPosts] = useState<LinkedInPost[]>(initialPosts);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedPosts = useMemo(
    () =>
      [...posts].sort((a, b) => {
        const aDate = new Date(a.published_at ?? a.created_at ?? "").getTime();
        const bDate = new Date(b.published_at ?? b.created_at ?? "").getTime();
        return bDate - aDate;
      }),
    [posts],
  );

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const body: Record<string, unknown> = {
      postUrl: draft.postUrl.trim(),
    };

    if (draft.title.trim()) body.title = draft.title.trim();
    if (draft.excerpt.trim()) body.excerpt = draft.excerpt.trim();
    if (draft.mediaUrl.trim()) body.mediaUrl = draft.mediaUrl.trim();
    if (draft.publishedAt) {
      const isoDate = new Date(draft.publishedAt);
      if (!Number.isNaN(isoDate.getTime())) {
        body.publishedAt = isoDate.toISOString();
      }
    }

    let method: "POST" | "PATCH" = "POST";
    if (draft.id) {
      method = "PATCH";
      body.id = draft.id;
    }

    try {
      const res = await fetch("/api/linkedinhub/admin/posts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        if (data?.missingTable) {
          setError("LinkedIn Hub table is missing. Please create it in Supabase.");
        } else {
          setError(
            typeof data?.error === "string"
              ? data.error
              : "Unable to save the LinkedIn post.",
          );
        }
        return;
      }

      const post: LinkedInPost = data.data;
      setPosts((current) => {
        const without = current.filter((p) => p.id !== post.id);
        return [...without, post];
      });
      setMessage(draft.id ? "Post updated." : "Post published.");
      resetDraft();
    } catch (err) {
      setError("Network error while saving. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (submitting) return;
    if (!window.confirm("Delete this LinkedIn post?")) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/linkedinhub/admin/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data?.missingTable) {
          setError("LinkedIn Hub table is missing. Please create it in Supabase.");
        } else {
          setError(
            typeof data?.error === "string"
              ? data.error
              : "Unable to delete the LinkedIn post.",
          );
        }
        return;
      }
      setPosts((current) => current.filter((p) => p.id !== id));
      if (draft.id === id) resetDraft();
      setMessage("Post deleted.");
    } catch (err) {
      setError("Network error while deleting. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function edit(post: LinkedInPost) {
    setDraft({
      id: post.id,
      postUrl: post.post_url,
      title: post.title ?? "",
      excerpt: post.excerpt ?? "",
      mediaUrl: post.media_url ?? "",
      publishedAt: toInputValue(post.published_at),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      {missingTable && (
        <Notice
          title="Missing table"
          message="LinkedIn Hub is not set up yet. Create linkedin_admin_posts in Supabase to continue."
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-3xl border border-white/10 bg-[#11111f]/80 p-6 shadow-[0_20px_60px_rgba(10,10,20,0.45)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">
            {draft.id ? "Edit LinkedIn Post" : "Publish LinkedIn Post"}
          </h2>
          {draft.id && (
            <button
              type="button"
              className="text-sm text-fuchsia-300 underline-offset-4 hover:underline"
              onClick={resetDraft}
            >
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-zinc-300 md:col-span-2">
            Post URL *
            <input
              required
              type="url"
              value={draft.postUrl}
              onChange={(e) => setDraft((d) => ({ ...d, postUrl: e.target.value }))}
              placeholder="https://www.linkedin.com/feed/update/..."
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition hover:border-fuchsia-500/40 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-zinc-300">
            Title
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="e.g., Weekly Focus Wins"
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition hover:border-fuchsia-500/40 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-zinc-300">
            Media URL
            <input
              type="url"
              value={draft.mediaUrl}
              onChange={(e) => setDraft((d) => ({ ...d, mediaUrl: e.target.value }))}
              placeholder="https://..."
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition hover:border-fuchsia-500/40 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-zinc-300 md:col-span-2">
            Excerpt
            <textarea
              value={draft.excerpt}
              onChange={(e) => setDraft((d) => ({ ...d, excerpt: e.target.value }))}
              rows={4}
              placeholder="Add a short description or pull quote."
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition hover:border-fuchsia-500/40 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-zinc-300">
            Published at
            <input
              type="datetime-local"
              value={draft.publishedAt}
              onChange={(e) => setDraft((d) => ({ ...d, publishedAt: e.target.value }))}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition hover:border-fuchsia-500/40 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/40"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-2xl bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#ec4899] px-6 py-3 text-sm font-semibold shadow-[0_18px_35px_rgba(138,92,246,0.35)] transition hover:shadow-[0_26px_60px_rgba(138,92,246,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Saving…" : draft.id ? "Save changes" : "Publish post"}
          </button>

          {message && <span className="text-sm text-emerald-300">{message}</span>}
          {error && <span className="text-sm text-rose-300">{error}</span>}
        </div>
      </form>

      <section className="rounded-3xl border border-white/10 bg-[#0d0d16]/80 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent posts</h2>
          <span className="text-xs uppercase tracking-[0.28em] text-zinc-500">
            {sortedPosts.length} total
          </span>
        </div>

        {sortedPosts.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">
            Nothing published yet. Add a LinkedIn post using the form above.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-zinc-200">
              <thead className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                <tr>
                  <th className="border-b border-white/10 px-3 py-2">Title</th>
                  <th className="border-b border-white/10 px-3 py-2">Published</th>
                  <th className="border-b border-white/10 px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPosts.map((post) => (
                  <tr key={post.id} className="border-b border-white/10 last:border-none">
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">
                          {post.title ?? "Untitled post"}
                        </span>
                        <span className="text-xs text-zinc-500">{post.post_url}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-zinc-400">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.open(post.post_url, "_blank", "noopener,noreferrer")}
                          className="rounded-xl border border-white/10 px-3 py-1 text-xs text-white transition hover:border-fuchsia-400/60"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => edit(post)}
                          className="rounded-xl border border-white/10 px-3 py-1 text-xs text-white transition hover:border-fuchsia-400/60"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(post.id)}
                          className="rounded-xl border border-rose-500/30 px-3 py-1 text-xs text-rose-200 transition hover:border-rose-400/60"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
