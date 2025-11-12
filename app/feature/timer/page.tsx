import type { Metadata } from "next";
import { TimerTelemetryBeacon } from "@/components/TimerTelemetryBeacon";

const TIMER_APP_SRC = "/timer/flip_countdown_new/index.html";
const TIMER_TELEMETRY_ENABLED =
  (process.env.ENABLE_TIMER_TELEMETRY ?? "1").trim() !== "0";

export const metadata: Metadata = {
  title: "Timer",
  description:
    "Focus Squad timer with Pomodoro, short, and long break modes.",
};

export const dynamic = "force-static";

export default function TimerFeaturePage() {
  return (
    <div className="min-h-[100dvh] w-full bg-[#050816]">
      <TimerTelemetryBeacon enabled={TIMER_TELEMETRY_ENABLED} />
      <iframe
        src={TIMER_APP_SRC}
        title="Focus Squad Timer"
        className="block h-[100dvh] min-h-[100dvh] w-full border-0"
        // EFFECT: Prioritize the embedded timer so it becomes the LCP element faster.
        fetchPriority="high"
        importance="high"
        allow="fullscreen"
        allowFullScreen
      />
    </div>
  );
}
