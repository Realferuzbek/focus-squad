export default function LinkedInAdminLoading() {
  return (
    <div className="min-h-[100dvh] bg-[#07070b] px-4 py-12 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="rounded-3xl border border-white/10 bg-[var(--swf-card)] p-8 shadow-[0_18px_45px_-24px_rgba(140,122,245,0.55)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="h-20 w-20 rounded-3xl bg-white/10" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-2/3 rounded-full bg-white/10" />
              <div className="h-4 w-1/2 rounded-full bg-white/5" />
              <div className="flex gap-3">
                <div className="h-3 w-20 rounded-full bg-white/10" />
                <div className="h-3 w-16 rounded-full bg-white/10" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-3xl border border-white/10 bg-[var(--swf-card)] p-6 shadow-[0_18px_45px_-24px_rgba(140,122,245,0.55)]"
            >
              <div className="flex animate-pulse items-start gap-4">
                <div className="h-11 w-11 rounded-2xl bg-white/10" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-1/2 rounded-full bg-white/10" />
                  <div className="h-3 w-1/4 rounded-full bg-white/5" />
                </div>
              </div>
              <div className="mt-5 space-y-3 animate-pulse">
                <div className="h-3 w-full rounded-full bg-white/10" />
                <div className="h-3 w-4/5 rounded-full bg-white/10" />
                <div className="h-3 w-2/5 rounded-full bg-white/5" />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, pillIdx) => (
                  <div key={pillIdx} className="h-9 rounded-full bg-white/5" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

