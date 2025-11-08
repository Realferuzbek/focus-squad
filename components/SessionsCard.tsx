'use client';
import { useCallback, useEffect, useState } from 'react';
import { csrfFetch } from '@/lib/csrf-client';

type Slot = { index: number; start: string; end: string; label: string | null; note: string; locked: boolean };
export default function SessionsCard() {
  const [date] = useState<string>(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  const load = useCallback(async (d = date) => {
    const r = await fetch(`/api/slots?date=${d}`, { cache: 'no-store' });
    const data = await r.json();
    setSlots(data.blocks ?? []);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  async function save(idx: number, note: string) {
    setSaving(idx);
    const r = await csrfFetch('/api/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, index: idx, note })
    });
    setSaving(null);
    if (!r.ok) alert('Could not save');
  }

  async function copyYesterday() {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const r = await fetch(`/api/slots?date=${yesterday}`, { cache: 'no-store' });
    const data = await r.json();
    const prev: Slot[] = data.blocks ?? [];
    setSlots((curr) =>
      curr.map((s, i) => (s.note.trim() ? s : { ...s, note: (prev[i]?.note ?? '') }))
    );
  }

  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Today’s sessions</h2>
        <button className="btn-secondary focus-ring text-xs" onClick={copyYesterday}>Copy yesterday</button>
      </div>
      <div className="mt-3 space-y-3">
        {slots.length === 0 && <div className="text-subtle text-sm">No sessions configured for today.</div>}
        {slots.map((s) => (
          <div key={s.index} className="border border-neutral-800 rounded-xl p-3">
            <div className="text-sm mb-2">
              {s.label ? <strong>{s.label}</strong> : <strong>Session {s.index + 1}</strong>} · {s.start}–{s.end}
              {s.locked && <span className="ml-2 text-xs pill">Locked</span>}
            </div>
            <textarea
              className="w-full h-20 rounded-xl bg-[#0f0f13] p-3 border border-neutral-800 focus-ring text-sm"
              placeholder="What will you study in this window?"
              value={s.note}
              onChange={(e) => setSlots((arr) => arr.map((x) => (x.index === s.index ? { ...x, note: e.target.value } : x)))}
              disabled={s.locked}
            />
            <div className="mt-2">
              <button
                className="btn-secondary focus-ring text-xs"
                onClick={() => save(s.index, s.note)}
                disabled={s.locked || saving === s.index}
              >
                {saving === s.index ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
