import type { NextWebVitalsMetric } from "next/app";

// EFFECT: Allows local perf verification without shipping telemetry by default.
export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (process.env.NODE_ENV !== "production") {
    console.info("[web-vitals]", metric);
  }

  // Example: POST to an internal endpoint for ad-hoc profiling.
  // void fetch("/api/internal/web-vitals", {
  //   method: "POST",
  //   keepalive: true,
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(metric),
  // }).catch(() => {});
}
