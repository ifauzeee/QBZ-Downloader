/**
 * Render the master logo (assets/desktop/icon.svg) into:
 *   - assets/desktop/icon.png   (1024x1024, used by Electron runtime + macOS builds)
 *   - assets/desktop/icon.ico   (multi-size, used by electron-builder for Windows)
 *
 * Usage: node scripts/render-logo.cjs
 * Requires sharp (dev-only, not saved to package.json):
 *   npm install --no-save --package-lock=false sharp
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'desktop');
const SRC = path.join(OUT_DIR, 'icon.svg');

const PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

function buildIco(pngBuffers) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(ICO_SIZES.length, 4); // image count

  let offset = 6 + 16 * ICO_SIZES.length;
  const entries = [];
  for (const size of ICO_SIZES) {
    const data = pngBuffers[size];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width (0 = 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8); // bytes in resource
    entry.writeUInt32LE(offset, 12); // image offset
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...ICO_SIZES.map((s) => pngBuffers[s])]);
}

async function main() {
  const pngBuffers = {};
  for (const size of PNG_SIZES) {
    pngBuffers[size] = await sharp(SRC).resize(size, size).png().toBuffer();
  }

  await fs.promises.writeFile(path.join(OUT_DIR, 'icon.png'), pngBuffers[1024]);
  await fs.promises.writeFile(path.join(OUT_DIR, 'icon.ico'), buildIco(pngBuffers));

  console.log(`icon.png  (1024x1024, ${pngBuffers[1024].length} bytes)`);
  console.log(`icon.ico  (${ICO_SIZES.join('/')}px, ${fs.statSync(path.join(OUT_DIR, 'icon.ico')).size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
