import type { Metadata } from "next";
import { TimerTelemetryBeacon } from "@/components/TimerTelemetryBeacon";
import { TimerChunkRecovery } from "@/components/timer/TimerChunkRecovery";
import { TimerFrame } from "@/components/timer/TimerFrame";

const TIMER_TELEMETRY_ENABLED =
  (process.env.ENABLE_TIMER_TELEMETRY ?? "1").trim() !== "0";

// NOTE: This page frames a same-origin static HTML timer. If security headers omit the
// allowIframe override (e.g., middleware matcher skipping /timer/flip_countdown_new),
// browsers will block the iframe with X-Frame-Options/frame-ancestors errors.
export const metadata: Metadata = {
  title: "Timer",
  description: "Focus Squad timer with Pomodoro, short, and long break modes.",
};

export const dynamic = "force-static";

export default function TimerFeaturePage() {
  return (
    <>
      <TimerTelemetryBeacon enabled={TIMER_TELEMETRY_ENABLED} />
      <TimerChunkRecovery />
      <TimerFrame />
    </>
  );
}
