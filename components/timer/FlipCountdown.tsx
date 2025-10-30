"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import "@/styles/timer.css";

type TimerStatus = "idle" | "running" | "paused" | "completed";

const DEFAULT_DURATION_SECONDS = 25 * 60;
const ANIMATION_DURATION = 600;

const getTimeParts = (totalSeconds: number) => {
  const clamped = Math.max(totalSeconds, 0);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  return { hours, minutes, seconds };
};

const padTime = (value: number) => value.toString().padStart(2, "0");

type FlipCardProps = {
  value: number;
  label: string;
};

const FlipCard = ({ value, label }: FlipCardProps) => {
  const paddedValue = padTime(value);
  const previousValue = useRef(paddedValue);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (previousValue.current === paddedValue) {
      return;
    }

    setIsFlipping(true);
    const timeout = window.setTimeout(() => {
      previousValue.current = paddedValue;
      setIsFlipping(false);
    }, ANIMATION_DURATION);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [paddedValue]);

  const currentDigits = useMemo(() => paddedValue.split(""), [paddedValue]);
  const previousDigits = previousValue.current.split("");

  return (
    <div className="flip-card" data-label={label}>
      <div className="flip-card__digits">
        {currentDigits.map((digit, index) => {
          const previousDigit = previousDigits[index];
          const shouldFlip = isFlipping && previousDigit !== digit;

          return (
            <div
              key={`${label}-${index}`}
              className={`flip-card__unit${shouldFlip ? " flip" : ""}`}
            >
              <span className="flip-card__top">{previousDigit}</span>
              <span className="flip-card__bottom">{digit}</span>
              <span className="flip-card__back-top">{digit}</span>
              <span className="flip-card__back-bottom">{previousDigit}</span>
            </div>
          );
        })}
      </div>
      <span className="flip-card__label">{label}</span>
    </div>
  );
};

const getStatusLabel = (status: TimerStatus) => {
  switch (status) {
    case "idle":
      return "Ready";
    case "running":
      return "Running";
    case "paused":
      return "Paused";
    case "completed":
      return "Completed";
    default:
      return "";
  }
};

export function FlipCountdown() {
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [status, setStatus] = useState<TimerStatus>("idle");

  const { hours, minutes, seconds } = useMemo(
    () => getTimeParts(remainingSeconds),
    [remainingSeconds]
  );

  useEffect(() => {
    setRemainingSeconds(durationSeconds);
  }, [durationSeconds]);

  useEffect(() => {
    if (status !== "running") {
      return;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds((previous) => {
        if (previous <= 1) {
          window.clearInterval(interval);
          setStatus("completed");
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [status]);

  const handleStart = () => {
    if (status === "running") {
      return;
    }

    if (remainingSeconds === 0) {
      setRemainingSeconds(durationSeconds);
    }

    setStatus("running");
  };

  const handlePause = () => {
    if (status === "running") {
      setStatus("paused");
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setDurationSeconds(DEFAULT_DURATION_SECONDS);
    setRemainingSeconds(DEFAULT_DURATION_SECONDS);
  };

  const handleDurationChange = (event: ChangeEvent<HTMLInputElement>) => {
    const minutes = Number.parseInt(event.target.value, 10);

    if (Number.isNaN(minutes) || minutes < 0) {
      return;
    }

    const nextDuration = Math.min(minutes, 180) * 60;
    setDurationSeconds(nextDuration);
    setStatus("idle");
  };

  const statusLabel = getStatusLabel(status);

  return (
    <section className="timer-root">
      <header className="timer-header">
        <h1 className="timer-title">Flip Countdown</h1>
        <p className="timer-subtitle">Stay focused with a precise visual timer.</p>
      </header>

      <div className="timer-panel">
        <div className="flip-clock">
          <FlipCard value={hours} label="Hours" />
          <FlipCard value={minutes} label="Minutes" />
          <FlipCard value={seconds} label="Seconds" />
        </div>
        <div className="timer-status" aria-live="polite">
          Status: <span>{statusLabel}</span>
        </div>
      </div>

      <div className="timer-controls">
        <label className="timer-input-label">
          Duration (minutes)
          <input
            aria-label="Set timer duration in minutes"
            className="timer-input"
            min={1}
            max={180}
            step={1}
            type="number"
            value={Math.floor(durationSeconds / 60)}
            onChange={handleDurationChange}
            disabled={status === "running"}
          />
        </label>
        <div className="timer-actions">
          <button
            type="button"
            className="timer-button"
            onClick={handleStart}
            disabled={status === "running"}
          >
            Start
          </button>
          <button
            type="button"
            className="timer-button"
            onClick={handlePause}
            disabled={status !== "running"}
          >
            Pause
          </button>
          <button type="button" className="timer-button" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}

export default FlipCountdown;
