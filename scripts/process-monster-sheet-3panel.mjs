// Crop a 3-panel horizontal mood-sheet (happy | sad | urgent, left to right)
// into individual transparent-background portraits. Same border-avoidance
// approach as process-monster-sheet.mjs — crop well inside each panel's
// border rectangle, then trim() tightens to the character.
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const input = process.argv[2];
const outputPrefix = process.argv[3];
const margin = process.argv[4] ? parseInt(process.argv[4], 10) : 140;
if (!input || !outputPrefix) {
  console.error('Usage: node scripts/process-monster-sheet-3panel.mjs <source.png> <outputPrefix> [margin]');
  process.exit(1);
}

const THRESHOLD = 238;
const MOODS = ['happy', 'sad', 'urgent'];

async function run() {
  const meta = await sharp(input).metadata();
  const { width, height } = meta;
  const panelW = Math.floor(width / 3);

  for (let idx = 0; idx < 3; idx++) {
    const mood = MOODS[idx];
    const region = {
      left: idx * panelW + margin,
      top: margin,
      width: panelW - margin * 2,
      height: height - margin * 2,
    };
    const output = join(__dirname, '../public/monster-dessert', `${outputPrefix}-${mood}.png`);

    const { data, info } = await sharp(input)
      .extract(region)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width: w, height: h, channels } = info;
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD) data[i + 3] = 0;
    }

    await sharp(data, { raw: { width: w, height: h, channels } })
      .png()
      .trim()
      .toFile(output);

    console.log(`Done! ${mood} (panel ${idx}) → ${output}`);
  }
}

run();
