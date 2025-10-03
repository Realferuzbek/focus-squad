'use client';

import Navbar from '@/components/Navbar';
import IntroOverlay from '@/components/IntroOverlay';
import TaskInput from '@/components/TaskInput';
import SessionsCard from '@/components/SessionsCard';
import ProgressCard from '@/components/ProgressCard';
import StreakCard from '@/components/StreakCard';
import HistoryCard from '@/components/HistoryCard';
import LinkTelegram from '@/components/LinkTelegram';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { channelName } from '@/lib/broadcast';

export default function Dashboard() {
  const [showIntro, setShowIntro] = useState(false);
  const [locked, setLocked] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [streak, setStreak] = useState(0);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);

    const res = await fetch('/api/tasks?date=' + today);
    const rows = await res.json();
    const total = rows.length;
    const completed = rows.filter((r: any) => r.status === 'completed').length;
    setProgress({ completed, total });

    const sr = await fetch('/api/leaderboard?period=today');
    const me = (await sr.json()).find((x: any) => x.isMe);
    setStreak(me?.streak ?? 0);

    const now = new Date();
    setLocked(now.getHours() > 10 || (now.getHours() === 10 && now.getMinutes() >= 0));
  };

  useEffect(() => {
    const seen = localStorage.getItem('fs.intro.seen');
    if (!seen) setShowIntro(true);
    load();

    const channel = supabaseBrowser.channel(channelName);
    channel
      .on('broadcast', { event: 'task_reviewed' }, load)
      .on('broadcast', { event: 'streak_updated' }, load)
      .on('broadcast', { event: 'live_status' }, () => {})
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      <Navbar />
      <main className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          <TaskInput locked={locked} onSubmitted={load} />
          <LinkTelegram />
          <SessionsCard />
          <ProgressCard completed={progress.completed} total={progress.total} />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <StreakCard streak={streak} />
          <HistoryCard />
        </div>
      </main>

      {showIntro && (
        <IntroOverlay
          onDone={() => {
            localStorage.setItem('fs.intro.seen', '1');
            location.href = '/dashboard#link-telegram';
          }}
        />
      )}
    </div>
  );
}
