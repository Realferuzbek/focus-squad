// EFFECT: Placeholder gradient ensures route transitions never block while the timer iframe loads.
export default function TimerLoading() {
  return (
    <div className="min-h-[100dvh] w-full bg-[#050816]">
      <div className="h-[100dvh] animate-pulse bg-[radial-gradient(circle_at_top,#1e1b4b,#050816)]" />
    </div>
  );
}
