'use client';

import { useCallback, useEffect, useState } from 'react';
import { csrfFetch } from '@/lib/csrf-client';

type StatusResponse = { enabled: boolean };

function classNames(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export default function AdminAiToggle() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/ai-toggle', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || 'Failed to load AI status');
      }
      setStatus(body as StatusResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load status right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const toggle = async () => {
    if (status?.enabled == null) return;
    try {
      setPending(true);
      setError(null);
      const res = await csrfFetch('/api/admin/ai-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !status.enabled }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || 'Failed to update AI status');
      }
      setStatus(body as StatusResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status right now.');
    } finally {
      setPending(false);
    }
  };

  const enabled = status?.enabled ?? false;

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0f0f18]/90 p-6 shadow-[0_18px_45px_-24px_rgba(140,122,245,0.35)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/45">Ask AI availability</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {enabled ? 'Assistant is live' : 'Assistant is paused'}
          </h2>
          <p className="text-sm text-white/60">
            Flip the switch to immediately allow or block AI chat usage for everyone.
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={loading || pending}
          className={classNames(
            'relative inline-flex h-12 min-w-[120px] items-center justify-center rounded-full border px-6 text-sm font-semibold transition',
            enabled
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
            (loading || pending) && 'opacity-60'
          )}
        >
          {loading ? 'Loading...' : enabled ? 'Turn off' : 'Turn on'}
        </button>
      </div>
      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
    </section>
  );
}
