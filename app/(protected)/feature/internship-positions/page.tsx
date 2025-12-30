export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function InternshipPositionsFeature() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#07070b] px-6 text-center text-white">
      <h1 className="text-3xl font-semibold md:text-4xl">
        Internship Positions
      </h1>
      <p className="mt-4 max-w-xl text-sm text-white/65 md:text-base">
        Find real internships without scams &mdash; with clear requirements and
        deadlines.
        <br />
        <br />
        &bull; Verified listings only (official pages / trusted organizations)
        <br />
        &bull; Filters: remote, paid, beginner-friendly, country, deadlines
        <br />
        &bull; Eligibility + apply steps + portfolio checklist
        <br />
        &bull; One tap: add deadlines to your planner/calendar
      </p>
      <p className="mt-6 rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/50">
        Coming soon &mdash; verified listings only.
      </p>
    </div>
  );
}
