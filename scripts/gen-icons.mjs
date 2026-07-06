// Generate the PWA / native-app icon set from a single vector master.
//
// Why vector shapes (not <text>): sharp rasterises SVG via libvips, which has no
// access to our web fonts — a <text> icon would render in a system fallback or
// not at all. A geometric gold "E" monogram on the Esker dark renders identically
// everywhere and reads cleanly at 48px.
//
// Output (run `npm run icons`):
//   public/icons/icon-192.png        — PWA "any"
//   public/icons/icon-512.png        — PWA "any" (install / splash)
//   public/icons/icon-maskable-512.png — PWA "maskable" (Android adaptive)
//   public/icons/icon-1024.png       — master source for Capacitor (@capacitor/assets)
//   app/apple-icon.png (180)         — Next auto-emits <link rel="apple-touch-icon">
//
// The browser-tab favicon stays app/icon.svg (crisp at tiny sizes).

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BG = "#0c0a07"; // Esker near-black warm
const GOLD = "#C9A84C";

// A gold "E" drawn from rounded bars on a 1024 canvas. The mark sits within the
// central ~70% so it survives the Android maskable safe-zone crop unchanged.
function master() {
  const r = 14;
  const bar = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${GOLD}"/>`;
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${BG}"/>
  ${bar(372, 300, 86, 424)}   <!-- spine -->
  ${bar(372, 300, 300, 84)}   <!-- top arm -->
  ${bar(372, 470, 248, 84)}   <!-- middle arm (shorter) -->
  ${bar(372, 640, 300, 84)}   <!-- bottom arm -->
</svg>`;
}

const targets = [
  { file: "public/icons/icon-192.png", size: 192 },
  { file: "public/icons/icon-512.png", size: 512 },
  { file: "public/icons/icon-maskable-512.png", size: 512 },
  { file: "public/icons/icon-1024.png", size: 1024 },
  { file: "app/apple-icon.png", size: 180 },
];

const svg = Buffer.from(master());
await mkdir(join(ROOT, "public/icons"), { recursive: true });

for (const t of targets) {
  await sharp(svg, { density: 384 })
    .resize(t.size, t.size, { fit: "cover" })
    .png()
    .toFile(join(ROOT, t.file));
  console.log("✓", t.file, `${t.size}×${t.size}`);
}
console.log("Icons generated.");
