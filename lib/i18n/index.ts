import { cookies } from 'next/headers';

import {
  LOCALE_DEFAULT,
  LOCALE_FLAGS,
  TRANSLATIONS,
  type Locale,
  type Translations,
  type FeatureKey,
  isLocale,
} from './locales';

export type { Locale, Translations, FeatureKey };

export interface LanguageOption {
  code: Locale;
  label: string;
  flag: string;
}

export function resolveLocale(value?: string | null): Locale {
  if (isLocale(value)) return value;
  return LOCALE_DEFAULT;
}

export function getTranslations(): { locale: Locale; t: Translations } {
  const cookieLocale = cookies().get('lang')?.value;
  const locale = resolveLocale(cookieLocale);
  return { locale, t: TRANSLATIONS[locale] };
}

export function getLanguageOptions(locale: Locale): LanguageOption[] {
  const base = TRANSLATIONS[locale].nav.languages;
  return (Object.keys(TRANSLATIONS) as Locale[]).map((code) => ({
    code,
    label: base[code] ?? code,
    flag: LOCALE_FLAGS[code],
  }));
}

