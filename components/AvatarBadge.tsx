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
  const { initial, ringStart, ringEnd, innerStart, innerEnd } =
    getAvatarVisuals({ name, email });

  const fontSize = Math.max(16, Math.round(size * 0.45));

  return (
    <div
      className={cx(
        "rounded-full p-[3px] shadow-[0_18px_38px_rgba(10,10,35,0.5)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundImage: `linear-gradient(140deg, ${ringStart}, ${ringEnd})`,
      }}
    >
      <div
        className="h-full w-full rounded-full p-[3px]"
        style={{
          backgroundImage: `linear-gradient(160deg, ${ringEnd}, ${ringStart})`,
        }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-full"
          style={{
            backgroundImage: `linear-gradient(135deg, ${innerStart}, ${innerEnd})`,
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
    </div>
  );
}
