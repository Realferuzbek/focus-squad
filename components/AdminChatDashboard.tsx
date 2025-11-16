"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Download, Filter, Loader2, Trash2, X } from "lucide-react";

type AdminChat = {
  id: string;
  user_id: string | null;
  session_id: string;
  language: string;
  input: string;
  reply: string;
  used_rag: boolean;
  rating: number | null;
  created_at: string;
};

type ProfileMap = Record<
  string,
  { email: string | null; display_name?: string | null; name?: string | null }
>;

type Props = {
  users: Array<{ id: string; email: string }>;
};

type Filters = {
  userId: string;
  usedRag: "all" | "with" | "without";
  from: string;
  to: string;
};

export default function AdminChatDashboard({ users }: Props) {
  const [logs, setLogs] = useState<AdminChat[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [filters, setFilters] = useState<Filters>({
    userId: "",
    usedRag: "all",
    from: "",
    to: "",
  });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<AdminChat | null>(null);

  useEffect(() => {
    const initialProfiles: ProfileMap = {};
    users.forEach((user) => {
      initialProfiles[user.id] = {
        email: user.email,
        display_name: null,
        name: null,
      };
    });
    setProfiles(initialProfiles);
  }, [users]);

  const loadLogs = async (cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.set("userId", filters.userId);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.usedRag === "with") params.set("usedRag", "true");
      if (filters.usedRag === "without") params.set("usedRag", "false");
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/admin/chats?${params.toString()}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to load logs");
      setLogs((prev) => (cursor ? [...prev, ...body.items] : body.items));
      setNextCursor(body.nextCursor ?? null);
      setSelection(new Set());
      if (body.profiles) {
        setProfiles((prev) => ({ ...prev, ...body.profiles }));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const toggleSelection = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const deleteSelected = async () => {
    if (!selection.size) return;
    const confirmed = window.confirm(
      `Delete ${selection.size} chat${selection.size > 1 ? "s" : ""}?`,
    );
    if (!confirmed) return;
    try {
      const res = await fetch("/api/admin/chats/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatIds: Array.from(selection) }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setLogs((prev) => prev.filter((log) => !selection.has(log.id)));
      setSelection(new Set());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const exportLogs = (format: "csv" | "json") => {
    const params = new URLSearchParams();
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.usedRag === "with") params.set("usedRag", "true");
    if (filters.usedRag === "without") params.set("usedRag", "false");
    params.set("format", format);
    window.open(`/api/admin/chats/export?${params.toString()}`, "_blank");
  };

  const activeProfiles = useMemo(() => profiles, [profiles]);

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0f0f18]/90 p-6 shadow-[0_18px_45px_-24px_rgba(140,122,245,0.35)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">AI Chats</h2>
          <p className="text-sm text-white/60">
            Review questions, answers, ratings, and moderation signals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportLogs("json")}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => exportLogs("csv")}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            disabled={!selection.size}
            onClick={deleteSelected}
            className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <label className="text-xs uppercase tracking-[0.2em] text-white/40">
          User
          <select
            value={filters.userId}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                userId: event.target.value,
              }))
            }
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          >
            <option value="">All users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs uppercase tracking-[0.2em] text-white/40">
          Used site context
          <select
            value={filters.usedRag}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                usedRag: event.target.value as Filters["usedRag"],
              }))
            }
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          >
            <option value="all">Any</option>
            <option value="with">Used RAG</option>
            <option value="without">Off-topic</option>
          </select>
        </label>

        <label className="text-xs uppercase tracking-[0.2em] text-white/40">
          From
          <input
            type="date"
            value={filters.from}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, from: event.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="text-xs uppercase tracking-[0.2em] text-white/40">
          To
          <input
            type="date"
            value={filters.to}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, to: event.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
            <tr>
              <th className="p-3">
                <span className="sr-only">Select</span>
              </th>
              <th className="p-3">User</th>
              <th className="p-3">Time</th>
              <th className="p-3">Question</th>
              <th className="p-3">Answer</th>
              <th className="p-3">Used RAG</th>
              <th className="p-3">Rating</th>
              <th className="p-3">
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-t border-white/10 text-white/80"
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selection.has(log.id)}
                    onChange={() => toggleSelection(log.id)}
                    className="h-4 w-4 rounded border-white/40 bg-white/10 text-[#7C3AED]"
                  />
                </td>
                <td className="p-3">
                  {log.user_id
                    ? activeProfiles[log.user_id]?.email ?? log.user_id
                    : "Anonymous"}
                </td>
                <td className="p-3 text-xs text-white/60">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="p-3 max-w-[150px] truncate">{log.input}</td>
                <td className="p-3 max-w-[180px] truncate">{log.reply}</td>
                <td className="p-3">
                  {log.used_rag ? (
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                      Yes
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                      No
                    </span>
                  )}
                </td>
                <td className="p-3 text-center">
                  {formatRating(log.rating)}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => setDetails(log)}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-white hover:bg-white/10"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {!logs.length && !loading && (
              <tr>
                <td
                  colSpan={8}
                  className="p-6 text-center text-sm text-white/60"
                >
                  No chats match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading chats…
        </div>
      )}

      {nextCursor && !loading && (
        <button
          type="button"
          onClick={() => loadLogs(nextCursor)}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/10"
        >
          <Filter className="h-4 w-4" />
          Load more
        </button>
      )}

      {details && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#090a16] p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Chat details</h3>
              <button
                type="button"
                onClick={() => setDetails(null)}
                className="rounded-full bg-white/10 p-2 text-white/60 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  User
                </p>
                <p className="mt-1">
                  {details.user_id
                    ? activeProfiles[details.user_id]?.email ?? details.user_id
                    : "Anonymous"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Question
                </p>
                <p className="mt-1 whitespace-pre-wrap text-white/90">
                  {details.input}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Answer
                </p>
                <p className="mt-1 whitespace-pre-wrap text-white/90">
                  {details.reply}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <InfoTile label="Used RAG">
                  {details.used_rag ? "Yes" : "No"}
                </InfoTile>
                <InfoTile label="Rating">{formatRating(details.rating)}</InfoTile>
                <InfoTile label="Created">
                  {new Date(details.created_at).toLocaleString()}
                </InfoTile>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function formatRating(value: number | null) {
  if (value === 1) return "👍";
  if (value === -1) return "👎";
  return "—";
}

function InfoTile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
      <p className="uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className="mt-2 text-base text-white">{children}</p>
    </div>
  );
}
