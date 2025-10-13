export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import GlowPanel from "@/components/linkedinhub/GlowPanel";

const HUB_CARD = {
  title: "Admin's LinkedIn Page",
  description: "Read my updates in-app; interact on LinkedIn.",
  action: {
    label: "Open",
    href: "/feature/linkedin/admin",
  },
};

export default function LinkedInHubFeature() {
  return (
    <div className="min-h-[100dvh] bg-[#07070b] px-4 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header>
          <h1 className="text-3xl font-semibold md:text-4xl">LinkedIn Hub</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            A polished window into my LinkedIn presence. Browse updates here, then join the
            conversation directly on LinkedIn.
          </p>
        </header>

        <GlowPanel className="rounded-3xl border border-white/10 bg-[#11111f]/80 p-8 shadow-[0_30px_70px_rgba(88,48,255,0.35)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="text-xs uppercase tracking-[0.35em] text-fuchsia-300/70">Premium</span>
              <h2 className="mt-3 text-2xl font-semibold">{HUB_CARD.title}</h2>
              <p className="mt-3 max-w-xl text-sm text-zinc-300">{HUB_CARD.description}</p>
            </div>

            <Link
              href={HUB_CARD.action.href}
              className="inline-flex min-w-[160px] items-center justify-center rounded-2xl bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#ec4899] px-6 py-3 text-sm font-semibold shadow-[0_18px_35px_rgba(138,92,246,0.35)] transition hover:shadow-[0_26px_60px_rgba(138,92,246,0.45)]"
            >
              {HUB_CARD.action.label}
            </Link>
          </div>
        </GlowPanel>
      </div>
    </div>
  );
}
