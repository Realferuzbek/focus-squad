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

const OUTER_LIME = "#0CBF62";
const OUTER_TEAL = "#0CB080";
const INNER_CYAN = "#42ADD4";
const INNER_TEAL = "#10874E";
const GRADIENT_START_DEG = 225;

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
  const outerRim = 2;
  const innerRim = Math.max(4, Math.round(size * 0.1));
  const innerHighlightInset = Math.max(1, innerRim - 1);

  const outerRingStyle: CSSProperties = {
    width: size,
    height: size,
    padding: outerRim,
    backgroundImage: `conic-gradient(from ${GRADIENT_START_DEG}deg, ${OUTER_TEAL} 0deg, ${OUTER_LIME} 140deg, ${OUTER_TEAL} 360deg)`,
    backgroundClip: "padding-box",
  };

  const innerRingStyle: CSSProperties = {
    padding: innerRim,
    backgroundImage: `conic-gradient(from ${GRADIENT_START_DEG}deg, ${INNER_CYAN} 0deg, ${INNER_TEAL} 150deg, ${INNER_CYAN} 360deg)`,
    backgroundClip: "padding-box",
    boxSizing: "border-box",
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
      style={outerRingStyle}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[2px] -z-10 rounded-full"
        style={{
          boxShadow:
            "0 0 16px rgba(12,191,98,0.45), 0 0 32px rgba(66,173,212,0.4), 0 0 52px rgba(3,4,18,0.55)",
        }}
      />
      <div
        className="relative z-[2] flex h-full w-full items-center justify-center rounded-full"
        style={innerRingStyle}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full"
          style={{
            inset: `${innerHighlightInset}px`,
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.22), rgba(255,255,255,0))",
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
    </div>
  );
}
