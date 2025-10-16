"use client";

// Placeholder analytics hook for future integrations
export type LiveAnalyticsEvent =
  | "live_join"
  | "live_leave"
  | "live_send"
  | "live_toggle_notifications"
  | "live_delete";

export function trackLiveEvent(
  event: LiveAnalyticsEvent,
  payload?: Record<string, unknown>,
) {
  void event;
  void payload;
  // no-op for now; reserved for future analytics wiring
}
