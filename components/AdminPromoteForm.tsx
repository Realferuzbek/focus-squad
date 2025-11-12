"use client";

import { FormEvent, useState } from "react";
import { csrfFetch } from "@/lib/csrf-client";

interface AdminPromoteFormProps {
  className?: string;
}

export default function AdminPromoteForm({ className }: AdminPromoteFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const form = event.currentTarget;
    const payload = new FormData(form);

    try {
      const response = await csrfFetch(form.action || "/api/admin/users", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        setError("Request failed. Please try again.");
        setSubmitting(false);
        return;
      }

      if (response.redirected) {
        window.location.href = response.url;
      } else {
        window.location.reload();
      }
    } catch {
      setError("Network error. Please retry.");
      setSubmitting(false);
    }
  }

  return (
    <form action="/api/admin/users" method="post" onSubmit={handleSubmit}>
      <div className={className}>
        <input
          name="email"
          type="email"
          required
          placeholder="user@example.com"
          className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm outline-none transition hover:border-white/20 focus:border-[var(--swf-glow-start)]"
        />
        <select
          name="action"
          className="rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm outline-none transition hover:border-white/20 focus:border-[var(--swf-glow-start)]"
        >
          <option value="promote">Promote to admin</option>
          <option value="demote">Demote from admin</option>
        </select>
        <button className="btn-primary" disabled={submitting}>
          {submitting ? "Working…" : "Apply"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
    </form>
  );
}
