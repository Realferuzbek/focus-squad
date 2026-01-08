type AvatarVisualInput = {
  name?: string | null;
  email?: string | null;
};

export type Ring = { h1: number; h2: number; s: number; l1: number; l2: number };

export type AvatarVisuals = {
  initial: string;
  seed: string;
  ring: Ring;
};

const DEFAULT_SEED = "focus squad";
const GOLDEN_ANGLE = 137.5;

export function fnv1a(str: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < str.length; index += 1) {
    hash ^= str.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function lightnessCompensation(hue: number) {
  if (hue >= 200 && hue <= 280) return 4;
  if (hue >= 40 && hue <= 80) return -4;
  return 0;
}

export function ringFromSeed(seed: string): Ring {
  const base = fnv1a(seed);
  const h1 = base % 360;
  const offset = 24 + (fnv1a(`${seed}#`) % 24);
  const h2 = (h1 + offset) % 360;
  const s = 92;

  const l1 = 48 + lightnessCompensation(h1);
  const l2 = 58 + lightnessCompensation(h2);

  return { h1, h2, s, l1, l2 };
}

export function deconflictHue(h: number, used: number[], minSep = 25) {
  const sep = (a: number, b: number) => {
    const d = Math.abs(((a - b + 540) % 360) - 180);
    return d;
  };
  let out = h;
  let guard = 0;
  while (used.some((u) => sep(out, u) < minSep) && guard++ < 12) {
    out = (out + GOLDEN_ANGLE) % 360;
  }
  return out;
}

export function getAvatarVisuals({
  name,
  email,
}: AvatarVisualInput): AvatarVisuals {
  const seedSource = (name ?? email ?? DEFAULT_SEED).trim();
  const seed = (seedSource && seedSource.toLowerCase()) || DEFAULT_SEED;
  const firstSymbol =
    (email ?? name ?? DEFAULT_SEED).trim().charAt(0).toUpperCase() || "S";

  return {
    initial: firstSymbol,
    seed,
    ring: ringFromSeed(seed),
  };
}
