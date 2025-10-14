export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import GlowPanel from "@/components/GlowPanel";

const cards = [
  {
    title: "Admin Chat",
    description: "Direct line to the team. Get help, share wins, and stay aligned.",
    href: "/community/admin",
    tag: "Live",
  },
  {
    title: "Live Stream Chat",
    description: "Drop into focused sessions with the squad and stay accountable.",
    href: "#",
    tag: "Soon",
  },
  {
    title: "Groups Chat",
    description: "Spin up micro-communities to tackle shared goals together.",
    href: "#",
    tag: "Soon",
  },
  {
    title: "Anonymous Chat",
    description: "Share candid updates and feedback—no names attached.",
    href: "#",
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
          {cards.map((card) => (
            <GlowPanel key={card.title} subtle className="p-6 md:p-8">
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="space-y-3">
                  <span className="pill">{card.tag}</span>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">
                    {card.title}
                  </h2>
                  <p className="text-sm text-white/65">{card.description}</p>
                </div>
                <Link href={card.href} className="btn-primary w-fit px-6">
                  Open
                </Link>
              </div>
            </GlowPanel>
          ))}
        </div>
      </div>
    </div>
  );
}
