const { randomBytes } = require("crypto");

const DEFAULT_SESSION_ID_BYTES = 16;
const DEFAULT_SESSION_ROLLING_INTERVAL_MINUTES = 15;
const MIN_SESSION_ROLLING_INTERVAL_MINUTES = 5;
const MINUTES_TO_MS = 60 * 1000;

function clampRollingIntervalMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SESSION_ROLLING_INTERVAL_MINUTES;
  }
  return Math.max(parsed, MIN_SESSION_ROLLING_INTERVAL_MINUTES);
}

function resolveSessionRollingInterval(envMinutesValue) {
  if (!envMinutesValue)
    return DEFAULT_SESSION_ROLLING_INTERVAL_MINUTES * MINUTES_TO_MS;
  return clampRollingIntervalMinutes(envMinutesValue) * MINUTES_TO_MS;
}

function generateSessionId(byteLength = DEFAULT_SESSION_ID_BYTES) {
  return randomBytes(byteLength).toString("hex");
}

function needsRollingRotation(lastIssuedAt, now, intervalMs) {
  const interval =
    typeof intervalMs === "number" &&
    Number.isFinite(intervalMs) &&
    intervalMs > 0
      ? intervalMs
      : DEFAULT_SESSION_ROLLING_INTERVAL_MINUTES * MINUTES_TO_MS;

  if (
    typeof lastIssuedAt !== "number" ||
    !Number.isFinite(lastIssuedAt) ||
    lastIssuedAt <= 0
  ) {
    return true;
  }

  return now - lastIssuedAt >= interval;
}

module.exports = {
  DEFAULT_SESSION_ID_BYTES,
  DEFAULT_SESSION_ROLLING_INTERVAL_MINUTES,
  MIN_SESSION_ROLLING_INTERVAL_MINUTES,
  MINUTES_TO_MS,
  resolveSessionRollingInterval,
  generateSessionId,
  needsRollingRotation,
};
