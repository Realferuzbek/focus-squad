"use client";

import { useMemo, useRef } from "react";

type GlowPanelProps = {
  children: React.ReactNode;
  className?: string;
};

export default function GlowPanel({ children, className = "" }: GlowPanelProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  function updatePosition(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (!overlayRef.current) return;
    overlayRef.current.style.setProperty("--x", `${x}px`);
    overlayRef.current.style.setProperty("--y", `${y}px`);
  }

  function handleEnter() {
    if (overlayRef.current) {
      overlayRef.current.style.opacity = "1";
    }
  }

  function handleLeave() {
    if (overlayRef.current) {
      overlayRef.current.style.opacity = "0";
    }
  }

  const wrapperClassName = useMemo(
    () =>
      [
        "relative overflow-hidden rounded-3xl border border-white/10 bg-[#11111b]/80 transition-transform",
        className,
      ]
        .filter(Boolean)
        .join(" "),
    [className],
  );

  return (
    <div
      onMouseMove={updatePosition}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={wrapperClassName}
    >
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200"
        style={{
          background:
            "radial-gradient(280px circle at var(--x, 50%) var(--y, 50%), rgba(168,85,247,0.35), transparent 70%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
