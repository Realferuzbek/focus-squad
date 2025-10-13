export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import GlowPanel from "@/components/GlowPanel";

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
    <div className="min-h-[100dvh] bg-[#07070b] px-4 py-12 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="space-y-3">
          <span className="pill">Feature Hub</span>
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">LinkedIn Hub</h1>
          <p className="max-w-2xl text-base text-white/60">
            A polished window into my LinkedIn presence. Browse updates here, then join the
            conversation directly on LinkedIn.
          </p>
        </header>

        <GlowPanel className="p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <span className="pill">Premium</span>
              <h2 className="text-3xl font-bold tracking-tight text-white">{HUB_CARD.title}</h2>
              <p className="max-w-xl text-sm font-medium text-white/65">{HUB_CARD.description}</p>
            </div>

            <Link
              href={HUB_CARD.action.href}
              className="btn-primary min-w-[170px] justify-center"
            >
              {HUB_CARD.action.label}
            </Link>
          </div>
        </GlowPanel>
      </div>
    </div>
  );
}
