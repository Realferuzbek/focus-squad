export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import GlowPanel from "@/components/GlowPanel";
import LiveStreamCard from "@/components/community/LiveStreamCard";

const upcomingCards = [
  {
    title: "Groups Chat",
    description: "Spin up micro-communities to tackle shared goals together.",
    tag: "Soon",
  },
  {
    title: "Anonymous Chat",
    description: "Share candid updates and feedback—no names attached.",
    tag: "Soon",
  },
];

export default function CommunityPage() {
  return (
    <div className="min-h-[100dvh] bg-[#07070b] px-4 py-12 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="space-y-3">
          <span className="pill">Community</span>
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            Stay connected with the squad
          </h1>
          <p className="max-w-2xl text-base text-white/60">
            Tap into the collective energy. Jump into admin chat for direct support,
            and explore the spaces we&apos;re crafting for focused collaboration.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/community/admin"
            className="group block rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <GlowPanel
              subtle
              className="h-full p-6 transition-transform duration-200 group-hover:scale-[1.01] md:p-8"
            >
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="space-y-3">
                  <span className="pill">Live</span>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">
                    Admin Chat
                  </h2>
                  <p className="text-sm text-white/65">
                    Direct line to the team. Get help, share wins, and stay aligned.
                  </p>
                </div>
                <span className="btn-primary w-fit px-6">Open</span>
              </div>
            </GlowPanel>
          </Link>

          <LiveStreamCard />

          {upcomingCards.map((card) => (
            <GlowPanel key={card.title} subtle className="p-6 md:p-8">
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="space-y-3">
                  <span className="pill">{card.tag}</span>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">
                    {card.title}
                  </h2>
                  <p className="text-sm text-white/65">{card.description}</p>
                </div>
                <span className="btn-primary w-fit cursor-not-allowed px-6 opacity-60">
                  Coming soon
                </span>
              </div>
            </GlowPanel>
          ))}
        </div>
      </div>
    </div>
  );
}
