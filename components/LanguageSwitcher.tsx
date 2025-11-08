// components/LanguageSwitcher.tsx
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { LanguageOption, Locale } from '@/lib/i18n';
import { csrfFetch } from '@/lib/csrf-client';

type LanguageSwitcherProps = {
  locale: Locale;
  options: LanguageOption[];
  label: string;
};

export default function LanguageSwitcher({ locale, options, label }: LanguageSwitcherProps) {
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
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [open]);

  const handleSelect = (code: Locale) => {
    if (pending) return;
    setOpen(false);
    if (code === locale) return;
    startTransition(async () => {
      try {
        await csrfFetch('/api/preferences/language', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ locale: code }),
        });
      } catch (error) {
        console.error('language switch failed', error);
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
        className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium text-white/80 shadow-[0_10px_25px_rgba(10,10,20,0.35)] transition hover:border-white/40 hover:text-white"
      >
        <span className="text-lg leading-none">{current?.flag}</span>
        <span className="hidden text-xs uppercase tracking-[0.3em] text-white/60 sm:inline">{label}</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-12 min-w-40 rounded-2xl border border-white/15 bg-[#09090f]/95 p-2 text-sm text-white/70 shadow-[0_20px_55px_rgba(0,0,0,0.5)]">
          {options.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => handleSelect(option.code)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/10 hover:text-white ${
                option.code === locale ? 'bg-white/10 text-white' : ''
              }`}
            >
              <span className="text-lg leading-none">{option.flag}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

