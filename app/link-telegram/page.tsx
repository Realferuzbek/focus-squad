// app/link-telegram/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type LinkResp = { url: string; code: string };

export default function LinkTelegramPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [tgUrl, setTgUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // fetch a fresh token as soon as page loads
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/link', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to get link token');
        const data = (await res.json()) as LinkResp;
        setCode(data.code);
        setTgUrl(data.url);
      } catch (e: any) {
        setError(e.message ?? 'Something went wrong');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // poll "am I linked yet?"
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (j.linked) {
          clearInterval(id);
          router.replace('/dashboard');
        }
      } catch {
        // ignore transient errors
      }
    }, 2000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="max-w-xl mx-auto px-6 py-10 space-y-6">
      <h1 className="text-2xl font-semibold">Almost there — link your Telegram</h1>
      <p className="opacity-80">
        We use Telegram for announcements and live sessions. Tap the button below to connect your account.
      </p>

      <button
        disabled={!tgUrl || loading}
        onClick={() => tgUrl && window.open(tgUrl, '_blank')}
        className="w-full rounded-2xl py-4 text-white font-medium
                   bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90
                   disabled:opacity-60"
      >
        {loading ? 'Preparing…' : 'Link Telegram'}
      </button>

      {code && (
        <p className="text-sm opacity-80">
          If the bot didn’t reply, copy and send in Telegram: <code className="px-2 py-1 bg-black/30 rounded">/link {code}</code>
        </p>
      )}

      {error && <p className="text-red-400">{error}</p>}

      <p className="text-sm opacity-70">This page will auto-redirect once linking succeeds.</p>
    </div>
  );
}
