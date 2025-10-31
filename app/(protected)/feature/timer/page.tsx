"use client";

import { useEffect, useRef } from "react";

import "@/components/timer/vendor/styles.css";
import { mountTimer } from "@/components/timer/vendor/script";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TimerFeature() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return undefined;
    }

    const cleanup = mountTimer(node);
    return typeof cleanup === "function" ? cleanup : undefined;
  }, []);

  return (
    <div className="flex min-h-[100dvh] w-full justify-center bg-black/95 px-4 py-12 text-white">
      <div ref={containerRef} className="vendor-timer-root w-full max-w-[960px]" />
    </div>
  );
}
