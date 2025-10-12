"use client";

import { useEffect } from "react";

const HEARTBEAT_INTERVAL = 45_000;

export default function UsageHeartbeat() {
  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        await fetch("/api/usage/heartbeat", { method: "POST", keepalive: true });
      } catch {
        // ignore, fire-and-forget
      }
    };

    const interval = setInterval(() => {
      if (!cancelled) ping();
    }, HEARTBEAT_INTERVAL);

    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        ping();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    ping();

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
