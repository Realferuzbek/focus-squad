"use client";

export const dynamic = "force-dynamic";

export default function TimerFeature() {
  return (
    <div className="min-h-[100dvh] w-full bg-[#050816]">
      <iframe
        src="/timer/flip_countdown_new/index.html"
        title="Focus Timer"
        className="block h-[100dvh] min-h-[100dvh] w-full border-0"
        loading="lazy"
        allow="fullscreen"
        allowFullScreen
      />
    </div>
  );
}
