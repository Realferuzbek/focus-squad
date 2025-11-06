export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { DateTime } from "luxon";
import { MOTIVATION_QUOTES, MOTIVATION_COUNT } from "@/data/motivations";
import Navbar from "@/components/Navbar";
import { auth } from "@/lib/auth";
import { getLanguageOptions, getTranslations } from "@/lib/i18n";

const TASHKENT_ZONE = "Asia/Tashkent";
const ANCHOR_DATE_ISO = "2025-01-01";

type RotationSnapshot = {
  dateLabel: string;
  quote: string;
  index: number;
};

function computeRotation(target: DateTime): { index: number; cycle: number } {
  const anchor = DateTime.fromISO(ANCHOR_DATE_ISO, { zone: TASHKENT_ZONE }).startOf("day");
  const daysOffset = Math.floor(target.startOf("day").diff(anchor, "days").days);
  const normalized =
    ((daysOffset % MOTIVATION_COUNT) + MOTIVATION_COUNT) % MOTIVATION_COUNT;
  const cycle = Math.floor(daysOffset / MOTIVATION_COUNT) + 1;
  return { index: normalized, cycle };
}

function buildSnapshot(target: DateTime): RotationSnapshot {
  const { index } = computeRotation(target);
  const quote = MOTIVATION_QUOTES[index];
  const dateLabel = target.toFormat("cccc, d LLLL");
  return { dateLabel, quote, index };
}

export default async function MotivationVaultFeature() {
  const session = await auth();
  const viewer = session?.user as any;
  const avatarSrc = viewer?.avatar_url ?? viewer?.image ?? null;

  const { locale, t } = getTranslations();
  const languageOptions = getLanguageOptions(locale);

  const now = DateTime.now().setZone(TASHKENT_ZONE);
  const today = buildSnapshot(now);
  const cycleInfo = computeRotation(now);
  const dayOfYear = now.ordinal;

  const tomorrow = buildSnapshot(now.plus({ days: 1 }));
  const theDayAfter = buildSnapshot(now.plus({ days: 2 }));
  const upcoming = [tomorrow, theDayAfter];

  const timestampLabel = now.toFormat("HH:mm · z");

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#06040f] via-[#130b2c] to-[#05030b] text-white">
      <Navbar
        isAdmin={!!viewer?.is_admin}
        avatarUrl={avatarSrc}
        locale={locale}
        translations={t.nav}
        languageOptions={languageOptions}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
        <header className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,#8b5cf610,transparent_70%)] p-8 shadow-[0_30px_90px_rgba(64,36,148,0.35)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.45em] text-white/60">
                {t.motivation.heroTag}
              </span>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t.motivation.heroTitle}</h1>
              <p className="max-w-xl text-sm text-white/70 md:text-base">{t.motivation.heroSubtitle}</p>
              <dl className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.3em] text-white/45">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <dt>{t.motivation.dayLabel}</dt>
                  <dd className="font-semibold text-white/70">{dayOfYear}</dd>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <dt>{t.motivation.cycleLabel}</dt>
                  <dd className="font-semibold text-white/70">{cycleInfo.cycle <= 0 ? 1 : cycleInfo.cycle}</dd>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <dt>{t.motivation.totalQuotesLabel}</dt>
                  <dd className="font-semibold text-white/70">{MOTIVATION_COUNT}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
              <p className="font-semibold tracking-[0.3em] text-white/70">{t.motivation.refreshedLabel}</p>
              <p>{timestampLabel}</p>
              <p>{now.toFormat("d MMMM yyyy")}</p>
              <p className="mt-2 text-white/40">{t.motivation.rotationNote}</p>
            </div>
          </div>

          <blockquote className="mt-10 rounded-[26px] border border-white/10 bg-white/5/40 p-6 text-left shadow-[0_25px_70px_rgba(30,13,88,0.45)] md:p-8">
            <div className="text-xs uppercase tracking-[0.4em] text-fuchsia-200/80">{t.motivation.todaysMantra}</div>
            <p className="mt-4 text-2xl font-medium leading-relaxed text-white md:text-[28px]">
              {today.quote}
            </p>
            <footer className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/50">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.35em]">
                #{today.index + 1}
              </span>
              <span>{today.dateLabel}</span>
            </footer>
          </blockquote>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {upcoming.map((entry) => (
            <article
              key={entry.index}
              className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top,#1b1033,transparent_65%)] p-6 shadow-[0_20px_60px_rgba(24,12,72,0.35)] transition hover:-translate-y-1 hover:border-white/20"
            >
              <div className="text-xs uppercase tracking-[0.4em] text-white/45">{t.motivation.upNext}</div>
              <h2 className="mt-2 text-lg font-semibold text-white/85">{entry.dateLabel}</h2>
              <p className="mt-4 text-sm leading-relaxed text-white/70">{entry.quote}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-xs text-white/40">
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.35em]">
                  #{entry.index + 1}
                </span>
                {t.motivation.rotatesAtMidnight}
              </span>
            </article>
          ))}
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/5/10 p-6 text-sm text-white/70 shadow-[0_18px_55px_rgba(30,13,88,0.25)] md:p-8">
          <h3 className="text-xl font-semibold text-white">{t.motivation.useVaultTitle}</h3>
          <ul className="mt-4 space-y-3 text-white/65">
            {t.motivation.useVaultTips.map((tip, index) => (
              <li key={index}>• {tip}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
