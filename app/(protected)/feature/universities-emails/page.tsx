export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function UniversitiesEmailsFeature() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#07070b] px-6 text-center text-white">
      <h1 className="text-3xl font-semibold md:text-4xl">Universities Emails</h1>
      <p className="mt-4 max-w-xl text-sm text-white/65 md:text-base">
        Direct contacts for admissions teams, program coordinators, and student ambassadors are
        being verified and will surface here soon.
      </p>
      <p className="mt-6 rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/50">
        Coming soon
      </p>
    </div>
  );
}

