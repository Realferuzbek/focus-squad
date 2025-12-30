import { loadAssistantKnowledge } from "@/lib/assistant/knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AssistantIndexPage() {
  const content = await loadAssistantKnowledge();
  const cards = content.index.cards;
  return (
    <main className="min-h-[100dvh] bg-[#07070b] px-6 py-12 text-white">
      <div className="mx-auto w-full max-w-3xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-300/70">
            {content.index.eyebrow}
          </p>
          <h1 className="text-3xl font-semibold">{content.index.title}</h1>
          <p className="text-sm text-white/70">{content.index.intro}</p>
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
          {content.index.note}
        </div>
      </div>
    </main>
  );
}
