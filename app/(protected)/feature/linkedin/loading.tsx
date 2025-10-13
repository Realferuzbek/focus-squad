export default function LinkedInFeatureLoading() {
  return (
    <div className="min-h-[100dvh] bg-[#07070b] px-4 py-12 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <div className="space-y-4">
          <div className="h-6 w-24 rounded-full bg-white/10" />
          <div className="h-10 w-2/3 rounded-full bg-white/10" />
          <div className="h-4 w-1/2 rounded-full bg-white/5" />
        </div>
        <div className="rounded-3xl border border-white/10 bg-[var(--swf-card)] p-8 shadow-[0_25px_80px_-28px_rgba(119,88,247,0.75)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <div className="h-4 w-20 rounded-full bg-white/10" />
              <div className="h-8 w-64 rounded-full bg-white/10" />
              <div className="h-4 w-80 rounded-full bg-white/5" />
            </div>
            <div className="h-11 w-40 rounded-full bg-gradient-to-r from-[var(--swf-glow-start)]/60 to-[var(--swf-glow-end)]/60" />
          </div>
        </div>
      </div>
    </div>
  );
}
