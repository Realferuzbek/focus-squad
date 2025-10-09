"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type LinkTelegramWatcherProps = {
  redirectTo?: string;
  pollMs?: number;
};

export default function LinkTelegramWatcher({
  redirectTo = "/dashboard",
  pollMs = 4000,
}: LinkTelegramWatcherProps) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const res = await fetch("/api/me", {
          method: "GET",
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.linked) {
            router.replace(redirectTo);
            return;
          }
        }
      } catch {
        // ignore network hiccups and retry
      }
      if (active) {
        timerRef.current = setTimeout(poll, pollMs);
      }
    };

    poll();

    return () => {
      active = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [pollMs, redirectTo, router]);

  return null;
}
