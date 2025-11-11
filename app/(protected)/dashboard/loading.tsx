// EFFECT: Provides a lightweight dashboard skeleton so the route can stream instantly.
export default function DashboardLoading() {
  return (
    <div className="min-h-[100dvh] bg-[#07070b] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="h-28 rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_25px_70px_rgba(104,67,255,0.15)]" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`dashboard-card-skeleton-${index}`}
              className="h-40 rounded-[26px] border border-white/5 bg-white/[0.02]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
