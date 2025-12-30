export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ResearchPositionsFeature() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#07070b] px-6 text-center text-white">
      <h1 className="text-3xl font-semibold md:text-4xl">Research Positions</h1>
      <p className="mt-4 max-w-xl text-sm text-white/65 md:text-base">
        We&rsquo;ll help you go from &ldquo;I don&rsquo;t know where to start&rdquo;
        to a clear research plan &mdash; step by step.
        <br />
        <br />
        &bull; Choose your goal: university application, publish, portfolio, or
        learn
        <br />
        &bull; Get a simple roadmap with a checklist and weekly plan
        <br />
        &bull; Use ready templates: mentor emails, outlines, and reading plans
        <br />
        &bull; Explore &ldquo;Research Packs&rdquo; with starter papers and
        realistic questions
      </p>
      <p className="mt-6 rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/50">
        Coming soon &mdash; building the first packs now.
      </p>
    </div>
  );
}
