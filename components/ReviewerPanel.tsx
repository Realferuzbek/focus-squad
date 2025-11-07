'use client';
import confetti from 'canvas-confetti';
import { useEffect, useState } from 'react';
import AdminAiToggle from './AdminAiToggle';

export default function ReviewerPanel() {
  const [email, setEmail] = useState('');
  const [data, setData] = useState<any[]>([]);
  const search = async () => {
    const res = await fetch('/api/leaderboard?period=today'); // reuse endpoint to fetch all users + today status quickly
    const rows = await res.json();
    setData(rows);
  };
  useEffect(()=>{ search(); }, []);
  const mark = async (taskId: string, status: 'completed'|'not_done') => {
    const res = await fetch('/api/review', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ taskId, status }) });
    if (res.ok && status==='completed') confetti({ particleCount: 60, spread: 45, origin: { y: 0.7 } });
  };
  return (
    <div className="space-y-4">
      <AdminAiToggle />
      <div className="flex gap-2">
        <input className="bg-[#0f0f13] border border-neutral-800 rounded-xl p-2 focus-ring text-sm" placeholder="Filter by email (optional)" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <button className="btn-secondary focus-ring" onClick={search}>Refresh</button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {data.filter(u => !email || (u.email ?? '').includes(email)).map((u) => (
          <div key={u.email} className="bg-card rounded-2xl p-3 border border-neutral-800">
            <div className="font-bold mb-2">{u.display_name ?? u.email} <span className="text-subtle text-xs">({u.email})</span></div>
            <ul className="space-y-2">
              {(u.todayTasks ?? []).map((t:any)=>(
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="max-w-[70%]">{t.content}</span>
                  <div className="flex gap-2">
                    <button className="btn-secondary focus-ring" onClick={()=>mark(t.id,'completed')}>✅</button>
                    <button className="btn-secondary focus-ring" onClick={()=>mark(t.id,'not_done')}>❌</button>
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
