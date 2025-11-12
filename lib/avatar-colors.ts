type AvatarVisualInput = {
  name?: string | null;
  email?: string | null;
};

type AvatarVisuals = {
  initial: string;
  ringStart: string;
  ringEnd: string;
  innerStart: string;
  innerEnd: string;
};

const DEFAULT_SEED = "focus squad";

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 4294967296;
  }
  return Math.abs(hash);
}

function hsl(hue: number, saturation: number, lightness: number) {
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function getAvatarVisuals({
  name,
  email,
}: AvatarVisualInput): AvatarVisuals {
  const identifier =
    (name ?? email ?? DEFAULT_SEED).trim().toLowerCase() || DEFAULT_SEED;
  const firstSymbol =
    (name ?? email ?? DEFAULT_SEED).trim().charAt(0).toUpperCase() || "S";

  const hash = hashString(identifier);
  const hue = hash % 360;

  const ringStart = hsl(hue, 85, 62);
  const ringEnd = hsl((hue + 45) % 360, 85, 54);
  const innerStart = hsl((hue + 95) % 360, 70, 42);
  const innerEnd = hsl((hue + 130) % 360, 70, 52);

  return {
    initial: firstSymbol,
    ringStart,
    ringEnd,
    innerStart,
    innerEnd,
  };
}
