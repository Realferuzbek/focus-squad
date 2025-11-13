import Image from "next/image";
import type { CSSProperties } from "react";
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

type CSSVarStyle = CSSProperties & Record<`--${string}`, string | number>;

export default function AvatarBadge({
  avatarUrl,
  name,
  email,
  size = 64,
  className,
  priority = false,
  alt = "User avatar",
}: AvatarBadgeProps) {
  const { initial, ring } = getAvatarVisuals({ name, email });
  const { h1, h2, s, l1, l2 } = ring;

  const fontSize = Math.max(16, Math.round(size * 0.45));
  const candidate = Math.round(size * 0.08);
  const maxRing = Math.max(2, Math.floor(size / 2) - 3);
  const ringStroke = Math.max(3, Math.min(candidate, maxRing));
  const highlightInset = Math.max(1, ringStroke - 1);

  const styleVars: CSSVarStyle = {
    width: size,
    height: size,
    padding: ringStroke,
    backgroundImage: "var(--ring-grad)",
    backgroundClip: "padding-box",
    "--h1": `${h1}`,
    "--h2": `${h2}`,
    "--s": `${s}%`,
    "--l1": `${l1}%`,
    "--l2": `${l2}%`,
    "--ring-grad": `conic-gradient(
      from 210deg,
      hsl(var(--h1) var(--s) var(--l1)) 0%,
      hsl(var(--h2) var(--s) var(--l2)) 100%
    )`,
    "--ring-glow1": `hsl(${h2} ${s}% ${Math.min(l2 + 2, 62)}% / 0.45)`,
    "--ring-glow2": `hsl(${h1} ${s}% ${Math.min(l1 + 7, 62)}% / 0.35)`,
  };

  const avatarSurface: CSSProperties = {
    backgroundColor: "rgba(3, 3, 12, 0.9)",
    backgroundImage:
      "radial-gradient(circle at 32% 22%, rgba(255,255,255,0.35), rgba(255,255,255,0) 48%)",
    boxShadow: "inset 0 10px 26px rgba(2, 3, 12, 0.7)",
  };

  const highlightMask =
    "radial-gradient(circle, transparent calc(100% - 2px), #000 calc(100% - 1px))";

  return (
    <div
      className={cx(
        "avatar-ring relative inline-flex items-center justify-center rounded-full isolate shadow-[0_20px_38px_rgba(5,5,25,0.55)]",
        className,
      )}
      style={styleVars}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[2px] -z-10 rounded-full"
        style={{
          boxShadow:
            "0 0 12px var(--ring-glow1), 0 0 24px var(--ring-glow2), 0 0 44px rgba(3,4,18,0.4)",
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: `${highlightInset}px`,
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.18), rgba(255,255,255,0))",
          WebkitMask: highlightMask,
          mask: highlightMask,
          zIndex: 1,
        }}
      />
      <div
        className="relative z-[2] h-full w-full overflow-hidden rounded-full"
        style={avatarSurface}
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
  );
}
