// components/LanguageSwitcher.tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LanguageOption, Locale } from "@/lib/i18n";
import { csrfFetch } from "@/lib/csrf-client";

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
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 text-2xl transition hover:border-white/50 hover:bg-white/15"
      >
        <span className="sr-only">{label}</span>
        <span aria-hidden="true" className="leading-none">
          {current?.flag}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-14 rounded-3xl border border-white/10 bg-black/80 px-4 py-3 text-white/80 shadow-[0_18px_55px_rgba(0,0,0,0.55)] backdrop-blur">
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
                  className={`flex h-11 w-11 items-center justify-center rounded-full border text-2xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/80 ${
                    isActive
                      ? "border-white/70 bg-white/10 text-white"
                      : "border-transparent bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="sr-only">{option.label}</span>
                  <span aria-hidden="true" className="leading-none">
                    {option.flag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
