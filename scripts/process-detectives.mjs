// Crop the two detectives (pig, boy) out of a source illustration, cut them
// off at the waist for a half-body portrait, and remove the white background.
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/process-detectives.mjs <source.png>');
  process.exit(1);
}

const THRESHOLD = 238; // pixels with R,G,B all >= this become transparent

const CROPS = {
  'pig-detective.png': { left: 222, top: 12, width: 454, height: 598 },
  'boy-detective.png': { left: 855, top: 9, width: 376, height: 601 },
};

for (const [name, region] of Object.entries(CROPS)) {
  const output = join(__dirname, '../public/detective', name);

  const { data, info } = await sharp(input)
    .extract(region)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .trim()
    .toFile(output);

  console.log(`Done! ${name} → ${output}`);
}
