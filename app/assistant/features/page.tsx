import { loadAssistantKnowledge } from "@/lib/assistant/knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AssistantFeaturesPage() {
  const content = await loadAssistantKnowledge();
  const features = content.features.items;
  return (
    <main className="min-h-[100dvh] bg-[#07070b] px-6 py-12 text-white">
      <div className="mx-auto w-full max-w-4xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-300/70">
            {content.features.eyebrow}
          </p>
          <h1 className="text-3xl font-semibold">
            {content.features.title}
          </h1>
          <p className="text-sm text-white/70">{content.features.intro}</p>
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
