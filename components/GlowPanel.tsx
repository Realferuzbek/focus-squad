"use client";

import {
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

type GlowPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  className?: string;
  subtle?: boolean;
};

export default function GlowPanel({
  children,
  className = "",
  subtle = false,
  ...rest
}: GlowPanelProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);

  function updatePosition(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const percentX = ((x / rect.width) * 100).toFixed(2);
    const percentY = ((y / rect.height) * 100).toFixed(2);

    if (overlayRef.current) {
      overlayRef.current.style.setProperty("--x", `${x}px`);
      overlayRef.current.style.setProperty("--y", `${y}px`);
    }
    if (haloRef.current) {
      haloRef.current.style.setProperty("--x", `${percentX}%`);
      haloRef.current.style.setProperty("--y", `${percentY}%`);
    }
  }

  function handleEnter() {
    if (overlayRef.current) overlayRef.current.style.opacity = subtle ? "0.9" : "1";
    if (haloRef.current) haloRef.current.style.opacity = "1";
  }

  function handleLeave() {
    if (overlayRef.current) overlayRef.current.style.opacity = "0";
    if (haloRef.current) haloRef.current.style.opacity = subtle ? "0.55" : "0.75";
  }

  const wrapperClassName = useMemo(
    () =>
      [
        "relative overflow-hidden rounded-3xl border border-white/10 bg-[var(--swf-card)] transition duration-300 ease-out",
        subtle ? "shadow-[0_18px_45px_-24px_rgba(140,122,245,0.55)]" : "shadow-[0_25px_80px_-28px_rgba(119,88,247,0.75)] hover:-translate-y-1",
        className,
      ]
        .filter(Boolean)
        .join(" "),
    [className, subtle],
  );

  const glowColor = subtle ? "rgba(139,92,246,0.25)" : "rgba(139,92,246,0.45)";

  return (
    <div
      {...rest}
      onMouseMove={updatePosition}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={wrapperClassName}
    >
      <div
        ref={haloRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-500"
        style={{
          '--x': "50%",
          '--y': "50%",
          background:
            "radial-gradient(420px circle at var(--x, 50%) var(--y, 50%), rgba(139,92,246,0.18), transparent 70%)",
          mixBlendMode: "screen",
        } as CSSProperties}
      />

      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200"
        style={{
          '--x': "50%",
          '--y': "50%",
          background: `radial-gradient(280px circle at var(--x, 50%) var(--y, 50%), ${glowColor}, transparent 70%)`,
          mixBlendMode: "screen",
        } as CSSProperties}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}

