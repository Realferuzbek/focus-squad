import type { Metadata } from "next";
import { headers } from "next/headers";

const TIMER_APP_SRC = "/timer/flip_countdown_new/index.html";
const TIMER_TELEMETRY_ENABLED =
  (process.env.ENABLE_TIMER_TELEMETRY ?? "1").trim() !== "0";

export const metadata: Metadata = {
  title: "Timer",
  description:
    "Focus Squad timer with Pomodoro, short, and long break modes.",
};

export const dynamic = "force-dynamic";

async function emitTimerTelemetry() {
  if (!TIMER_TELEMETRY_ENABLED) return;
  const requestHeaders = headers();
  const forwardedFor =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = requestHeaders.get("user-agent") ?? null;
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const host = requestHeaders.get("host");

  const resolvedTimerUrl =
    host != null
      ? `${proto}://${host}${TIMER_APP_SRC}`
      : process.env.NEXT_PUBLIC_SITE_URL
        ? new URL(TIMER_APP_SRC, process.env.NEXT_PUBLIC_SITE_URL).toString()
        : null;

  if (!resolvedTimerUrl) {
    console.warn("[timer-telemetry] skipped, timer URL could not be resolved", {
      forwardedFor,
      userAgent,
    });
    return;
  }

  try {
    const probe = await fetch(resolvedTimerUrl, {
      method: "HEAD",
      cache: "no-store",
      redirect: "follow",
    });
    console.info("[timer-telemetry] embed probe ok", {
      url: resolvedTimerUrl,
      status: probe.status,
      xFrameOptions: probe.headers.get("x-frame-options"),
      csp: probe.headers.get("content-security-policy"),
      vercelId: probe.headers.get("x-vercel-id"),
      forwardedFor,
      userAgent,
    });
  } catch (error) {
    console.error("[timer-telemetry] embed probe failed", {
      url: resolvedTimerUrl,
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error,
      forwardedFor,
      userAgent,
    });
  }
}

export default async function TimerFeaturePage() {
  await emitTimerTelemetry();

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
