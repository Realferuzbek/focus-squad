export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function OlympiadOpportunitiesFeature() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#07070b] px-6 text-center text-white">
      <h1 className="text-3xl font-semibold md:text-4xl">
        Olympiad Opportunities
      </h1>
      <p className="mt-4 max-w-xl text-sm text-white/65 md:text-base">
        Discover real olympiads and prepare with a clear checklist and
        schedule.
        <br />
        <br />
        &bull; Filter by age/grade, country, subject, difficulty
        <br />
        &bull; Timeline, syllabus, and trusted past papers/resources
        <br />
        &bull; Step-by-step prep checklist
        <br />
        &bull; Auto-generate a prep plan into your planner/calendar
      </p>
      <p className="mt-6 rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/50">
        Coming soon &mdash; verified competitions only.
      </p>
    </div>
  );
}
