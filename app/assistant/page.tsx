export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cards = [
  {
    href: "/assistant/ask-ai",
    title: "Ask AI rules",
    description: "What it can do, what it won’t do, and the privacy boundaries.",
  },
  {
    href: "/assistant/features",
    title: "Focus Squad features",
    description: "Short, friendly guides to the main tools on the site.",
  },
];

export default function AssistantIndexPage() {
  return (
    <main className="min-h-[100dvh] bg-[#07070b] px-6 py-12 text-white">
      <div className="mx-auto w-full max-w-3xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-300/70">
            Assistant Knowledge
          </p>
          <h1 className="text-3xl font-semibold">
            Ask AI answers from Focus Squad pages only
          </h1>
          <p className="text-sm text-white/70">
            This section explains what Ask AI can help with, what it refuses, and
            how it stays grounded in public Focus Squad information.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <a
              key={card.href}
              href={card.href}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/20 hover:bg-white/10"
            >
              <h2 className="text-lg font-semibold">{card.title}</h2>
              <p className="mt-2 text-sm text-white/70">{card.description}</p>
            </a>
          ))}
        </section>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
          Ask AI uses only information from Focus Squad pages. If it can’t find
          an answer on the site, it will politely refuse instead of guessing.
        </div>
      </div>
    </main>
  );
}
