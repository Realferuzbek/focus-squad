'use client';
import { useEffect, useState } from 'react';

export default function TaskInput({ locked, onSubmitted }: { locked: boolean; onSubmitted: () => void }) {
  const [value, setValue] = useState('');
  const submit = async () => {
    if (!value.trim()) return;
    const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: value }) });
    if (res.status === 403) { alert('🔒 Task entry closed for today.'); return; }
    if (!res.ok) { alert('Error saving tasks'); return; }
    setValue('');
    onSubmitted();
  };
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft">
      <h2 className="font-bold mb-2">Today’s plan</h2>
      {locked ? (
        <div className="text-subtle text-sm">🔒 Task entry closed for today.</div>
      ) : (
        <>
          <textarea
            className="w-full h-32 rounded-xl bg-[#0f0f13] p-3 border border-neutral-800 focus-ring"
            placeholder="✍️ What will you accomplish today?"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="mt-3">
            <button onClick={submit} className="btn-primary focus-ring">Save tasks</button>
          </div>
        </>
      )}
    </div>
  );
}
