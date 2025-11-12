"use client";

import Image from "next/image";
import type { Locale } from "@/lib/i18n";

const FLAG_ASSETS: Record<Locale, string> = {
  en: "/flags/us.svg",
  ru: "/flags/ru.svg",
  uz: "/flags/uz.svg",
};

type FlagIconProps = {
  locale: Locale;
  className?: string;
};

const joinClassNames = (...classes: (string | undefined)[]) =>
  classes.filter(Boolean).join(" ");

export default function FlagIcon({ locale, className }: FlagIconProps) {
  const src = FLAG_ASSETS[locale] ?? FLAG_ASSETS.en;
  return (
    <Image
      src={src}
      alt=""
      role="presentation"
      priority={false}
      loading="lazy"
      draggable={false}
      sizes="(min-width: 0px) 40px"
      fill
      className={joinClassNames("flag-asset", className)}
    />
  );
}
