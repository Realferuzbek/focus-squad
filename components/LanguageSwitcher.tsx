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
        className="flag flag--l is-selected"
      >
        <span className="sr-only">{label}</span>
        <span className="flag-shell" aria-hidden="true">
          <FlagIcon locale={current?.code ?? locale} />
          <span aria-hidden="true" className="flag-sheen" />
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-14 rounded-3xl border border-white/10 bg-black/80 px-4 py-3 text-white/80 shadow-[0_18px_55px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {options.map((option) => {
              const isActive = option.code === locale;
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => handleSelect(option.code)}
                  aria-label={option.label}
                  aria-current={isActive ? "true" : undefined}
                  title={option.label}
                  disabled={pending}
                  className={`flag flag--m${isActive ? " is-selected" : ""}`}
                >
                  <span className="sr-only">{option.label}</span>
                  <span className="flag-shell" aria-hidden="true">
                    <FlagIcon locale={option.code} />
                    <span aria-hidden="true" className="flag-sheen" />
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
