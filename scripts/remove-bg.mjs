// Remove white/near-white background from sprites.png → make transparent
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const input  = join(__dirname, '../public/detective/sprites.png');
const output = join(__dirname, '../public/detective/sprites.png'); // overwrite

const THRESHOLD = 238; // pixels with R,G,B all >= this become transparent

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info; // channels = 4 (RGBA)

for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD) {
    data[i + 3] = 0; // fully transparent
  }
}

await sharp(data, { raw: { width, height, channels } })
  .png()
  .toFile(output);

console.log(`Done! ${width}×${height} → ${output}`);
