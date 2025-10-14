// app/(protected)/dashboard/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import UsageHeartbeat from "@/components/UsageHeartbeat";

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user as any;
  const avatarSrc = user?.avatar_url ?? user?.image ?? null;

  const features = [
    {
      key: "leaderboard",
      title: "Leaderboard",
      description: "Track the top performers and celebrate focus legends.",
      accent: "from-[#a855f7] via-[#6366f1] to-[#22d3ee]",
      icon: "🏆",
    },
    {
      key: "chat",
      title: "Community Chat",
      description: "Drop updates, share wins, and stay accountable together.",
      accent: "from-[#f97316] via-[#fb7185] to-[#a855f7]",
      icon: "💬",
      href: "/community",
    },
    {
      key: "motivation",
      title: "Motivation Vault",
      description: "Daily quotes, mindset hacks, and success stories.",
      accent: "from-[#22d3ee] via-[#2dd4bf] to-[#a855f7]",
      icon: "⚡",
    },
    {
      key: "live",
      title: "Live Stream Studio",
      description: "Join focus rooms and study together in real time.",
      accent: "from-[#f472b6] via-[#ec4899] to-[#a855f7]",
      icon: "📺",
    },
    {
      key: "tasks",
      title: "Task Scheduler",
      description: "Plan lessons, set clusters, and lock in your agenda.",
      accent: "from-[#8b5cf6] via-[#a855f7] to-[#6366f1]",
      icon: "✔️",
    },
    {
      key: "timer",
      title: "Timer",
      description: "Stay locked-in with precision intervals and breaks.",
      accent: "from-[#6366f1] via-[#22d3ee] to-[#0ea5e9]",
      icon: "⏱️",
    },
    {
      key: "linkedin",
      title: "LinkedIn Hub",
      description: "Grow your network, share wins, and connect with peers.",
      accent: "from-[#0a66c2] via-[#2563eb] to-[#60a5fa]",
      icon: "in",
      iconType: "linkedin",
    },
    {
      key: "telegram",
      title: "Telegram Lounge",
      description: "Jump into the Studywithferuzbek group and stay synced.",
      accent: "from-[#38bdf8] via-[#6366f1] to-[#8b5cf6]",
      icon: "✈️",
    },
    {
      key: "youtube",
      title: "YouTube Studio",
      description: "Catch replays, lessons, and behind-the-scenes drops.",
      accent: "from-[#ef4444] via-[#f97316] to-[#fb7185]",
      icon: "▶️",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#07070b]">
      {/* Expose email to client for recent-accounts */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__session_email=${JSON.stringify(user?.email || null)};`,
        }}
      />
      <Navbar isAdmin={!!user.is_admin} avatarUrl={avatarSrc} />

      <main className="mx-auto max-w-6xl px-4 py-8 text-white">
        <section className="mb-10 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#1f1f33] via-[#121225] to-[#0a0a14] p-6 shadow-[0_25px_70px_rgba(104,67,255,0.25)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/20 bg-white/10">
                {avatarSrc ? (
                  <Image
                    src={avatarSrc}
                    alt="Avatar"
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-2xl">🎯</div>
                )}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-fuchsia-300/70">Welcome</p>
                <h1 className="mt-1 text-2xl font-semibold">
                  {session?.user?.name ?? "Focus warrior"}
                </h1>
                <p className="text-sm text-zinc-400">{user?.email}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="rounded-2xl border border-white/20 px-5 py-2 text-sm font-semibold text-white/90 transition hover:border-fuchsia-500/60 hover:text-white">
                View profile
              </button>
              <button className="rounded-2xl bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#ec4899] px-5 py-2 text-sm font-semibold shadow-[0_18px_35px_rgba(138,92,246,0.35)]">
                Settings
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Link
              key={feature.key}
              href={feature.href ?? `/feature/${feature.key}`}
              className="group relative min-h-[160px] overflow-hidden rounded-[26px] border border-white/10 bg-[#0c0c16]/85 p-6 shadow-[0_18px_50px_rgba(12,12,22,0.6)] transition-all duration-200 hover:-translate-y-1 hover:border-white/20"
            >
              <div
                className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br ${feature.accent} mix-blend-screen`}
              />

              <div className="relative flex items-center justify-between">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-3xl shadow-[0_12px_25px_rgba(0,0,0,0.35)]">
                  {feature.iconType === "linkedin" ? (
                    <LinkedInGlyph />
                  ) : (
                    <span>{feature.icon}</span>
                  )}
                </div>
                <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/60">
                  Coming soon
                </span>
              </div>

              <div className="relative mt-6">
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{feature.description}</p>
              </div>
            </Link>
          ))}
        </section>

        <UsageHeartbeat />
      </main>
    </div>
  );
}

function LinkedInGlyph() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a66c2] text-xl font-bold text-white">
      in
    </span>
  );
}
