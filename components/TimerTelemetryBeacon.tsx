"use client";

import { useEffect } from "react";

type TimerTelemetryBeaconProps = {
  enabled: boolean;
};

export function TimerTelemetryBeacon({ enabled }: TimerTelemetryBeaconProps) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let cancelled = false;
    const endpoint = "/api/timer/telemetry";

    const send = () => {
      if (cancelled) return;
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        try {
          const blob = new Blob([], { type: "application/json" });
          navigator.sendBeacon(endpoint, blob);
          return;
        } catch {
          // fall through to fetch
        }
      }
      fetch(endpoint, { method: "POST", keepalive: true }).catch(() => {});
    };

    const timeout = window.setTimeout(send, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [enabled]);

  return null;
}

