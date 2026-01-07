"use client";

import LiveStreamStudio from "@/components/LiveStreamStudio";

export default function DevJoinPanel() {
  return (
    <details className="group rounded-2xl border border-white/10 bg-black/30 p-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-white/80 transition group-open:text-white">
        Dev/Admin fallback (env-based join)
      </summary>
      <p className="mt-3 text-xs text-white/60">
        Legacy join flow for admins only. Uses HMS room codes/auth tokens from
        your local environment.
      </p>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/40">
        <LiveStreamStudio />
      </div>
    </details>
  );
}
