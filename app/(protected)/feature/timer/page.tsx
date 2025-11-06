"use client";
import { useEffect, useRef } from "react";
import "@/components/timer/vendor/styles.css";
import { mountTimer } from "@/components/timer/vendor/script";

export const dynamic = "force-dynamic";

export default function TimerFeature() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    return mountTimer(node);
  }, []);
  // full-bleed; vendor CSS controls layout/background
  return <div ref={ref} className="min-h-[100dvh] w-full" />;
}
