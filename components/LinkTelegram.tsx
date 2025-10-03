// components/LinkTelegram.tsx
'use client';
import { useState } from 'react';

export default function LinkTelegram() {
  const [loading, setLoading] = useState(false);

  const link = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/link');
      const { url } = await res.json();
      if (url) window.open(url, '_blank');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="link-telegram" className="p-4 rounded-2xl border border-neutral-800 bg-[#121217]">
      <div className="font-semibold mb-2">Telegram</div>
      <p className="text-sm opacity-80 mb-3">Link your Telegram to get posts and join voice sessions.</p>
      <button onClick={link} disabled={loading} className="btn-primary focus-ring">
        {loading ? 'Preparing…' : 'Link Telegram'}
      </button>
    </div>
  );
}
