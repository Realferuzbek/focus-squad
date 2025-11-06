import type { Metadata } from "next";

import TimerExperience from "@/components/timer/TimerExperience";

export const metadata: Metadata = {
  title: "Timer",
  description:
    "Focus Squad timer with Pomodoro, short, and long break modes.",
};

export const dynamic = "force-dynamic";

export default function TimerFeaturePage() {
  return (
    <main className="min-h-[100dvh] w-full bg-[#050816]">
      <TimerExperience />
    </main>
  );
}
