"use client";

import { useEffect, useRef } from "react";

import { mountTimer } from "./vendor/script";

const STYLE_HREF = "/timer/flip_countdown_new/styles.css";
const STYLE_DATA_ATTR = "data-focus-squad-timer-style";

function ensureStylesheet(): () => void {
  if (typeof document === "undefined") {
    return () => undefined;
  }

  const existing = document.head.querySelector<HTMLLinkElement>(
    `link[${STYLE_DATA_ATTR}]`,
  );
  if (existing) {
    existing.dataset.timerMountCount = String(
      Number(existing.dataset.timerMountCount ?? "1") + 1,
    );
    return () => {
      const current = document.head.querySelector<HTMLLinkElement>(
        `link[${STYLE_DATA_ATTR}]`,
      );
      if (!current) return;
      const nextCount = Number(current.dataset.timerMountCount ?? "1") - 1;
      if (nextCount <= 0) {
        current.remove();
      } else {
        current.dataset.timerMountCount = String(nextCount);
      }
    };
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLE_HREF;
  link.setAttribute(STYLE_DATA_ATTR, "true");
  link.dataset.timerMountCount = "1";
  document.head.appendChild(link);

  return () => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
  };
}

export function TimerExperience() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const removeStylesheet = ensureStylesheet();
    return () => {
      removeStylesheet();
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const teardown = mountTimer(container);
    return () => {
      if (typeof teardown === "function") {
        teardown();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="vendor-timer-root min-h-[100dvh] bg-[#050816] text-slate-100"
    />
  );
}

export default TimerExperience;
