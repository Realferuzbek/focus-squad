"use client";

import type { Locale } from "@/lib/i18n";

type FlagIconProps = {
  locale: Locale;
  className?: string;
};

type InternalFlagProps = {
  className?: string;
};

const FLAG_BASE_CLASS =
  "drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)] rounded-full";

const joinClassNames = (...classes: (string | undefined)[]) =>
  classes.filter(Boolean).join(" ");

const stripeHeight = 48 / 13;
const unionHeight = stripeHeight * 7;
const unionWidth = 28;

const US_STRIPES = Array.from({ length: 13 }, (_, index) => (
  <rect
    key={`stripe-${index}`}
    width="64"
    height={stripeHeight}
    y={index * stripeHeight}
    fill={index % 2 === 0 ? "#B22234" : "#fff"}
  />
));

const US_STAR_ROWS = Array.from({ length: 9 }, (_, rowIndex) => ({
  count: rowIndex % 2 === 0 ? 6 : 5,
  y: 3 + rowIndex * (unionHeight / 9),
  offset: rowIndex % 2 === 0 ? 2.5 : 4.6,
}));

const US_STARS = US_STAR_ROWS.flatMap((row, rowIndex) =>
  Array.from({ length: row.count }, (_, colIndex) => (
    <circle
      key={`star-${rowIndex}-${colIndex}`}
      cx={row.offset + colIndex * 4}
      cy={row.y}
      r={0.7}
      fill="#fff"
    />
  ))
);

const UZ_STAR_ROWS = [6, 10, 14];

const UZ_STARS = UZ_STAR_ROWS.flatMap((y, rowIndex) =>
  Array.from({ length: 4 }, (_, colIndex) => (
    <circle
      key={`uz-star-${rowIndex}-${colIndex}`}
      cx={24 + colIndex * 5}
      cy={y}
      r={1}
      fill="#fff"
    />
  ))
);

function FlagUS({ className }: InternalFlagProps) {
  return (
    <svg
      viewBox="0 0 64 48"
      aria-hidden="true"
      focusable="false"
      className={joinClassNames(FLAG_BASE_CLASS, className ?? "h-6 w-6")}
    >
      <rect width="64" height="48" fill="#fff" rx="12" />
      {US_STRIPES}
      <rect width={unionWidth} height={unionHeight} fill="#0A3161" rx="6" />
      <g>{US_STARS}</g>
    </svg>
  );
}

function FlagRU({ className }: InternalFlagProps) {
  return (
    <svg
      viewBox="0 0 64 48"
      aria-hidden="true"
      focusable="false"
      className={joinClassNames(FLAG_BASE_CLASS, className ?? "h-6 w-6")}
    >
      <rect width="64" height="48" fill="#fff" rx="12" />
      <rect y="16" width="64" height="16" fill="#0C57A7" />
      <rect y="32" width="64" height="16" fill="#BE1E2D" />
    </svg>
  );
}

function FlagUZ({ className }: InternalFlagProps) {
  return (
    <svg
      viewBox="0 0 64 48"
      aria-hidden="true"
      focusable="false"
      className={joinClassNames(FLAG_BASE_CLASS, className ?? "h-6 w-6")}
    >
      <rect width="64" height="48" fill="#009FC6" rx="12" />
      <rect y="16" width="64" height="16" fill="#fff" />
      <rect y="32" width="64" height="16" fill="#1BA64B" />
      <rect y="15" width="64" height="2" fill="#D81E34" />
      <rect y="31" width="64" height="2" fill="#D81E34" />
      <circle cx="14" cy="12" r="6" fill="#fff" />
      <circle cx="12.2" cy="12" r="4.5" fill="#009FC6" />
      {UZ_STARS}
    </svg>
  );
}

export default function FlagIcon({ locale, className }: FlagIconProps) {
  if (locale === "ru") {
    return <FlagRU className={className} />;
  }
  if (locale === "uz") {
    return <FlagUZ className={className} />;
  }
  return <FlagUS className={className} />;
}
