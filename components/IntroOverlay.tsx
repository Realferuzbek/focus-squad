'use client';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const lines = [
  '✨ Welcome to our Study With Me family!',
  'Here, you’ll finally escape distractions, stay consistent, and push yourself together with peers who are chasing the same goals.',
  '📚 Every day we study live, track our focus time, and grow step by step.',
  '🏆 Your effort counts — see your name rise on the leaderboard, celebrate wins, and get inspired by others.',
  '🔥 This isn’t just a group, it’s your virtual library of focus and motivation.'
];

export default function IntroOverlay({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState(true);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const advance = () => setIdx((i) => Math.min(i + 1, lines.length));
    const t = setInterval(advance, 1800); // ~1.8s between lines
    return () => clearInterval(t);
  }, []);

  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card max-w-[600px] w-[90%] rounded-2xl p-6 shadow-soft relative">
        <button className="absolute right-4 top-3 text-subtle text-sm underline focus-ring" onClick={() => { setShow(false); onDone(); }}>
          Skip intro
        </button>
        <h1 className="text-2xl font-bold mb-4">Welcome to the Focus Squad 🚀</h1>
        <div className="space-y-3 text-[16px]">
          {lines.slice(0, idx).map((l, i) => (
            <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              {l}
            </motion.p>
          ))}
        </div>
        <div className="mt-6">
          <button className="btn-primary focus-ring" onClick={() => { setShow(false); onDone(); }}>
            Got it, let’s start
          </button>
        </div>
      </div>
    </div>
  );
}
