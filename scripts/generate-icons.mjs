/**
 * Generates all Windows packaging assets from a single source logo:
 *
 *   build/icon.ico              multi-resolution app / installer icon
 *   build/installerSidebar.bmp  164x314 welcome/finish page sidebar (BMP3, 24bpp)
 *   build/installerHeader.bmp   150x57 inner-page header strip (BMP3, 24bpp)
 *
 * Source: public/assets/logo.png (falls back to public/logo.png).
 * Run with: npm run icons
 *
 * NSIS/MUI require classic 24-bit BMP images, which sharp cannot encode, so a
 * tiny bottom-up BMP writer is included below.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const buildDir = resolve(root, "build");

const SOURCE = [
  resolve(root, "public/assets/logo.png"),
  resolve(root, "public/logo.png"),
].find(existsSync);

if (!SOURCE) {
  console.error("✗ No source logo found at public/assets/logo.png");
  process.exit(1);
}

if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true });

/** Encode raw RGBA pixels as an uncompressed 24-bit (BGR, bottom-up) BMP. */
function encodeBmp24(rgba, width, height) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const headerSize = 14 + 40;
  const buf = Buffer.alloc(headerSize + pixelArraySize);

  buf.write("BM", 0, "ascii");
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(headerSize, 10); // pixel data offset
  buf.writeUInt32LE(40, 14); // DIB header size
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22); // positive => bottom-up
  buf.writeUInt16LE(1, 26); // color planes
  buf.writeUInt16LE(24, 28); // bits per pixel
  buf.writeUInt32LE(0, 30); // BI_RGB (no compression)
  buf.writeUInt32LE(pixelArraySize, 34);
  buf.writeInt32LE(2835, 38); // 72 DPI horizontal
  buf.writeInt32LE(2835, 42); // 72 DPI vertical

  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y; // BMP rows are stored bottom-to-top
    let p = headerSize + y * rowSize;
    for (let x = 0; x < width; x++) {
      const si = (srcY * width + x) * 4;
      buf[p++] = rgba[si + 2]; // B
      buf[p++] = rgba[si + 1]; // G
      buf[p++] = rgba[si]; // R
    }
  }
  return buf;
}

async function writeBmpFromSharp(pipeline, width, height, out) {
  const { data } = await pipeline
    .flatten({ background: "#0d0d0d" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  writeFileSync(out, encodeBmp24(data, width, height));
}

/**
 * The mark is drawn with the plate inset ~17% inside a 1024 canvas, which
 * leaves room for its drop shadow. At 16–32px that padding costs more than
 * the shadow is worth - the glyph shrinks to a few pixels. So the small
 * entries are cropped to the plate bounds and rendered edge-to-edge, which
 * is what Windows shows in the taskbar and title bar.
 */
const PLATE = { left: 160, top: 160, width: 704, height: 704 };
const CROP_AT_OR_BELOW = 32;

async function generateIco() {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = await Promise.all(
    sizes.map((s) => {
      const pipeline = sharp(SOURCE);
      if (s <= CROP_AT_OR_BELOW) pipeline.extract(PLATE);
      return pipeline
        .resize(s, s, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
    }),
  );
  const ico = await pngToIco(pngs);
  writeFileSync(resolve(buildDir, "icon.ico"), ico);
  console.log("✓ build/icon.ico");
}

async function generateSidebar() {
  const W = 164;
  const H = 314;
  const logoSize = 96;
  const logo = await sharp(SOURCE)
    .resize(logoSize, logoSize, { fit: "contain" })
    .png()
    .toBuffer();

  const bg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stop-color="#262626"/>
           <stop offset="1" stop-color="#0d0d0d"/>
         </linearGradient>
       </defs>
       <rect width="${W}" height="${H}" fill="url(#g)"/>
       <text x="${W / 2}" y="180" text-anchor="middle" fill="#eeeeee"
             font-family="Segoe UI, sans-serif" font-size="15" font-weight="500">Raw</text>
       <text x="${W / 2}" y="200" text-anchor="middle" fill="#eeeeee"
             font-family="Segoe UI, sans-serif" font-size="15" font-weight="500">Motion</text>
       <text x="${W / 2}" y="296" text-anchor="middle" fill="#9b9b9b"
             font-family="Segoe UI, sans-serif" font-size="10">nettanvir.dev</text>
     </svg>`,
  );

  const pipeline = sharp(bg).composite([
    { input: logo, top: 40, left: Math.round((W - logoSize) / 2) },
  ]);
  await writeBmpFromSharp(
    pipeline,
    W,
    H,
    resolve(buildDir, "installerSidebar.bmp"),
  );
  console.log("✓ build/installerSidebar.bmp");
}

async function generateHeader() {
  const W = 150;
  const H = 57;
  const logoSize = 40;
  const logo = await sharp(SOURCE)
    .resize(logoSize, logoSize, { fit: "contain" })
    .png()
    .toBuffer();

  const bg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${W}" height="${H}" fill="#0d0d0d"/>
       <text x="58" y="34" fill="#eeeeee" font-family="Segoe UI, sans-serif"
             font-size="13" font-weight="500">Raw Motion</text>
     </svg>`,
  );

  const pipeline = sharp(bg).composite([
    { input: logo, top: Math.round((H - logoSize) / 2), left: 10 },
  ]);
  await writeBmpFromSharp(
    pipeline,
    W,
    H,
    resolve(buildDir, "installerHeader.bmp"),
  );
  console.log("✓ build/installerHeader.bmp");
}

try {
  console.log(`Generating packaging assets from ${SOURCE}`);
  await generateIco();
  await generateSidebar();
  await generateHeader();
  console.log("Done.");
} catch (err) {
  console.error("✗ Icon generation failed:", err);
  process.exit(1);
}
