export declare const DEFAULT_SESSION_ID_BYTES: number;
export declare const DEFAULT_SESSION_ROLLING_INTERVAL_MINUTES: number;
export declare const MIN_SESSION_ROLLING_INTERVAL_MINUTES: number;
export declare const MINUTES_TO_MS: number;
export declare function resolveSessionRollingInterval(
  envMinutesValue?: string | number | null,
): number;
export declare function generateSessionId(byteLength?: number): string;
export declare function needsRollingRotation(
  lastIssuedAt: number | null | undefined,
  now: number,
  intervalMs?: number,
): boolean;
