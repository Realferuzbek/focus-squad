// components/LanguageSwitcher.tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LanguageOption, Locale } from "@/lib/i18n";
import { csrfFetch } from "@/lib/csrf-client";
import FlagIcon from "./FlagIcon";

type LanguageSwitcherProps = {
  locale: Locale;
  options: LanguageOption[];
  label: string;
};

export default function LanguageSwitcher({
  locale,
  options,
  label,
}: LanguageSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const current = options.find((opt) => opt.code === locale) ?? options[0];

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [open]);

  const handleSelect = (code: Locale) => {
    if (pending) return;
    setOpen(false);
    if (code === locale) return;
    startTransition(async () => {
      try {
        await csrfFetch("/api/preferences/language", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ locale: code }),
        });
      } catch (error) {
        console.error("language switch failed", error);
      } finally {
        router.refresh();
      }
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-gradient-to-b from-white/30 to-white/5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 hover:border-white/70 hover:bg-white/10"
      >
        <span className="sr-only">{label}</span>
        <FlagIcon locale={current?.code ?? locale} className="h-7 w-7" />
      </button>

      {open ? (
        <div className="absolute right-0 top-14 rounded-3xl border border-white/10 bg-black/80 px-4 py-3 text-white/80 shadow-[0_18px_55px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="flex gap-3">
            {options.map((option) => {
              const isActive = option.code === locale;
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => handleSelect(option.code)}
                  aria-label={option.label}
                  title={option.label}
                  className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 ${
                    isActive
                      ? "border-white/80 bg-white/15 text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
                      : "border-white/10 bg-white/5 text-white/70 hover:border-white/40 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="sr-only">{option.label}</span>
                  <FlagIcon
                    locale={option.code}
                    className={isActive ? "h-7 w-7" : "h-6 w-6 opacity-80"}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
