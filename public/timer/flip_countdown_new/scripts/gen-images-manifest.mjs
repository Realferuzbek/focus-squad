// Scan /assets for .png/.jpg and write assets/images.json (sorted)
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ASSETS = "assets";
const BACKGROUNDS = join(ASSETS, "backgrounds");
const OUT = join(ASSETS, "images.json");

try {
  const files = await readdir(BACKGROUNDS);
  const imgs = files
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => `${ASSETS}/backgrounds/${f}`);

  await writeFile(OUT, JSON.stringify({ images: imgs }, null, 2));
  console.log(`Wrote ${OUT} with ${imgs.length} image(s).`);
} catch (err) {
  console.error("Failed to build manifest:", err);
  process.exitCode = 1;
}
