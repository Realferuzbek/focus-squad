import FlipCountdown from "@/components/timer/FlipCountdown";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TimerFeature() {
  return (
    <div className="flex min-h-[100dvh] w-full justify-center bg-black/95 px-4 py-12 text-white">
      <FlipCountdown />
    </div>
  );
}
