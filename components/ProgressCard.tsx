export default function ProgressCard({ completed, total }: { completed: number; total: number }) {
  const pct = total ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft">
      <h2 className="font-bold mb-2">Progress</h2>
      <div className="w-full h-3 bg-[#0f0f13] rounded-full overflow-hidden">
        <div className="h-3 bg-gradient-to-r from-sky-400 to-fuchsia-500" style={{ width: `${pct}%`, transition: 'width .2s' }} />
      </div>
      <div className="mt-2 text-sm text-subtle">{completed}/{total} completed</div>
    </div>
  );
}
