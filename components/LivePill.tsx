'use client';
import { useEffect, useState } from 'react';

type Live = { state: 'none'|'scheduled'|'live'; scheduledAt?: string|null; joinUrl?: string };

export default function LivePill() {
  const [live, setLive] = useState<Live>({ state: 'none' });
  useEffect(() => {
    let alive = true;
    const fetchLive = async () => {
      const res = await fetch('/api/live', { cache: 'no-store' });
      const data = await res.json();
      if (alive) setLive(data);
    };
    fetchLive();
    const t = setInterval(fetchLive, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const base = 'pill focus-ring';
  if (live.state === 'live') {
    return (
      <a href={live.joinUrl} className={`${base} border-red-500`} aria-label="Live now">
        <span className="relative">
          <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
        </span>
        LIVE NOW
      </a>
    );
  }
  if (live.state === 'scheduled' && live.scheduledAt) {
    return <a href={live.joinUrl} className={base} aria-label="Live scheduled">Scheduled at {new Date(live.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</a>;
  }
  return <span className={base} aria-label="No live stream">No live stream</span>;
}
