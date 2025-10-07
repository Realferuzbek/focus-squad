// components/LivePill.tsx
"use client";

import { useEffect, useState } from "react";

type LiveResp = { state: "none" | "scheduled" | "live"; scheduledAt?: string; joinUrl: string };

export default function LivePill() {
  const [d, setD] = useState<LiveResp | null>(null);

  useEffect(() => {
    fetch("/api/live")
      .then((r) => r.json())
      .then((j) => setD(j))
      .catch(() => {});
  }, []);

  if (!d) return null;

  let label = "No live session";
  if (d.state === "live") label = "LIVE now";
  else if (d.state === "scheduled" && d.scheduledAt) label = `Scheduled at ${new Date(d.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <a
      href={d.joinUrl}
      target="_blank"
      rel="noreferrer"
      className={`ml-3 text-xs px-3 py-1.5 rounded-full border transition ${
        d.state === "live"
          ? "border-rose-400 text-rose-300 hover:bg-rose-400/10"
          : "border-white/15 text-gray-300 hover:bg-white/5"
      }`}
    >
      {label}
    </a>
  );
}
