export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function OlympiadOpportunitiesFeature() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#07070b] px-6 text-center text-white">
      <h1 className="text-3xl font-semibold md:text-4xl">
        Olympiad Opportunities
      </h1>
      <p className="mt-4 max-w-xl text-sm text-white/65 md:text-base">
        Upcoming Olympiads, prep resources, and team formation channels will
        launch here to help you chase podium finishes.
      </p>
      <p className="mt-6 rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/50">
        Coming soon
      </p>
    </div>
  );
}
