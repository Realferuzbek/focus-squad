export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const features = [
  {
    title: "Focus Timer",
    description:
      "Use Pomodoro-style focus and break modes to stay in a steady rhythm.",
  },
  {
    title: "Tasks",
    description:
      "Keep a simple list of what you want to finish and check items off.",
  },
  {
    title: "Leaderboard",
    description:
      "See community rankings based on focus sessions and streaks.",
  },
  {
    title: "Community",
    description:
      "Join live rooms and chat spaces to stay accountable with others.",
  },
  {
    title: "Motivation",
    description:
      "Quick boosts and prompts designed to keep your momentum up.",
  },
  {
    title: "Opportunities",
    description:
      "Browse curated study, research, internship, and hobby resources.",
  },
];

export default function AssistantFeaturesPage() {
  return (
    <main className="min-h-[100dvh] bg-[#07070b] px-6 py-12 text-white">
      <div className="mx-auto w-full max-w-4xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-300/70">
            Focus Squad Features
          </p>
          <h1 className="text-3xl font-semibold">
            The main tools you’ll see on the site
          </h1>
          <p className="text-sm text-white/70">
            These short descriptions help Ask AI point you to the right place.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-white/70">
                {feature.description}
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
