'use client';

import { useEffect, useState } from 'react';
import { csrfFetch } from '@/lib/csrf-client';
import AdminAiToggle from './AdminAiToggle';

type ConfettiRunner = typeof import('canvas-confetti');
type ConfettiImport = ConfettiRunner & { default?: ConfettiRunner };
let confettiLauncher: ConfettiRunner | null = null;
async function loadConfetti(): Promise<ConfettiRunner> {
  if (confettiLauncher) return confettiLauncher;
  const mod = (await import('canvas-confetti')) as ConfettiImport;
  const runner = mod.default ?? mod;
  confettiLauncher = runner;
  return runner;
}

export default function ReviewerPanel() {
  const [email, setEmail] = useState('');
  const [data, setData] = useState<any[]>([]);
  const search = async () => {
    const res = await fetch('/api/leaderboard?period=today'); // reuse endpoint to fetch all users + today status quickly
    const rows = await res.json();
    setData(rows);
  };
  useEffect(() => {
    search();
  }, []);
  const mark = async (taskId: string, status: 'completed' | 'not_done') => {
    const res = await csrfFetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status }),
    });
    if (res.ok && status === 'completed') {
      // EFFECT: Loads canvas-confetti on demand so it stays out of the main dashboard bundle.
      const confetti = await loadConfetti();
      confetti({ particleCount: 60, spread: 45, origin: { y: 0.7 } });
    }
  };
  return (
    <div className="space-y-4">
      <AdminAiToggle />
      <div className="flex gap-2">
        <input
          className="bg-[#0f0f13] border border-neutral-800 rounded-xl p-2 focus-ring text-sm"
          placeholder="Filter by email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn-secondary focus-ring" onClick={search}>
          Refresh
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data
          .filter((u) => !email || (u.email ?? '').includes(email))
          .map((u) => (
            <div key={u.email} className="rounded-2xl border border-neutral-800 bg-card p-3">
              <div className="mb-2 font-bold">
                {u.display_name ?? u.email}{' '}
                <span className="text-subtle text-xs">({u.email})</span>
              </div>
              <ul className="space-y-2">
                {(u.todayTasks ?? []).map((t: any) => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <span className="max-w-[70%]">{t.content}</span>
                    <div className="flex gap-2">
                      <button className="btn-secondary focus-ring" onClick={() => mark(t.id, 'completed')}>
                        ✅
                      </button>
                      <button className="btn-secondary focus-ring" onClick={() => mark(t.id, 'not_done')}>
                        ❌
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}
