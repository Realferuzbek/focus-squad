"use client";

import { useMemo, useState } from "react";
import { csrfFetch } from "@/lib/csrf-client";

type UsageRow = {
  user_id: string;
  hours: number;
};

const numberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function AdminSessionPanel() {
  const [requireRelink, setRequireRelink] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalHours = useMemo(
    () => usage.reduce((acc, row) => acc + row.hours, 0),
    [usage],
  );

  async function forceReset() {
    if (resetLoading) return;
    setResetLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await csrfFetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relink: requireRelink }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Reset failed");
        return;
      }
      setMessage(
        `Session bumped to v${data?.session_version ?? "?"}${
          requireRelink ? " — Telegram links cleared" : ""
        }`,
      );
    } catch {
      setError("Reset failed");
    } finally {
      setResetLoading(false);
    }
  }

  async function refreshUsage() {
    if (usageLoading) return;
    setUsageLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/usage/summary", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Unable to fetch usage summary");
        return;
      }
      setUsage(Array.isArray(data?.totals) ? data.totals : []);
      setMessage("Usage summary refreshed");
    } catch {
      setError("Unable to fetch usage summary");
    } finally {
      setUsageLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#0f0f18] p-6">
        <h2 className="text-lg font-semibold">Global session reset</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Force everyone to sign back in. Optionally clear stored Telegram
          links.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 accent-fuchsia-500"
            checked={requireRelink}
            onChange={(e) => setRequireRelink(e.target.checked)}
          />
          Clear Telegram links
        </label>
        <button
          className="btn-primary focus-ring mt-4"
          onClick={forceReset}
          disabled={resetLoading}
        >
          {resetLoading ? "Resetting…" : "Force logout everyone"}
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0f0f18] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Usage summary</h2>
            <p className="text-sm text-zinc-400">
              Aggregate hours per user, last 100 users.
            </p>
          </div>
          <button
            className="btn-secondary focus-ring"
            onClick={refreshUsage}
            disabled={usageLoading}
          >
            {usageLoading ? "Refreshing…" : "Refresh usage summary"}
          </button>
        </div>

        {message && <p className="mt-4 text-sm text-emerald-400">{message}</p>}
        {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 font-medium">User ID</th>
                <th className="px-3 py-2 font-medium text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {usage.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-zinc-500" colSpan={2}>
                    No usage data yet.
                  </td>
                </tr>
              ) : (
                usage.map((row) => (
                  <tr key={row.user_id} className="border-t border-white/10">
                    <td className="px-3 py-2 text-zinc-200">{row.user_id}</td>
                    <td className="px-3 py-2 text-right text-zinc-100">
                      {numberFormatter.format(row.hours)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {usage.length > 0 && (
          <p className="mt-3 text-xs text-zinc-500">
            Total tracked hours: {numberFormatter.format(totalHours)}
          </p>
        )}
      </section>
    </div>
  );
}
