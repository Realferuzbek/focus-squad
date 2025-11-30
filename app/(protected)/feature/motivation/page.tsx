export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { DateTime } from "luxon";
import { MOTIVATION_QUOTES, MOTIVATION_COUNT } from "@/data/motivations";
import Navbar from "@/components/Navbar";
import { getCachedSession } from "@/lib/server-session";
import { getLanguageOptions, getTranslations } from "@/lib/i18n";

const TASHKENT_ZONE = "Asia/Tashkent";
const ANCHOR_DATE_ISO = "2025-01-01";

type RotationSnapshot = {
  dateLabel: string;
  quote: string;
  index: number;
};

function computeRotation(target: DateTime): { index: number; cycle: number } {
  const anchor = DateTime.fromISO(ANCHOR_DATE_ISO, {
    zone: TASHKENT_ZONE,
  }).startOf("day");
  const daysOffset = Math.floor(
    target.startOf("day").diff(anchor, "days").days,
  );
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
  const session = await getCachedSession();
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
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#05030d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#3b2a86,transparent_35%),radial-gradient(circle_at_80%_10%,#9e278a,transparent_30%),radial-gradient(circle_at_40%_80%,#0f6a7b,transparent_28%)] opacity-80" />
      <Navbar
        isAdmin={!!viewer?.is_admin}
        avatarUrl={avatarSrc}
        viewerName={viewer?.name ?? null}
        viewerEmail={viewer?.email ?? null}
        locale={locale}
        translations={t.nav}
        languageOptions={languageOptions}
      />

      <main className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 lg:py-14">
        <header className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_30px_90px_rgba(40,18,88,0.35)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.08),transparent_38%),radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.05),transparent_35%),linear-gradient(140deg,rgba(255,255,255,0.04),transparent_55%)]" />
          <div className="relative grid gap-8 p-8 lg:grid-cols-[1.5fr,1fr] lg:items-start">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-[10px] uppercase tracking-[0.45em] text-indigo-100/80">
                  {t.motivation.heroTag}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                  Asia/Tashkent
                </span>
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                  {t.motivation.heroTitle}
                </h1>
                <p className="max-w-2xl text-base text-white/70 md:text-lg">
                  {t.motivation.heroSubtitle}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_18px_40px_rgba(20,12,70,0.35)]">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-white/45">
                    {t.motivation.dayLabel}
                  </div>
                  <div className="mt-1 text-2xl font-semibold">{dayOfYear}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_18px_40px_rgba(20,12,70,0.35)]">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-white/45">
                    {t.motivation.cycleLabel}
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {cycleInfo.cycle <= 0 ? 1 : cycleInfo.cycle}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_18px_40px_rgba(20,12,70,0.35)]">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-white/45">
                    {t.motivation.totalQuotesLabel}
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {MOTIVATION_COUNT}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-[24px] border border-white/15 bg-white/5 px-6 py-5 text-sm text-white/70 shadow-[0_24px_65px_rgba(20,12,70,0.35)]">
              <div className="text-[11px] uppercase tracking-[0.35em] text-white/60">
                {t.motivation.refreshedLabel}
              </div>
              <div className="text-2xl font-semibold leading-none text-white">
                {timestampLabel}
              </div>
              <p>{now.toFormat("d MMMM yyyy")}</p>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white/60">
                {t.motivation.rotationNote}
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <article className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#120f2b]/90 via-[#0c0b1c]/90 to-[#0c0a16]/90 p-7 shadow-[0_25px_70px_rgba(16,10,60,0.55)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(255,255,255,0.06),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.04),transparent_45%)]" />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.45em] text-fuchsia-100/80">
                {t.motivation.todaysMantra}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-white/80">
                  #{today.index + 1}
                </span>
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-emerald-100">
                  Today
                </span>
              </div>
            </div>
            <p className="relative mt-5 text-2xl font-semibold leading-relaxed text-white md:text-[30px]">
              {today.quote}
            </p>
            <div className="relative mt-6 flex flex-wrap gap-3 text-sm text-white/65">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {today.dateLabel}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {t.motivation.rotatesAtMidnight}
              </span>
            </div>
          </article>

          <aside className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-6 text-sm text-white/75 shadow-[0_20px_65px_rgba(12,10,50,0.45)] backdrop-blur-lg">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/40 to-transparent" />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">
                  {t.motivation.upNext}
                </p>
                <h3 className="text-xl font-semibold text-white">
                  Rotation timeline
                </h3>
              </div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/55">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {t.motivation.dayLabel} {dayOfYear}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {t.motivation.cycleLabel}{" "}
                  {cycleInfo.cycle <= 0 ? 1 : cycleInfo.cycle}
                </span>
              </div>
            </div>

            <div className="relative mt-5 space-y-4">
              {upcoming.map((entry) => (
                <div
                  key={entry.index}
                  className="group rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-[0_16px_40px_rgba(15,10,45,0.4)] transition hover:-translate-y-0.5 hover:border-white/20"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/70 to-fuchsia-500/70 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(114,63,200,0.45)]">
                      #{entry.index + 1}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-white/55">
                        {t.motivation.upNext}
                      </p>
                      <p className="text-base font-semibold text-white">
                        {entry.dateLabel}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/70">
                    {entry.quote}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-white/45">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {t.motivation.rotatesAtMidnight}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-r from-[#0c0f25]/90 to-[#0a0819]/90 p-6 text-sm text-white/75 shadow-[0_18px_55px_rgba(20,12,70,0.35)] md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_40%,rgba(255,255,255,0.08),transparent_38%),radial-gradient(circle_at_90%_20%,rgba(255,255,255,0.05),transparent_35%)]" />
          <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-xl font-semibold text-white">
              {t.motivation.useVaultTitle}
            </h3>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-white/55">
              Ritual guide
            </span>
          </div>
          <ul className="relative mt-5 grid gap-3 md:grid-cols-3">
            {t.motivation.useVaultTips.map((tip, index) => (
              <li
                key={index}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 shadow-[0_14px_40px_rgba(12,8,40,0.35)]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/80 to-cyan-500/80 text-sm font-semibold text-black/70 shadow-[0_10px_25px_rgba(48,203,166,0.45)]">
                  {index + 1}
                </span>
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
