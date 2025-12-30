export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function AskAiGuidePage() {
  return (
    <main className="min-h-[100dvh] bg-[#07070b] px-6 py-12 text-white">
      <div className="mx-auto w-full max-w-3xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-300/70">
            Ask AI Guide
          </p>
          <h1 className="text-3xl font-semibold">What Ask AI can and can’t do</h1>
          <p className="text-sm text-white/70">
            Ask AI answers only using information that appears on Focus Squad
            pages. If a question isn’t covered on the site, it will say so.
          </p>
        </header>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">What it can do</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-white/70">
            <li>Explain Focus Squad features and how to find them.</li>
            <li>Summarize public pages so you can move faster.</li>
            <li>Point you to the right section when you’re unsure.</li>
          </ul>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">What it refuses</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-white/70">
            <li>Personal data like your stats, tasks, minutes, or streaks.</li>
            <li>Admin-only diagnostics, internal tools, or hidden settings.</li>
            <li>Anything that isn’t answered by Focus Squad pages.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          <h2 className="text-lg font-semibold text-white">Privacy promise</h2>
          <p>
            Ask AI can’t access your account, profile, or private activity. It
            will always keep your personal data out of the conversation.
          </p>
        </section>
      </div>
    </main>
  );
}
