export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function HobbiesOpportunitiesFeature() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#07070b] px-6 text-center text-white">
      <h1 className="text-3xl font-semibold md:text-4xl">
        Hobbies Opportunities
      </h1>
      <p className="mt-4 max-w-xl text-sm text-white/65 md:text-base">
        Turn interests into skills with simple tracks, challenges, and project
        ideas.
        <br />
        <br />
        &bull; Quick quiz &rarr; 3 recommended tracks
        <br />
        &bull; Starter kit + 7-day challenge
        <br />
        &bull; Real project ideas (not just theory)
        <br />
        &bull; Community links to join people like you
      </p>
      <p className="mt-6 rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/50">
        Coming soon &mdash; starting with a small set of high-quality tracks.
      </p>
    </div>
  );
}
