export default function StreakCard({ streak }: { streak: number }) {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft">
      <h2 className="font-bold mb-2">My streak</h2>
      <div className="text-3xl">🔥 {streak}</div>
    </div>
  );
}
