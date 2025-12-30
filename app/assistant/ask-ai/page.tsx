import { loadAssistantKnowledge } from "@/lib/assistant/knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AskAiGuidePage() {
  const content = await loadAssistantKnowledge();
  const guide = content.askAi;
  return (
    <main className="min-h-[100dvh] bg-[#07070b] px-6 py-12 text-white">
      <div className="mx-auto w-full max-w-3xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-300/70">
            {guide.eyebrow}
          </p>
          <h1 className="text-3xl font-semibold">{guide.title}</h1>
          <p className="text-sm text-white/70">{guide.intro}</p>
        </header>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">{guide.canDoTitle}</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-white/70">
            {guide.canDo.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">{guide.refusesTitle}</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-white/70">
            {guide.refuses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          <h2 className="text-lg font-semibold text-white">
            {guide.privacyTitle}
          </h2>
          <p>{guide.privacyBody}</p>
        </section>
      </div>
    </main>
  );
}
