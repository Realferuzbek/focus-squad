import type { Metadata } from "next";

const TIMER_APP_SRC = "/timer/flip_countdown_new/index.html";

export const metadata: Metadata = {
  title: "Timer",
  description:
    "Focus Squad timer with Pomodoro, short, and long break modes.",
};

export const dynamic = "force-dynamic";

export default function TimerFeaturePage() {
  return (
    <div className="min-h-[100dvh] w-full bg-[#050816]">
      <iframe
        src={TIMER_APP_SRC}
        title="Focus Squad Timer"
        className="block h-[100dvh] min-h-[100dvh] w-full border-0"
        loading="lazy"
        allow="fullscreen"
        allowFullScreen
      />
    </div>
  );
}
