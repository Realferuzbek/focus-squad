export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function EssayWorkshopFeature() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#07070b] px-6 text-center text-white">
      <h1 className="text-3xl font-semibold md:text-4xl">Essay Workshop</h1>
      <p className="mt-4 max-w-xl text-sm text-white/65 md:text-base">
        A structured workshop to help you write better &mdash; not
        &ldquo;AI writes it for you.&rdquo;
        <br />
        <br />
        &bull; Personal statement + &ldquo;Why us?&rdquo; + supplements
        <br />
        &bull; Brainstorm &rarr; outline &rarr; draft &rarr; revision checklist
        <br />
        &bull; Rubric feedback: clarity, structure, specificity, voice
        <br />
        &bull; Detects &ldquo;too generic&rdquo; sentences and helps you improve
      </p>
      <p className="mt-6 rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/50">
        Coming soon &mdash; focused on real improvement.
      </p>
    </div>
  );
}
