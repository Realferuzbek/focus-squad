import LiveStreamStudio from "@/components/LiveStreamStudio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function LiveStreamStudioFeature() {
  return (
    <div className="bg-[#07070b] min-h-[100dvh]">
      <LiveStreamStudio />
    </div>
  );
}
