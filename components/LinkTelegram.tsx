// components/LinkTelegram.tsx
'use client';
import { useState } from 'react';

export default function LinkTelegram() {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/link', { headers: { accept: 'application/json' } });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url; // opens Telegram
      } else {
        alert('Could not prepare Telegram link. Please sign out/in and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={onClick} disabled={loading} className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white">
      {loading ? 'Preparing…' : 'Link Telegram'}
    </button>
  );
}
