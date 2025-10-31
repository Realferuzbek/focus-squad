#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const outputRoot = join(projectRoot, "public", "timer", "assets");

const BASE_URL = "https://raw.githubusercontent.com/Realferuzbek/flip_countdown_new/main/";

const FILES = [
  { local: "assets/backgrounds/background.jpg" },
  { local: "assets/backgrounds/background_2.png" },
  { local: "assets/backgrounds/background_3.jpg" },
  {
    local: "assets/alarm.mp3",
    fallbacks: ["assets/audio/alarm.mp3"],
  },
  { local: "assets/images.json" },
  { local: "assets/icons/gear.svg" },
  { local: "assets/icons/reload.svg" },
  { local: "assets/icons/fullscreen.svg" },
];

async function ensureDir(pathname) {
  await mkdir(dirname(pathname), { recursive: true });
}

async function downloadFile(entry) {
  const { local, fallbacks = [], remote } = entry;
  const candidates = [remote ?? local, ...fallbacks];

  let lastError;
  for (const candidate of candidates) {
    const url = new URL(candidate, BASE_URL);
    process.stdout.write(`Fetching ${url} ... `);
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "vendor-pull-script",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const outputPath = join(outputRoot, local);
      await ensureDir(outputPath);
      await writeFile(outputPath, Buffer.from(arrayBuffer));
      process.stdout.write("done\n");
      if (candidate !== local) {
        console.log(`  saved from ${candidate}`);
      }
      return;
    } catch (error) {
      lastError = error;
      process.stdout.write("failed\n");
    }
  }

  throw new Error(`Unable to download ${local}: ${lastError}`);
}

async function main() {
  for (const file of FILES) {
    await downloadFile(file);
  }

  console.log("All assets downloaded to", outputRoot);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
