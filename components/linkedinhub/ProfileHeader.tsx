'use client';

import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import { motion } from "framer-motion";
import GlowPanel from "@/components/GlowPanel";

type ProfileHeaderProps = {
  name: string;
  headline?: string | null;
  avatarUrl?: string | null;
  followers?: string | null;
};

export default function ProfileHeader({
  name,
  headline,
  avatarUrl,
  followers,
}: ProfileHeaderProps) {
  const gradientRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (gradientRef.current) {
      gradientRef.current.style.setProperty("--x", `${x}%`);
      gradientRef.current.style.setProperty("--y", `${y}%`);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <GlowPanel
        subtle
        className="relative overflow-hidden p-6 md:p-8"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          if (gradientRef.current) {
            gradientRef.current.style.setProperty("--x", "50%");
            gradientRef.current.style.setProperty("--y", "50%");
          }
        }}
      >
        <div
          ref={gradientRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 transition duration-500"
          style={{
            '--x': "50%",
            '--y': "50%",
            background:
              "radial-gradient(420px circle at var(--x, 50%) var(--y, 50%), rgba(139,92,246,0.22), transparent 70%)",
            mixBlendMode: "screen",
          } as CSSProperties}
        />

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-[0_12px_30px_rgba(8,8,20,0.6)]">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={name} fill sizes="80px" className="object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-2xl">👤</div>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight text-white">{name}</h2>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100/80">
                Admin
              </span>
            </div>
            {headline && <p className="text-sm text-white/65">{headline}</p>}
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.28em] text-white/40">
              <span>Focus Squad</span>
              {followers && (
                <>
                  <span className="text-white/20">•</span>
                  <span>{followers}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </GlowPanel>
    </motion.div>
  );
}

