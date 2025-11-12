import Image from "next/image";
import { getAvatarVisuals } from "@/lib/avatar-colors";

type AvatarBadgeProps = {
  avatarUrl?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function AvatarBadge({
  avatarUrl,
  name,
  email,
  size = 64,
  className,
  priority = false,
  alt = "User avatar",
}: AvatarBadgeProps) {
  const { initial } = getAvatarVisuals({ name, email });

  const fontSize = Math.max(16, Math.round(size * 0.45));
  const ringStroke = Math.max(2, Math.round(size * 0.05));
  const haloStroke = Math.max(2, Math.round(size * 0.04));
  // Fixed palette per reviewer avatar spec: cyan bottom-left → emerald top-right.
  const ringGradient =
    "conic-gradient(from 220deg, #42ADD4 0deg, #10874E 150deg, #0CB080 260deg, #0CBF62 330deg, #42ADD4 360deg)";
  const innerGradient = "linear-gradient(130deg, #42ADD4 0%, #10874E 85%)";

  return (
    <div
      className={cx(
        "relative rounded-full shadow-[0_18px_38px_rgba(10,10,35,0.55)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        padding: ringStroke,
        backgroundImage: ringGradient,
      }}
    >
      <div
        className="relative h-full w-full rounded-full"
        style={{
          padding: haloStroke,
          backgroundColor: "rgba(4,4,15,0.85)",
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%)",
          boxShadow: "inset 0 6px 18px rgba(0,0,0,0.45)",
        }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-full"
          style={{
            backgroundImage: innerGradient,
          }}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={alt}
              fill
              sizes={`${size}px`}
              priority={priority}
              className="object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-white"
              style={{ fontSize }}
            >
              <span className="font-semibold tracking-tight">{initial}</span>
            </div>
          )}
        </div>
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[-6%] rounded-full opacity-70 blur-[8px]"
        style={{ backgroundImage: ringGradient }}
      />
    </div>
  );
}
