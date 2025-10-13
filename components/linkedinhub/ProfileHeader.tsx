import Image from "next/image";

type ProfileHeaderProps = {
  name: string;
  headline?: string | null;
  avatarUrl?: string | null;
  followers?: string | null;
};

export default function ProfileHeader({
  name,
  headline,
  avatarUrl,
  followers,
}: ProfileHeaderProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#11111f]/80 p-6 shadow-[0_20px_50px_rgba(20,20,40,0.45)] backdrop-blur">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-3xl border border-white/15 bg-white/5">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={name} fill sizes="80px" className="object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-2xl">👤</div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold md:text-[26px]">{name}</h2>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">
              Admin
            </span>
          </div>
          {headline && <p className="mt-2 text-sm text-zinc-300">{headline}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.28em] text-zinc-500">
            <span>Focus Squad</span>
            {followers && (
              <>
                <span className="text-zinc-700">•</span>
                <span>{followers}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
