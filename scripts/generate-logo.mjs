/**
 * Rasterises the Raw Motion mark from its single SVG source.
 *
 *   public/assets/logo.svg  ->  public/assets/logo.png  (1024, transparent)
 *                               public/logo.png         (512,  transparent)
 *
 * Run via `npm run icons`, which then feeds logo.png into the Windows
 * packaging assets. Edit the SVG, never the PNGs.
 */
import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(root, "public/assets/logo.svg");

if (!existsSync(SOURCE)) {
  console.error(`✗ Missing logo source at ${SOURCE}`);
  process.exit(1);
}

const OUTPUTS = [
  { size: 1024, out: resolve(root, "public/assets/logo.png") },
  { size: 512, out: resolve(root, "public/logo.png") },
];

for (const { size, out } of OUTPUTS) {
  // `density` drives the SVG rasterisation resolution - without it sharp
  // renders at 72dpi and upscaling a 1024px target turns the edges to mush.
  const png = await sharp(SOURCE, { density: (72 * size) / 1024 })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  writeFileSync(out, png);
  console.log(`✓ ${out.replace(root, ".")} (${size}×${size})`);
}
