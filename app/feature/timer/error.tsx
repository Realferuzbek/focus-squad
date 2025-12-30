"use client";

import { useEffect } from "react";

type TimerErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function TimerError({ error, reset }: TimerErrorProps) {
  useEffect(() => {
    console.error("[timer] error boundary", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[#050816] text-white">
      <div className="mx-auto max-w-md px-6 text-center">
        <h1 className="text-lg font-semibold">Timer failed to load</h1>
        <p className="mt-2 text-sm text-white/70">
          Something prevented the timer from rendering. Try reloading or retry
          the route.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white hover:border-white/40"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
